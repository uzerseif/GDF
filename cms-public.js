/* =====================================================================
   GDF'27 — public CMS integration
   Reads published content from Supabase (anon / publishable key only) and
   applies it to the existing pages. If the CMS is unreachable or a value is
   empty, the original HTML content stays in place.
     site_texts    -> every [data-i18n] text (EN / AR / TR)
     page_sections -> visibility, order, colours, images, links, lists
     site_settings -> design tokens (theme.tokens) and countdown (event.start)
     committees / faqs / applications / sponsors / team_* -> lists
   ===================================================================== */
(function () {
  "use strict";
  var cfg = window.GDF_SUPABASE || {}, BOOT = window.GDF_CMS_BOOT || {};
  var pathname = location.pathname;
  var file = (pathname.replace(/\/+$/, "").split("/").pop() || "index.html").toLowerCase();
  var isDirectoryUrl = /\/$/.test(pathname);
  var PAGE = {
    "index.html": "home", "": "home", "about": "about", "about-us.html": "about",
    "applications": "applications", "applications.html": "applications",
    "president": "president", "message-from-president.html": "president",
    "team": "team", "our-team.html": "team",
    "committees": "committees", "committees.html": "committees",
    "committee": "committees", "committee-detail.html": "committees",
    "faq": "faq", "faq.html": "faq", "verify": "verify", "verify.html": "verify",
    "certificate": "certificate", "certificate.html": "certificate"
  }[isDirectoryUrl && !/^(about|applications|president|team|committees|committee|faq|verify|certificate)$/i.test(file) ? "index.html" : file] || "other";
  var PREVIEW = /[?&]cms-preview=1/.test(location.search) && window.parent !== window;

  var db = null;
  try {
    if (window.supabase && cfg.url && cfg.key) {
      db = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    }
  } catch (e) { db = null; }

  /* ---------------- helpers ---------------- */
  var lang = function () { return document.documentElement.lang || "en"; };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var tx = function (o) { return o && typeof o === "object" ? (o[lang()] || o.en || "") : (o || ""); };
  var safeUrl = function (u) {
    u = String(u || "").trim();
    if (!u) return "";
    if (/^(https?:|mailto:|tel:|#)/i.test(u)) return u;
    if (/^[a-z0-9._~\/-]+(\.[a-z0-9]+)?([?#][^\s"'<>]*)?$/i.test(u) && !/^javascript/i.test(u)) {
      var path = u.split(/[?#]/)[0], suffix = u.slice(path.length);
      var cleanRoutes = {
        "index.html": "./", "about-us.html": "about/", "applications.html": "applications/",
        "committees.html": "committees/", "committee-detail.html": "committee/",
        "message-from-president.html": "president/", "our-team.html": "team/",
        "faq.html": "faq/", "verify.html": "verify/", "certificate.html": "certificate/",
        "admin.html": "admin/"
      };
      return (cleanRoutes[path.toLowerCase()] || path) + suffix;
    }
    return "";
  };
  var $$ = function (sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); };
  var cms = function (name) { return $$('[data-cms="' + name + '"]'); };
  function T(key, en) {
    var o = (window.GDF_CMS_TEXTS || {})[key], l = lang(), d = (window.GDF_TRANSLATIONS || {})[l] || {};
    return (o && o[l]) || (l !== "en" && d[key]) || (o && o.en) || en;
  }
  function setImg(name, url) {
    url = safeUrl(url);
    cms(name).forEach(function (el) {
      var img = el.tagName === "IMG" ? el : el.querySelector("img");
      if (!img) return;
      if (url) {
        if (img.getAttribute("src") !== url) img.setAttribute("src", url);
        if (el.hasAttribute("data-cms-optional") || el.hidden) { el.hidden = false; el.setAttribute("data-cms-optional", ""); }
      } else if (el.hasAttribute("data-cms-optional")) el.hidden = true;
    });
  }
  function setLink(name, href) {
    href = safeUrl(href);
    if (href) cms(name).forEach(function (a) { a.setAttribute("href", href); });
  }
  function setText(name, value) {
    if (value) cms(name).forEach(function (el) { el.textContent = value; });
  }
  function show(el, on) { if (el) el.style.display = on === false ? "none" : ""; }
  function telHref(p) { return "tel:" + String(p || "").replace(/[^\d+]/g, ""); }

  /* ---------------- state ---------------- */
  var state = { textMap: {}, sections: [], settings: {} };
  var lists = {};
  function sec(page, key) {
    for (var i = 0; i < state.sections.length; i++) {
      var s = state.sections[i];
      if (s.page === page && s.section_key === key) return s;
    }
    return null;
  }
  function settingsOf(page, key) { var s = sec(page, key); return (s && s.settings) || {}; }

  /* ---------------- global: header + footer ---------------- */
  function applyHeader() {
    var s = settingsOf("global", "header");
    setImg("header-logo", s.logo_url);
    $$('header .brand span[data-i18n="brand.name"]').forEach(function (el) { show(el, s.show_name !== false); });
    if (Array.isArray(s.nav) && s.nav.length) {
      [".nav-links", "#mobileMenu"].forEach(function (sel) {
        var ul = document.querySelector("header " + sel);
        if (!ul) return;
        $$("li[data-cms-custom]", ul).forEach(function (li) { li.remove(); });
        s.nav.forEach(function (item) {
          if (!item) return;
          var li;
          if (item.page && !/^custom-/.test(item.page)) {
            var a = ul.querySelector('a[data-page="' + item.page + '"]');
            li = a && a.closest("li");
            if (li && item.href && safeUrl(item.href)) a.setAttribute("href", safeUrl(item.href));
          } else if (tx(item.label) && safeUrl(item.href)) {
            li = document.createElement("li");
            li.setAttribute("data-cms-custom", "");
            li.innerHTML = '<a href="' + esc(safeUrl(item.href)) + '"' + (item.new_tab ? ' target="_blank" rel="noopener noreferrer"' : "") + ">" + esc(tx(item.label)) + "</a>";
          }
          if (!li) return;
          ul.appendChild(li);
          li.style.display = item.visible === false ? "none" : "";
        });
      });
    }
  }

  var ICONS = {
    instagram: '<rect height="20" rx="5" width="20" x="2" y="2"></rect><circle cx="12" cy="12" r="4"></circle><line x1="17.5" x2="17.5" y1="6.5" y2="6.5"></line>',
    facebook: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>',
    x: '<path d="M4 4l16 16M20 4L4 20"></path>',
    linkedin: '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle>',
    youtube: '<path d="M22.5 6.4a2.8 2.8 0 0 0-2-2C18.8 4 12 4 12 4s-6.8 0-8.5.4a2.8 2.8 0 0 0-2 2A29 29 0 0 0 1 12a29 29 0 0 0 .5 5.6 2.8 2.8 0 0 0 2 2c1.7.4 8.5.4 8.5.4s6.8 0 8.5-.4a2.8 2.8 0 0 0 2-2A29 29 0 0 0 23 12a29 29 0 0 0-.5-5.6z"></path><polygon points="10 15 15 12 10 9 10 15"></polygon>',
    tiktok: '<path d="M9 12a4 4 0 1 0 4 4V2a5 5 0 0 0 5 5"></path>',
    whatsapp: '<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.5A8.4 8.4 0 1 1 21 11.5z"></path>',
    website: '<circle cx="12" cy="12" r="10"></circle><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"></path>'
  };
  function socialLink(s) {
    var href = safeUrl(s.url);
    if (!href) return "";
    var icon = ICONS[s.platform] || ICONS.website;
    return '<a class="insta" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer"><svg fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">' + icon + "</svg>" + esc(tx(s.label) || s.platform || "") + "</a>";
  }
  function applyFooter() {
    var s = settingsOf("global", "footer");
    setImg("footer-logo", s.logo_url);
    setText("footer-address", s.address);
    if (s.email) cms("footer-email").forEach(function (a) { a.textContent = s.email; a.setAttribute("href", "mailto:" + s.email); });
    if (Array.isArray(s.phones) && s.phones.length) {
      cms("footer-phones").forEach(function (li) {
        var label = li.querySelector('[data-i18n="lbl.phone"]');
        $$("a, .cms-sep", li).forEach(function (n) { n.remove(); });
        [].slice.call(li.childNodes).forEach(function (n) { if (n.nodeType === 3 && n.textContent.trim() === "|") n.remove(); });
        s.phones.filter(Boolean).forEach(function (p, i) {
          if (i) { var sep = document.createElement("span"); sep.className = "cms-sep"; sep.textContent = " | "; li.appendChild(sep); }
          var a = document.createElement("a");
          a.className = "tel"; a.dir = "ltr"; a.href = telHref(p); a.textContent = p;
          li.appendChild(document.createTextNode(" ")); li.appendChild(a);
        });
        if (label && li.firstChild !== label) li.insertBefore(label, li.firstChild);
      });
    }
    if (Array.isArray(s.socials)) {
      cms("footer-follow").forEach(function (col) {
        $$("a", col).forEach(function (a) { a.remove(); });
        col.insertAdjacentHTML("beforeend", s.socials.map(socialLink).join(""));
      });
    }
    cms("footer-quick").forEach(function (el) { show(el, s.show_quick !== false); });
    cms("footer-follow").forEach(function (el) { show(el, s.show_social !== false); });
    $$("footer .footer-contact").forEach(function (el) { show(el, s.show_contact !== false); });
    cms("footer-credit").forEach(function (el) { show(el, s.show_credit !== false); });
    $$('footer .footer-brand span[data-i18n="brand.name"]').forEach(function (el) { show(el, s.show_name !== false); });
  }

  /* ---------------- home ---------------- */
  function applyHome() {
    var h = settingsOf("home", "hero");
    setImg("hero-emblem", h.emblem_url);
    var hero = document.querySelector('[data-cms-section="home:hero"]');
    if (hero) {
      var bg = safeUrl(h.bg_image_url);
      hero.style.backgroundImage = bg ? 'url("' + bg.replace(/"/g, "%22") + '")' : "";
      hero.style.backgroundSize = bg ? "cover" : "";
      hero.style.backgroundPosition = bg ? "center" : "";
      cms("hero-video").forEach(function (v) {
        var off = h.use_video === false;
        v.style.display = off ? "none" : "";
        if (off && v.pause) v.pause();
      });
      var ov = cms("hero-overlay")[0];
      if (ov) {
        var c = BOOT.safeColor && BOOT.safeColor(h.overlay_color);
        var op = h.overlay_opacity === undefined || h.overlay_opacity === "" ? null : Math.max(0, Math.min(100, +h.overlay_opacity));
        ov.style.background = c ? "color-mix(in oklab, " + c + " " + (op === null ? 50 : op) + "%, transparent)" : (op === null ? "" : "color-mix(in oklab, var(--maroon) " + op + "%, transparent)");
      }
    }
    cms("hero-countdown").forEach(function (el) { show(el, h.show_countdown !== false); });
    $$('[data-cms-section="home:hero"] .cta-row').forEach(function (el) { show(el, h.show_buttons !== false); });
    setLink("hero-cta1", h.cta1_href);
    setLink("hero-cta2", h.cta2_href);

    var v = settingsOf("home", "venue");
    setText("venue-address", v.address);
    if (v.email) cms("venue-email").forEach(function (a) { a.textContent = v.email; a.href = "mailto:" + v.email; });
    if (v.phone) cms("venue-phone").forEach(function (a) { a.textContent = v.phone; a.href = telHref(v.phone); });
    setLink("venue-maps", v.maps_url);
    var emb = safeUrl(v.embed_url);
    if (emb && /^https:\/\/(www\.)?google\.[a-z.]+\/maps\/embed/i.test(emb)) cms("venue-embed").forEach(function (f) { if (f.getAttribute("src") !== emb) f.src = emb; });
    $$(".venue-map").forEach(function (el) { show(el, v.show_map !== false); });
    setImg("venue-photo", v.photo_url);
  }

  function applyPresident() {
    var p = settingsOf("home", "president");
    setImg("pres-photo", p.photo_url);
    setImg("pres-signature", p.signature_url);
    setLink("pres-btn", p.button_href);
    cms("pres-btn").forEach(function (el) { show(el, p.show_button !== false); });
    $$(".pres").forEach(function (el) { el.classList.toggle("cms-photo-right", p.photo_position === "right"); });
    $$(".pres-photo").forEach(function (el) { show(el, p.show_photo !== false); });
  }

  /* ---------------- section order + optional section images ---------------- */
  function reorder(page) {
    var els = $$('[data-cms-section^="' + page + ':"]');
    if (els.length < 2) return;
    var parent = els[0].parentNode;
    if (!els.every(function (e) { return e.parentNode === parent; })) return;
    var units = els.map(function (el, i) {
      var key = el.getAttribute("data-cms-section").split(":")[1], row = sec(page, key);
      var prev = el.previousElementSibling, rule = prev && prev.classList.contains("gold-rule") && i > 0 ? prev : null;
      if (rule) rule.style.display = row && row.is_visible === false ? "none" : "";
      return { el: el, rule: rule, order: row ? row.sort_order : i, i: i };
    });
    var sorted = units.slice().sort(function (a, b) { return a.order - b.order || a.i - b.i; });
    if (sorted.every(function (u, i) { return u === units[i]; })) return;
    var anchor = units[units.length - 1].el.nextSibling;
    sorted.forEach(function (u) {
      if (u.rule) parent.insertBefore(u.rule, anchor);
      parent.insertBefore(u.el, anchor);
    });
  }
  function sectionImages() {
    $$("[data-cms-section]").forEach(function (el) {
      var parts = el.getAttribute("data-cms-section").split(":"), s = settingsOf(parts[0], parts[1]);
      var fig = el.querySelector(":scope > .cms-section-image"), url = safeUrl(s.image_url);
      if (!url || /^(home|global|team):/.test(parts.join(":"))) { if (fig) fig.remove(); return; }
      if (!fig) { fig = document.createElement("figure"); fig.className = "cms-section-image"; fig.innerHTML = '<img alt="" loading="lazy">'; el.appendChild(fig); }
      fig.firstChild.src = url;
      fig.className = "cms-section-image is-" + (s.image_position === "top" ? "top" : "bottom");
      if (s.image_position === "top") el.insertBefore(fig, el.children[1] || null);
    });
  }

  /* ---------------- about ---------------- */
  function applyAbout() {
    var b = settingsOf("about", "behind");
    if (Array.isArray(b.partners) && b.partners.length) {
      cms("about-partners").forEach(function (box) {
        box.innerHTML = b.partners.map(function (p) {
          var href = safeUrl(p.url), name = esc(tx(p.name)), open = href ? '<a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' : "", close = href ? "</a>" : "";
          return '<figure class="partner"><div class="partner-logo">' + open + (safeUrl(p.logo_url) ? '<img src="' + esc(safeUrl(p.logo_url)) + '" alt="' + name + '" loading="lazy"/>' : "") + close + '</div><figcaption class="partner-name">' + open + name + close + "</figcaption></figure>";
        }).join("");
      });
    }
    var a = settingsOf("about", "vmca");
    if (Array.isArray(a.aims) && a.aims.length) {
      cms("about-aims").forEach(function (ul) { ul.innerHTML = a.aims.map(function (x) { return "<li>" + esc(tx(x)) + "</li>"; }).join(""); });
    }
  }

  /* ---------------- applications page ---------------- */
  function applyApplicationInfo() {
    var s = settingsOf("applications", "info");
    var ul = cms("app-info-list")[0];
    if (ul && Array.isArray(s.bullets) && s.bullets.length) {
      $$("li:not(.protocol-item)", ul).forEach(function (li) { li.remove(); });
      var proto = ul.querySelector(".protocol-item");
      s.bullets.forEach(function (x) {
        if (!tx(x)) return;
        var li = document.createElement("li"); li.textContent = tx(x);
        ul.insertBefore(li, proto);
      });
    }
    setLink("app-protocol", s.protocol_url);
    cms("app-protocol").forEach(function (a) {
      var li = a.closest("li");
      if (safeUrl(s.protocol_url) && !/^#/.test(s.protocol_url)) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
      show(li, s.show_protocol !== false);
    });
  }

  /* ---------------- lists from tables ---------------- */
  function read(table, order) {
    if (!db) return Promise.resolve(null);
    var q = db.from(table).select("*");
    if (table !== "team_placements") q = q.eq("is_published", true);
    (order || ["sort_order"]).forEach(function (o) { q = q.order(o); });
    return q.then(function (r) {
      if (r.error) { console.warn("GDF CMS:", table, r.error.message); return null; }
      return r.data || [];
    }, function () { return null; });
  }

  function renderCommittees() {
    var data = lists.committees;
    if (!data || !data.length) return;
    var grid = document.querySelector(".committee-grid");
    var more = { en: "Explore committee →", ar: "استكشف اللجنة ←", tr: "Komiteyi keşfet →" }[lang()] || "Explore committee →";
    if (grid) grid.innerHTML = data.map(function (c) {
      return '<a class="committee-card" href="committee/?id=' + encodeURIComponent(c.slug) + '"><div class="committee-poster"><img src="' + esc(safeUrl(c.image_url)) + '" alt="' + esc(tx(c.image_alt) || tx(c.name)) + '" loading="lazy"></div><div class="committee-copy"><h2>' + esc(tx(c.name)) + "</h2><p>" + esc(tx(c.short_desc)) + '</p><span class="card-more">' + more + "</span></div></a>";
    }).join("");
    var slug = new URLSearchParams(location.search).get("id"), article = document.querySelector(".committee-detail-wrap");
    if (article && slug) {
      var c = data.filter(function (x) { return x.slug === slug; })[0];
      var a = article.querySelector(".committee-detail");
      if (!c || !a) return;
      a.hidden = false; a.dataset.committee = c.slug;
      var img = a.querySelector(".committee-detail-image img");
      if (img) { img.src = safeUrl(c.image_url); img.alt = tx(c.image_alt) || tx(c.name); }
      var L = { en: ["About the Committee", "What to Expect"], ar: ["عن اللجنة", "ماذا تتوقع؟"], tr: ["Komite Hakkında", "Neler Beklenmeli?"] }[lang()] || ["About the Committee", "What to Expect"];
      var copy = a.querySelector(".committee-detail-copy");
      if (copy) copy.innerHTML = '<h1 class="page-title">' + esc(tx(c.name)) + "</h1><p>" + esc(tx(c.short_desc)) + "</p>" + (tx(c.about) ? "<h2>" + L[0] + "</h2><p>" + esc(tx(c.about)) + "</p>" : "") + (tx(c.expect) ? "<h2>" + L[1] + "</h2><p>" + esc(tx(c.expect)) + "</p>" : "");
      document.title = tx(c.name) + " | GDF’27";
    }
  }

  function renderFaqs() {
    var data = lists.faqs, list = document.querySelector(".faq-list");
    if (!data || !data.length || !list) return;
    list.innerHTML = data.map(function (f) {
      return '<details class="faq-item"><summary>' + esc(tx(f.question)) + "</summary><p>" + esc(tx(f.answer)) + "</p>" + (safeUrl(f.link_url) ? '<a class="action-link" href="' + esc(safeUrl(f.link_url)) + '">' + esc(tx(f.link_label) || "Learn more") + " →</a>" : "") + "</details>";
    }).join("");
    var items = list.querySelectorAll(".faq-item");
    [].forEach.call(items, function (item) {
      item.addEventListener("toggle", function () { if (item.open) [].forEach.call(items, function (o) { if (o !== item) o.open = false; }); });
    });
  }

  function renderApplications() {
    var data = lists.applications, wrap = document.querySelector(".page-cards");
    if (!data || !data.length || !wrap) return;
    var now = Date.now();
    var closed = { en: "Applications closed", ar: "التقديم غير متاح", tr: "Başvurular kapalı" }[lang()] || "Applications closed";
    var soon = { en: "Opens soon", ar: "يفتح قريباً", tr: "Yakında açılacak" }[lang()] || "Opens soon";
    wrap.innerHTML = data.map(function (a) {
      var opened = !a.opens_at || new Date(a.opens_at).getTime() <= now, notClosed = !a.closes_at || new Date(a.closes_at).getTime() >= now, active = opened && notClosed && safeUrl(a.form_url);
      var label = active ? (tx(a.button_label) || T("app.apply_now", "Apply Now")) : (opened ? closed : soon);
      var img = safeUrl(a.image_url);
      return '<article class="info-card"' + (img ? ' style="background-image:url(&quot;' + esc(img) + '&quot;)"' : "") + "><h2>" + esc(tx(a.title)) + "</h2>" + (tx(a.description) ? "<p>" + esc(tx(a.description)) + "</p>" : "") + '<a class="action-link" ' + (active ? 'href="' + esc(safeUrl(a.form_url)) + '" target="_blank" rel="noopener noreferrer"' : 'aria-disabled="true"') + "><bdi>" + esc(label) + '</bdi><span aria-hidden="true">&nearrow;</span></a></article>';
    }).join("");
  }

  function renderSponsors() {
    var data = lists.sponsors, box = document.querySelector("#sponsors .sponsors-container");
    if (!data || !data.length || !box) return;
    var s = settingsOf("home", "sponsors"), cats = Array.isArray(s.categories) && s.categories.length ? s.categories : [{ slug: "sponsor" }, { slug: "partner" }, { slug: "media" }];
    var known = cats.map(function (c) { return c.slug; });
    data.forEach(function (x) { if (known.indexOf(x.category) < 0) { known.push(x.category); cats.push({ slug: x.category }); } });
    var showTitles = s.show_category_titles === true;
    var card = function (x) {
      var href = safeUrl(x.website_url), img = '<img src="' + esc(safeUrl(x.logo_url)) + '" alt="' + esc(x.name) + '" loading="lazy">';
      return '<div class="sponsor-card"' + (x.tier ? ' data-tier="' + esc(x.tier) + '"' : "") + ">" + (href ? '<a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + img + "</a>" : img) + "</div>";
    };
    $$(".sponsors-category", box).forEach(function (el) { el.remove(); });
    box.insertAdjacentHTML("beforeend", cats.map(function (c) {
      var items = data.filter(function (x) { return x.category === c.slug; });
      if (!items.length) return "";
      return '<div class="sponsors-category">' + (showTitles && tx(c.label) ? '<h3 class="sponsors-category-title">' + esc(tx(c.label)) + "</h3>" : "") + '<div class="sponsors-grid">' + items.map(card).join("") + "</div></div>";
    }).join(""));
  }

  function paragraphs(text) {
    return String(text || "").split(/\n\s*\n/).map(function (p) { return p.trim() ? "<p>" + esc(p.trim()).replace(/\n/g, "<br>") + "</p>" : ""; }).join("");
  }
  function renderTeam() {
    var L = lists.team;
    if (!L || !L.tabs || !L.tabs.length || !L.members) return;
    var tabsEl = document.getElementById("tmTabs"), detail = document.getElementById("tmDetail");
    if (!tabsEl || !detail) return;
    var byId = {}; L.members.forEach(function (m) { byId[m.id] = m; });
    var bios = document.querySelector(".tm-bios");
    $$('[id^="bio-cms-"]', bios || document).forEach(function (n) { n.remove(); });
    tabsEl.innerHTML = L.tabs.map(function (t) {
      return '<button type="button" class="tm-tab" data-tab="' + esc(t.slug) + '" aria-controls="panel-' + esc(t.slug) + '">' + esc(tx(t.title)) + "</button>";
    }).join("");
    $$(".tm-panel", detail).forEach(function (p) { p.remove(); });
    var bioHtml = "";
    var cardHtml = function (p) {
      var m = byId[p.member_id]; if (!m) return "";
      var id = "cms-" + m.id, tba = /^to be announced$/i.test((m.name && m.name.en) || ""), photo = safeUrl(m.photo_url);
      var social = m.social || {}, links = ["instagram", "linkedin", "x", "website", "email"].filter(function (k) { return social[k]; }).map(function (k) {
        var href = k === "email" ? "mailto:" + social[k] : safeUrl(social[k]);
        return href ? '<a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc({ instagram: "Instagram", linkedin: "LinkedIn", x: "X", website: "Website", email: social[k] }[k]) + "</a>" : "";
      }).filter(Boolean).join(" · ");
      bioHtml += '<div id="bio-' + id + '">' + ["en", "ar", "tr"].map(function (l) {
        var b = m.bio && m.bio[l];
        return b || (l === "en" && links) ? '<div lang="' + l + '">' + paragraphs(b) + (links ? '<p class="tm-social">' + links + "</p>" : "") + "</div>" : "";
      }).join("") + "</div>";
      return '<button type="button" class="tm-card' + (tba ? " is-tba" : "") + '" data-bio="' + id + '"><span class="tm-pic">' + (photo ? '<img class="tm-photo" src="' + esc(photo) + '" alt="" loading="lazy" />' : "") + '</span><span class="tm-info"><span class="tm-name"' + (tba ? ' data-i18n="team.tba"' : "") + ">" + esc(tx(m.name)) + '</span><span class="tm-role">' + esc(tx(m.role)) + '</span><span class="tm-view" data-i18n="team.view">' + esc(T("team.view", "View Profile")) + "</span></span></button>";
    };
    L.tabs.forEach(function (t) {
      var groups = (L.groups || []).filter(function (g) { return g.tab_id === t.id; });
      var places = (L.placements || []).filter(function (p) { return p.tab_id === t.id && byId[p.member_id]; });
      var known = {}; groups.forEach(function (g) { known[g.id] = 1; });
      var loose = places.filter(function (p) { return !p.group_id || !known[p.group_id]; });
      var html = '<section class="tm-panel" id="panel-' + esc(t.slug) + '" data-panel="' + esc(t.slug) + '" hidden><div class="tm-phead"><h2>' + esc(tx(t.title)) + "</h2>" + (tx(t.description) ? '<p class="tm-pdesc">' + esc(tx(t.description)) + "</p>" : "") + "</div>";
      var blocks = groups.map(function (g) { return { g: g, items: places.filter(function (p) { return p.group_id === g.id; }) }; });
      if (loose.length) blocks.push({ g: null, items: loose });
      blocks.forEach(function (b) {
        if (!b.items.length && !(b.g && (tx(b.g.title) || tx(b.g.description)))) return;
        html += '<div class="tm-grp">';
        if (b.g && safeUrl(b.g.image_url)) html += '<img class="tm-gimg" src="' + esc(safeUrl(b.g.image_url)) + '" alt="" loading="lazy">';
        if (b.g && tx(b.g.title)) html += '<h3 class="tm-gt">' + esc(tx(b.g.title)) + "</h3>";
        if (b.g && tx(b.g.description)) html += '<p class="tm-gdesc">' + esc(tx(b.g.description)) + "</p>";
        var rows = {}, keys = [];
        b.items.slice().sort(function (x, y) { return x.row_no - y.row_no || x.sort_order - y.sort_order; }).forEach(function (p) {
          if (!rows[p.row_no]) { rows[p.row_no] = []; keys.push(p.row_no); }
          rows[p.row_no].push(p);
        });
        keys.forEach(function (k) { html += '<div class="tm-row' + (rows[k].length === 1 ? " is-center" : "") + '">' + rows[k].map(cardHtml).join("") + "</div>"; });
        html += "</div>";
      });
      detail.insertAdjacentHTML("beforeend", html + "</section>");
    });
    if (bios) bios.insertAdjacentHTML("beforeend", bioHtml);
    document.dispatchEvent(new CustomEvent("gdf:team-rendered"));
  }

  function loadLists() {
    var jobs = [];
    if (PAGE === "committees") jobs.push(read("committees").then(function (d) { lists.committees = d; }));
    if (PAGE === "faq") jobs.push(read("faqs").then(function (d) { lists.faqs = d; }));
    if (PAGE === "applications") jobs.push(read("applications").then(function (d) { lists.applications = d; }));
    if (PAGE === "home") jobs.push(read("sponsors").then(function (d) { lists.sponsors = d; }));
    if (PAGE === "team") jobs.push(Promise.all([read("team_tabs"), read("team_groups", ["tab_id", "sort_order"]), read("team_placements", ["row_no", "sort_order"]), read("team_members")]).then(function (r) {
      lists.team = r[0] && r[2] && r[3] ? { tabs: r[0], groups: r[1] || [], placements: r[2], members: r[3] } : null;
    }));
    return Promise.all(jobs);
  }

  /* ---------------- apply everything ---------------- */
  function applyAll() {
    window.GDF_CMS_TEXTS = state.textMap;
    if (BOOT.applyTheme) BOOT.applyTheme(state.settings["theme.tokens"]);
    if (BOOT.applySectionStyles) BOOT.applySectionStyles(state.sections);
    if (state.settings["event.start"]) {
      window.GDF_EVENT_START = state.settings["event.start"];
      document.dispatchEvent(new CustomEvent("gdf:eventstart", { detail: state.settings["event.start"] }));
    }
    var steps = [applyHeader, applyFooter];
    if (PAGE === "home") steps.push(applyHome, applyPresident, renderSponsors, function () { reorder("home"); });
    if (PAGE === "president") steps.push(applyPresident);
    if (PAGE === "about") steps.push(applyAbout, function () { reorder("about"); });
    if (PAGE === "applications") steps.push(renderApplications, applyApplicationInfo, function () { reorder("applications"); });
    if (PAGE === "committees") steps.push(renderCommittees);
    if (PAGE === "faq") steps.push(renderFaqs);
    if (PAGE === "team") steps.push(renderTeam);
    steps.push(sectionImages);
    steps.forEach(function (fn) { try { fn(); } catch (e) { console.warn("GDF CMS:", e && e.message); } });
    if (window.GDF_i18n_refresh) window.GDF_i18n_refresh();
  }

  function fromRows(texts, sections, settings) {
    var map = {};
    (texts || []).forEach(function (r) { if (r && r.value && typeof r.value === "object") map[r.key] = r.value; });
    var set = {};
    (settings || []).forEach(function (r) { set[r.key] = r.value; });
    return { textMap: map, sections: sections || [], settings: set };
  }

  function loadCore() {
    if (!db) return Promise.resolve(false);
    return Promise.all([
      db.from("site_texts").select("key,value"),
      db.from("page_sections").select("page,section_key,sort_order,is_visible,settings").order("sort_order"),
      db.from("site_settings").select("key,value")
    ]).then(function (r) {
      var missing = r.filter(function (x) { return x.error; });
      missing.forEach(function (x) { console.warn("GDF CMS:", x.error.message); });
      if (missing.length === 3) return false;
      state = fromRows(r[0].data, r[1].data, r[2].data);
      if (!PREVIEW) {
        try { localStorage.setItem(BOOT.CACHE_KEY || "gdf-cms-cache-v1", JSON.stringify({ t: Date.now(), textMap: state.textMap, sections: state.sections, settings: state.settings })); } catch (e) { /* quota */ }
      }
      return true;
    }, function () { return false; });
  }

  function init() {
    try {
      var cache = JSON.parse(localStorage.getItem(BOOT.CACHE_KEY || "gdf-cms-cache-v1") || "null");
      if (cache && !PREVIEW) { state = { textMap: cache.textMap || {}, sections: cache.sections || [], settings: cache.settings || {} }; applyAll(); }
    } catch (e) { /* ignore */ }
    Promise.all([loadCore(), loadLists()]).then(function () {
      applyAll();
      document.documentElement.setAttribute("data-cms-ready", "1");
      document.dispatchEvent(new CustomEvent("gdf:cms-ready"));
    });
    document.addEventListener("gdf:languagechange", function () { applyAll(); });
  }

  /* Live preview from the admin dashboard (same origin, iframe only). */
  if (PREVIEW) {
    window.addEventListener("message", function (e) {
      if (e.origin !== location.origin || !e.data || e.data.type !== "gdf-cms-preview") return;
      var d = e.data;
      if (d.texts) Object.keys(d.texts).forEach(function (k) { state.textMap[k] = d.texts[k]; });
      if (d.section) {
        state.sections = state.sections.filter(function (s) { return !(s.page === d.section.page && s.section_key === d.section.section_key); });
        state.sections.push(d.section);
      }
      if (d.sections) state.sections = d.sections;
      (d.sectionList || []).forEach(function (x) {
        state.sections = state.sections.filter(function (s) { return !(s.page === x.page && s.section_key === x.section_key); });
        state.sections.push(x);
      });
      if (d.settings) Object.keys(d.settings).forEach(function (k) { state.settings[k] = d.settings[k]; });
      if (d.lang && window.GDF_setLanguage && d.lang !== lang()) window.GDF_setLanguage(d.lang); else applyAll();
    });
  }

  window.GDF_CMS = { reload: function () { return Promise.all([loadCore(), loadLists()]).then(applyAll); } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
