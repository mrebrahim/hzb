// Service worker بسيط: بيخلي التطبيق قابل للتثبيت وبيعرض صفحة لو النت قطع.
// مش بنكيّش بيانات الأعضاء عمداً (خصوصية).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(
        '<html dir="rtl" lang="ar"><body style="font-family:sans-serif;padding:2rem;text-align:center"><h2>مفيش اتصال بالإنترنت</h2><p>جرّب تاني لما النت يرجع.</p></body></html>',
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
      ),
    ),
  );
});
