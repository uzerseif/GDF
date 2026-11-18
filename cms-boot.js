/* GDF'27 CMS — boot (runs synchronously in <head>, before first paint).
   Applies the last saved design tokens and hidden sections from the local cache so
   visitors do not see a flash of the old design; cms-public.js refreshes it from Supabase. */
(function () {
  "use strict";
  var CACHE_KEY = "gdf-cms-cache-v1";
  var root = document.documentElement;
  var TOKENS = {
    primary: ["--maroon", "--maroon-deep"],
    gold: ["--gold", "--mustard"],
    secondary: ["--ivory"],
    background: ["--cream"],
    text: ["--ink"],
    heading: ["--cms-heading"],
    surface: ["--cms-surface"],
    border: ["--cms-border"],
    button_bg: ["--cms-btn-bg"],
    button_text: ["--cms-btn-text"],
    radius: ["--cms-radius"],
    section_y: ["--section-y"],
    font_body: ["--cms-font-body"],
    font_heading: ["--cms-font-heading"],
    font_size: ["--cms-font-size"]
  };
  var FONTS = {
    "Inter": "Inter:wght@400;500;600;700",
    "Playfair Display": "Playfair+Display:wght@500;600;700",
    "Cormorant Garamond": "Cormorant+Garamond:wght@500;600;700",
    "Montserrat": "Montserrat:wght@400;500;600;700",
    "Lora": "Lora:wght@400;500;600;700",
    "Poppins": "Poppins:wght@400;500;600;700",
    "Merriweather": "Merriweather:wght@400;700",
    "Cairo": "Cairo:wght@400;500;600;700",
    "Tajawal": "Tajawal:wght@400;500;700"
  };
  var safeColor = function (v) { return typeof v === "string" && /^#[0-9a-fA-F]{3,8}$|^rgba?\([\d\s.,%]+\)$/.test(v) ? v : ""; };
  var safeLen = function (v) { return typeof v === "string" && /^\d{1,3}(\.\d+)?(px|rem|em|%)$/.test(v) ? v : (typeof v === "number" ? v + "px" : ""); };
  var safeFont = function (v) { return typeof v === "string" && /^[A-Za-z0-9 ,'"-]{1,80}$/.test(v) ? v : ""; };

  function styleEl(id) {
    var el = document.getElementById(id);
    if (!el) { el = document.createElement("style"); el.id = id; (document.head || root).appendChild(el); }
    return el;
  }

  function loadFont(name) {
    var fam = FONTS[name];
    if (!fam || document.getElementById("gdf-font-" + name.replace(/\W/g, ""))) return;
    var l = document.createElement("link");
    l.id = "gdf-font-" + name.replace(/\W/g, ""); l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=" + fam + "&display=swap";
    (document.head || root).appendChild(l);
  }

  /* Design tokens -> CSS variables + a few rules that use them. */
  function applyTheme(t) {
    t = t || {};
    var vars = [], rules = [];
    Object.keys(TOKENS).forEach(function (k) {
      var v = t[k]; if (v === undefined || v === null || v === "") return;
      var ok = /font_(body|heading)/.test(k) ? safeFont(v) : (k === "radius" || k === "section_y" || k === "font_size") ? safeLen(v) : safeColor(v);
      if (!ok) return;
      if (/font_(body|heading)/.test(k)) { loadFont(ok); ok = '"' + ok + '", Arial, Helvetica, sans-serif'; }
      TOKENS[k].forEach(function (name) { vars.push(name + ":" + ok); });
    });
    if (t.font_body) rules.push('html:not([lang="ar"]) body{font-family:var(--cms-font-body)}');
    if (t.font_heading) rules.push('html:not([lang="ar"]) :is(h1,h2,h3,.page-title){font-family:var(--cms-font-heading)}');
    if (t.font_size) rules.push("body{font-size:var(--cms-font-size)}");
    if (t.heading) rules.push(":is(.page-title,.content-section h2,.info-panel h2,.faq-title,.venue-title,.pres-hello){color:var(--cms-heading)}");
    if (t.surface) rules.push(":is(.info-card,.vmca-card,.faq-item,.info-panel,.committee-card){background-color:var(--cms-surface)}");
    if (t.border) rules.push(":is(.info-card,.vmca-card,.faq-item,.info-panel,.committee-card){border-color:var(--cms-border)}");
    if (t.button_bg) rules.push(":is(.cta,.pres-btn,.venue-maps-btn,.action-link,.msg-back){background-color:var(--cms-btn-bg);border-color:var(--cms-btn-bg)}");
    if (t.button_text) rules.push(":is(.cta,.pres-btn,.venue-maps-btn,.action-link,.msg-back){color:var(--cms-btn-text)}");
    if (t.radius) rules.push(":is(.cta,.pres-btn,.venue-maps-btn,.action-link,.msg-back,.info-card,.vmca-card,.info-panel,.sponsor-card,.committee-card){border-radius:var(--cms-radius)}");
    if (t.button_style === "outline") rules.push(":is(.cta,.pres-btn,.venue-maps-btn,.action-link){background-color:transparent!important;border:2px solid currentColor}");
    if (t.button_style === "pill") rules.push(":is(.cta,.pres-btn,.venue-maps-btn,.action-link,.msg-back){border-radius:999px}");
    if (t.button_style === "square") rules.push(":is(.cta,.pres-btn,.venue-maps-btn,.action-link,.msg-back){border-radius:0}");
    styleEl("gdf-cms-theme").textContent = (vars.length ? ":root{" + vars.join(";") + "}\n" : "") + rules.join("\n");
  }

  /* Section visibility + per-section colours/spacing (page_sections rows). */
  function applySectionStyles(sections) {
    var css = [];
    (sections || []).forEach(function (s) {
      var sel = '[data-cms-section="' + s.page + ":" + s.section_key + '"]';
      if (!/^[a-z0-9-]+$/.test(s.page + s.section_key)) return;
      if (s.is_visible === false) { css.push(sel + "{display:none!important}"); return; }
      var st = (s.settings && s.settings.style) || {}, d = [];
      if (safeColor(st.bg)) d.push("background:" + safeColor(st.bg) + "!important");
      if (safeColor(st.text)) d.push("color:" + safeColor(st.text) + "!important");
      if (safeLen(st.pad_y)) d.push("padding-top:" + safeLen(st.pad_y) + "!important;padding-bottom:" + safeLen(st.pad_y) + "!important");
      if (d.length) css.push(sel + "{" + d.join(";") + "}");
      if (safeColor(st.text)) css.push(sel + " :is(h1,h2,h3,p,li,span,strong,a:not(.cta):not(.pres-btn):not(.venue-maps-btn):not(.action-link)){color:inherit}");
    });
    styleEl("gdf-cms-sections").textContent = css.join("\n");
  }

  window.GDF_CMS_BOOT = { CACHE_KEY: CACHE_KEY, applyTheme: applyTheme, applySectionStyles: applySectionStyles, safeColor: safeColor };

  try {
    var cache = JSON.parse(window.localStorage.getItem(CACHE_KEY) || "null");
    if (cache) {
      if (cache.settings) applyTheme(cache.settings["theme.tokens"]);
      applySectionStyles(cache.sections);
      window.GDF_CMS_TEXTS = cache.textMap || {};
      if (cache.settings && cache.settings["event.start"]) window.GDF_EVENT_START = cache.settings["event.start"];
    }
  } catch (e) { /* no cache / private mode */ }
})();
