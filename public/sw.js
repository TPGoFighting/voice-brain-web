/* Voice Brain PWA Service Worker（二期升级，2026-11-06）
 * - 应用外壳：预缓存静态资源，断网也能打开界面
 * - 页面导航：网络优先，失败回落缓存外壳（离线打开）
 * - 只读接口（会话/记忆列表）：网络优先，失败回落最近缓存
 * - 写接口（新增记忆/会话保存等）：网络失败时进 IndexedDB 队列，恢复后自动重放，
 *   并通过 postMessage 通知页面给用户 toast 反馈
 * - 问答/流式/清洗等实时接口：永不缓存、永不排队（无离线语义）
 */
const VERSION = 'vb-pwa-3.9.0';
const SHELL_CACHE = VERSION + '-shell';
const DATA_CACHE = VERSION + '-data';

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/tailwind-static.css?v=3.8.0_phase2',
  '/style.css?v=3.9.0_phase3',
  '/tp-ui.css',
  '/tp-bridge.css',
  '/app.js?v=3.9.0_phase3',
  '/audio-recorder.js?v=3.9.0_phase3',
  '/icons.js',
  '/tp-theme.js',
  '/tp-ui.js?v=3.5.0',
  '/tp-icons.svg',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/site.webmanifest'
];

const QUEUEABLE = [
  { method: 'POST', path: '/api/memory/add' },
  { method: 'POST', path: '/api/sessions' },
  { method: 'PUT', path: /^\/api\/sessions\// },
  { method: 'DELETE', path: /^\/api\/sessions\// }
];

function isQueueable(url, method) {
  return QUEUEABLE.some(rule => {
    if (rule.method !== method) return false;
    return typeof rule.path === 'string' ? url.pathname === rule.path : rule.path.test(url.pathname);
  });
}

/* ---------- IndexedDB outbox ---------- */
function outboxDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('vb-outbox', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('queue', { autoIncrement: true }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function outboxAdd(item) {
  const db = await outboxDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').add(item);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
async function outboxAll() {
  const db = await outboxDB();
  return new Promise((resolve, reject) => {
    const out = [];
    const store = db.transaction('queue', 'readonly').objectStore('queue');
    const cur = store.openCursor();
    cur.onsuccess = () => {
      const c = cur.result;
      if (c) { out.push({ key: c.key, item: c.value }); c.continue(); }
      else resolve(out);
    };
    cur.onerror = () => reject(cur.error);
  });
}
async function outboxDelete(key) {
  const db = await outboxDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').delete(key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function notifyClients(msg) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach(c => { try { c.postMessage(msg); } catch (e) {} });
}

let flushing = false;
async function flushOutbox() {
  if (flushing) return;
  flushing = true;
  try {
    const entries = await outboxAll();
    let sent = 0;
    for (const { key, item } of entries) {
      try {
        const res = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body || undefined
        });
        if (res.ok || res.status === 404 || res.status === 400) {
          await outboxDelete(key);
          sent++;
        } else {
          break; // 服务器仍异常，保留队列下次再试
        }
      } catch (e) {
        break; // 仍离线，停止重放
      }
    }
    if (sent > 0) await notifyClients({ type: 'vb-synced', count: sent });
  } catch (e) {}
  flushing = false;
}

/* ---------- lifecycle ---------- */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => flushOutbox())
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'vb-flush') flushOutbox();
});

/* ---------- fetch routing ---------- */
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  // 导航：网络优先，离线回落外壳
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then(c => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // API
  if (url.pathname.startsWith('/api/')) {
    // 写接口：失败入队
    if (e.request.method !== 'GET' && isQueueable(url, e.request.method)) {
      e.respondWith((async () => {
        try {
          const res = await fetch(e.request.clone());
          flushOutbox();
          return res;
        } catch (err) {
          const body = await e.request.clone().text();
          const headers = {};
          e.request.headers.forEach((v, k) => { headers[k] = v; });
          await outboxAdd({ url: e.request.url, method: e.request.method, headers, body, ts: Date.now() });
          await notifyClients({ type: 'vb-queued' });
          return new Response(JSON.stringify({ success: true, queued: true, offline: true }), {
            status: 202,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      })());
      return;
    }
    // 只读接口：网络优先，离线回落缓存
    if (e.request.method === 'GET' && (url.pathname === '/api/sessions' || url.pathname === '/api/memories')) {
      e.respondWith(
        fetch(e.request)
          .then(res => {
            const copy = res.clone();
            caches.open(DATA_CACHE).then(c => c.put(e.request, copy));
            return res;
          })
          .catch(() => caches.open(DATA_CACHE).then(c => c.match(e.request)))
      );
      return;
    }
    return; // 其余 API（含问答/流式/清洗）：直连网络
  }

  // 静态资源：缓存优先，后台更新
  if (['script', 'style', 'image', 'font'].includes(e.request.destination) || /\.(?:js|css|png|svg|ico|webmanifest)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request, { ignoreSearch: false }).then(hit => {
        const network = fetch(e.request).then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then(c => c.put(e.request, copy));
          }
          return res;
        }).catch(() => hit);
        return hit || network;
      })
    );
  }
});
