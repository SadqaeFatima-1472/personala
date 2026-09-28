/* ===== Strataforge3 nav (append to assets/site.js) =====
   Uses event delegation, so it works even though component-loader.js
   injects the nav after the page loads. */
(function () {
  function closeDropdowns() {
    document.querySelectorAll('.sf-dd.open').forEach(function (d) {
      d.classList.remove('open');
      d.querySelector('button').setAttribute('aria-expanded', 'false');
    });
  }
  function closeMenu() {
    var links = document.getElementById('sfLinks');
    var t = document.querySelector('.sf-toggle');
    if (links) links.classList.remove('open');
    if (t) t.setAttribute('aria-expanded', 'false');
    closeDropdowns();
  }

  document.addEventListener('click', function (e) {
    var toggle = e.target.closest('.sf-toggle');
    if (toggle) {
      var links = document.getElementById('sfLinks');
      var open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
      if (!open) closeDropdowns();
      return;
    }
    var btn = e.target.closest('.sf-dd > button');
    if (btn) {
      var dd = btn.parentElement, wasOpen = dd.classList.contains('open');
      closeDropdowns();
      if (!wasOpen) { dd.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
      return;
    }
    if (e.target.closest('.sf-links a')) { closeMenu(); return; }
    if (!e.target.closest('.sf-nav')) closeMenu();
  });

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  window.addEventListener('resize', function () { if (window.innerWidth > 1020) closeMenu(); });

  // Highlight the current page (retries briefly while the nav is being loaded)
  var tries = 0;
  (function mark() {
    var as = document.querySelectorAll('.sf-nav a[href]');
    if (!as.length && tries++ < 20) return setTimeout(mark, 100);
    var page = location.pathname.split('/').pop() || 'index.html';
    if (page.indexOf('.') === -1) page += '.html';
    as.forEach(function (a) {
      if (a.getAttribute('href') === page) {
        a.setAttribute('aria-current', 'page');
        var dd = a.closest('.sf-dd');
        if (dd) dd.querySelector('button').style.color = '#FF8A3D';
      }
    });
  })();
})();
