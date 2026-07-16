/* 三才聚頂 五式朝元 · Service Worker
   部署位置：站台「根目錄」（mood39.github.io 儲存庫根），scope 必須涵蓋
   五個引擎路徑（/Taiyishenshu/ /daliuren/ /ziwei/ /qimen/ /liuyao/）與聚合頁。
   策略：
   - 安裝時預快取五引擎首頁（個別容錯，缺一不廢全）。
   - 同源請求：stale-while-revalidate —— 先出快取秒開，背景更新下次生效；
     快取即為「凍結的引擎」，離線照常起盤。
   - 跨源請求（如紫微之 iztro CDN）：cache-first，首次上線取得後永久可離線。
   更新引擎後欲強制全員換版：把 VER 加一即可。 */
"use strict";
const VER = "wushu-v1";
const PRECACHE = [
  "/Taiyishenshu/",
  "/daliuren/",
  "/ziwei/",
  "/qimen/",
  "/liuyao/",
];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const cache = await caches.open(VER);
    await Promise.allSettled(PRECACHE.map(async url => {
      const res = await fetch(url, { cache: "no-cache" });
      if (res && (res.ok || res.type === "opaque")) await cache.put(url, res);
    }));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VER).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const sameOrigin = new URL(req.url).origin === self.location.origin;

  if (sameOrigin) {
    /* stale-while-revalidate：快取先行，網路背景補新 */
    e.respondWith((async () => {
      const cache = await caches.open(VER);
      const hit = await cache.match(req, { ignoreSearch: req.mode === "navigate" });
      const refresh = fetch(req).then(res => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      return hit || (await refresh) || new Response("離線且尚無快取。請先於連線狀態開啟一次。", {
        status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    })());
  } else {
    /* 跨源（CDN）：cache-first */
    e.respondWith((async () => {
      const cache = await caches.open(VER);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
        return res;
      } catch (err) {
        return new Response("", { status: 504 });
      }
    })());
  }
});
