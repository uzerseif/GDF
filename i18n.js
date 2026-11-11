/* =========================================
   GDF'27 — language switcher (English / العربية / Türkçe)
   - English is the default and is written directly in the HTML.
   - Elements carry data-i18n="key" (text), data-i18n-html (text with <br>)
     or data-i18n-attr="alt:key;aria-label:key" (attributes).
   - The dictionary lives in translations.js (window.GDF_TRANSLATIONS).
   - The chosen language is remembered in localStorage.
   ========================================= */
(function () {
  var STORAGE_KEY = 'iysg-lang';
  var LANGS = {
    en: { dir: 'ltr', code: 'EN' },
    ar: { dir: 'rtl', code: 'AR' },
    tr: { dir: 'ltr', code: 'TR' }
  };
  var root = document.documentElement;

  /* Scroll-reveal is enabled early (before first paint) and only when motion is allowed. */
  try {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) root.classList.add('js-reveal');
  } catch (e) { /* ignore */ }

  function savedLang() {
    try {
      var v = window.localStorage.getItem(STORAGE_KEY);
      return LANGS[v] ? v : 'en';
    } catch (e) { return 'en'; }
  }

  var current = savedLang();

  /* Arabic web font: fetched only when needed, with early connection hints. */
  function ensureArabicFont() {
    if (document.getElementById('gdf-ar-font')) return;
    var head = document.head || document.documentElement;
    [['https://fonts.googleapis.com', false], ['https://fonts.gstatic.com', true]].forEach(function (c) {
      var p = document.createElement('link');
      p.rel = 'preconnect'; p.href = c[0];
      if (c[1]) p.crossOrigin = 'anonymous';
      head.appendChild(p);
    });
    var l = document.createElement('link');
    l.id = 'gdf-ar-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;600;700;800&display=swap';
    head.appendChild(l);
  }
  if (current === 'ar') ensureArabicFont();

  /* Set language + direction immediately (before the page paints) so RTL never flashes as LTR. */
  root.lang = current;
  root.dir = LANGS[current].dir;
  if (current !== 'en') root.classList.add('i18n-pending');

  /* ---------- translate the page ---------- */
  function translate(lang) {
    var dict = (window.GDF_TRANSLATIONS && window.GDF_TRANSLATIONS[lang]) || {};

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var asHtml = el.hasAttribute('data-i18n-html');
      if (el._i18nOrig === undefined) el._i18nOrig = asHtml ? el.innerHTML : el.textContent;
      var value = (lang !== 'en' && dict[el.getAttribute('data-i18n')]) || el._i18nOrig;
      if (asHtml) el.innerHTML = value; else el.textContent = value;
    });

    document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      if (!el._i18nAttrOrig) el._i18nAttrOrig = {};
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var bits = pair.split(':');
        var attr = bits[0].trim(), key = bits[1] && bits[1].trim();
        if (!attr || !key) return;
        if (el._i18nAttrOrig[attr] === undefined) el._i18nAttrOrig[attr] = el.getAttribute(attr) || '';
        el.setAttribute(attr, (lang !== 'en' && dict[key]) || el._i18nAttrOrig[attr]);
      });
    });
  }

  function setLanguage(lang, persist) {
    if (!LANGS[lang]) lang = 'en';
    current = lang;
    if (lang === 'ar') ensureArabicFont();
    root.lang = lang;
    root.dir = LANGS[lang].dir;
    translate(lang);
    if (persist) {
      try { window.localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* private mode: ignore */ }
    }
    var label = document.getElementById('langCurrent');
    if (label) label.textContent = LANGS[lang].code;
    document.querySelectorAll('.lang-option').forEach(function (btn) {
      var on = btn.getAttribute('data-lang') === lang;
      if (on) btn.setAttribute('aria-current', 'true'); else btn.removeAttribute('aria-current');
    });
    /* Lets page scripts (e.g. committee-detail.js) refresh text they build themselves. */
    document.dispatchEvent(new CustomEvent('iysg:languagechange', { detail: { lang: lang } }));
  }

  /* ---------- dropdown behaviour ---------- */
  function initSwitcher() {
    var box = document.getElementById('langSwitch');
    var btn = document.getElementById('langBtn');
    if (!box || !btn) return;

    function setOpen(open) {
      box.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var willOpen = !box.classList.contains('open');
      /* never leave the hamburger menu open underneath the language menu (close it first) */
      var menuBtn = document.getElementById('menuBtn');
      if (willOpen && menuBtn && menuBtn.getAttribute('aria-expanded') === 'true') menuBtn.click();
      setOpen(willOpen);
    });

    box.addEventListener('click', function (e) {
      var option = e.target.closest('.lang-option');
      if (!option) return;
      setLanguage(option.getAttribute('data-lang'), true);
      setOpen(false);
      btn.focus();
    });

    document.addEventListener('click', function (e) { if (!box.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && box.classList.contains('open')) { setOpen(false); btn.focus(); }
    });
    var menuBtn = document.getElementById('menuBtn');
    if (menuBtn) menuBtn.addEventListener('click', function () { setOpen(false); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    try {
      initSwitcher();
      setLanguage(current, false);
    } finally {
      root.classList.remove('i18n-pending');
    }
  });

  window.GDF_setLanguage = function (lang) { setLanguage(lang, true); };
})();
