// assets/component-loader.js
//
// Loads the shared nav.html and footer.html partials into their
// placeholder divs, then wires up all nav interactivity:
// hamburger toggle, dropdowns (click/keyboard; hover is CSS-only on
// desktop), active-link highlighting, and closing the mobile menu
// when a link is clicked.

document.addEventListener('DOMContentLoaded', function () {
  loadComponent('nav-placeholder', 'nav.html', initNavLogic);
  loadComponent('footer-placeholder', 'footer.html');
});

function loadComponent(placeholderId, url, callback) {
  const placeholder = document.getElementById(placeholderId);
  if (!placeholder) return;

  fetch(url)
    .then(function (response) {
      if (!response.ok) throw new Error('Failed to load ' + url + ': ' + response.status);
      return response.text();
    })
    .then(function (html) {
      placeholder.innerHTML = html;
      if (typeof callback === 'function') callback();
    })
    .catch(function (err) { console.error(err); });
}

function initNavLogic() {
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.getElementById('navLinks');
  const dropdowns = Array.prototype.slice.call(document.querySelectorAll('.nav-dropdown'));

  function closeDropdowns(except) {
    dropdowns.forEach(function (dd) {
      if (dd === except) return;
      dd.classList.remove('open');
      const t = dd.querySelector('.nav-dropdown-toggle');
      if (t) t.setAttribute('aria-expanded', 'false');
    });
  }

  function closeMobileMenu() {
    if (navLinks) navLinks.classList.remove('open');
    if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
  }

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      const isOpen = navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (!isOpen) closeDropdowns();
    });
  }

  dropdowns.forEach(function (dd) {
    const toggle = dd.querySelector('.nav-dropdown-toggle');
    if (!toggle) return;
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      closeDropdowns(dd);                       // only one open at a time
      const isOpen = dd.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.nav-dropdown')) closeDropdowns();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeDropdowns(); closeMobileMenu(); }
  });
  window.addEventListener('resize', function () {
    if (window.innerWidth > 1024) { closeMobileMenu(); closeDropdowns(); }
  });

  if (navLinks) {
    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        closeMobileMenu();
        closeDropdowns();
      });
    });
  }

  // Active-link highlighting (also marks the parent dropdown button)
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a[href]').forEach(function (link) {
    const linkPath = link.getAttribute('href').split('/').pop();
    if (linkPath === currentPath) {
      link.classList.add('active');
      const parent = link.closest('.nav-dropdown');
      if (parent) parent.querySelector('.nav-dropdown-toggle').classList.add('active');
    }
  });
}
