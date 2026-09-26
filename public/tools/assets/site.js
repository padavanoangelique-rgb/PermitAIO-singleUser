/* PermitAIO in-app tools — no ads, no email gate. */
(function () {
  document.documentElement.classList.add("paio-embed");
  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll('a[href="./index.html"], a[href="/index.html"], a.back-link').forEach(function (a) {
      a.setAttribute("href", "/tools");
      a.setAttribute("target", "_parent");
      if (!a.textContent.trim()) return;
      if (/all tools/i.test(a.textContent)) a.textContent = "← All tools";
    });
    document.querySelectorAll(".aio-bar, .aio-promo, .site-footer, .legend, .back-link, .warn, h1, .page-sub, .page-title").forEach(function (n) {
      if (n.closest && n.closest(".ww-app, .pr-app, #scApp, .sc-result-live")) return;
      n.remove();
    });
  });
})();
