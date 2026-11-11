
/* =========================================
   GDF'27 — Site Behaviour
   1. Collapsible Mobile Menu
   2. Countdown to the Opening Ceremony
   3. Active Navigation Link
   4. Scroll Reveal
   ========================================= */


/* ---------- 1. Mobile Menu ---------- */

(function () {
  var btn = document.getElementById('menuBtn');
  var menu = document.getElementById('mobileMenu');

  if (!btn || !menu) return;

  var HAMBURGER =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
    '<line x1="4" y1="6" x2="20" y2="6"/>' +
    '<line x1="4" y1="12" x2="20" y2="12"/>' +
    '<line x1="4" y1="18" x2="20" y2="18"/>' +
    '</svg>';

  var CLOSE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
    '<line x1="18" y1="6" x2="6" y2="18"/>' +
    '<line x1="6" y1="6" x2="18" y2="18"/>' +
    '</svg>';

  function setOpen(open) {
    menu.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.innerHTML = open ? CLOSE : HAMBURGER;
  }

  btn.addEventListener('click', function () {
    setOpen(!menu.classList.contains('open'));
  });

  /* Close the menu after a link is clicked. */
  menu.addEventListener('click', function (event) {
    if (event.target.closest('a')) {
      setOpen(false);
    }
  });

  /* Close the mobile menu when Escape is pressed. */
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      setOpen(false);
    }
  });
})();


/* ---------- 2. Countdown ---------- */

(function () {
  var box = document.getElementById('countdown');

  if (!box) return;

  var cells = box.querySelectorAll('div');

  if (cells.length < 4) return;

  /* MARCH 20, 2027, at 09:00 GMT+3. */
  var target = new Date('2027-03-20T09:00:00+03:00').getTime();

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function tick() {
    var diff = Math.max(0, target - Date.now());

    var values = [
      pad(Math.floor(diff / 864e5)),       // Days
      pad(Math.floor(diff / 36e5) % 24),   // Hours
      pad(Math.floor(diff / 6e4) % 60),    // Minutes
      pad(Math.floor(diff / 1e3) % 60)     // Seconds
    ];

    for (var i = 0; i < 4; i++) {
      if (cells[i].firstChild) {
        cells[i].firstChild.nodeValue = values[i];
      } else {
        cells[i].textContent = values[i];
      }
    }
  }

  tick();

  window.setInterval(tick, 1000);
})();


/* ---------- 3. Active Navigation Link ---------- */

(function () {
  var main = document.querySelector('main[data-page]');

  if (!main) return;

  var currentPage = main.dataset.page;

  var links = document.querySelectorAll(
    '.nav-links a[data-page], .mobile-menu a[data-page]'
  );

  links.forEach(function (link) {
    var isActive = link.dataset.page === currentPage;

    link.classList.toggle('active', isActive);

    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
})();


/* ---------- 4. Scroll Reveal ---------- */

(function () {
  var root = document.documentElement;

  /* i18n.js sets js-reveal unless the visitor prefers reduced motion. */
  if (!root.classList.contains('js-reveal') || !('IntersectionObserver' in window)) return;

  var SELECTORS = [
    '.pres-photo', '.pres-body',
    '.venue-info', '.venue-map',
    '.sponsors-title', '.sponsors-viewport',
    '.footer-inner > *',
    '.page-title', '.content-section', '.info-card', '.committee-card',
    '.team-card', '.info-panel', '.faq-item', '.faq-note', '.committee-cta'
  ].join(',');

  var found = Array.prototype.slice.call(document.querySelectorAll(SELECTORS));

  /* skip anything that sits inside another animated block */
  var items = found.filter(function (el) {
    return !found.some(function (other) { return other !== el && other.contains(el); });
  });

  if (!items.length) return;

  /* siblings enter one after another */
  var seen = new Map();
  items.forEach(function (el) {
    var n = seen.get(el.parentNode) || 0;
    seen.set(el.parentNode, n + 1);
    el.style.setProperty('--reveal-delay', (Math.min(n, 5) * 0.08).toFixed(2) + 's');
    el.setAttribute('data-reveal', '');
  });

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;

      var el = entry.target;
      observer.unobserve(el);
      el.classList.add('is-visible');

      /* once the animation is over, drop the helper attributes so hover effects etc. are untouched */
      window.setTimeout(function () {
        el.removeAttribute('data-reveal');
        el.classList.remove('is-visible');
        el.style.removeProperty('--reveal-delay');
      }, 1200);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  items.forEach(function (el) { observer.observe(el); });
})();

