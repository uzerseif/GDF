/* =====================================================================
   GDF'27 Content Studio — pages. Each page edits the real public site:
   texts -> site_texts, layout/images/links -> page_sections,
   design -> site_settings, lists -> their own tables.
   ===================================================================== */
(function () {
  "use strict";
  var A = window.CMSA, h = A.h, t = A.t, db = A.db;
  var clone = function (o) { return JSON.parse(JSON.stringify(o || {})); };
  var same = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };
  var pad2 = function (n) { return String(n).padStart(2, "0"); };
  function toLocalInput(iso) { if (!iso) return ""; var d = new Date(iso); if (isNaN(d)) return ""; return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + "T" + pad2(d.getHours()) + ":" + pad2(d.getMinutes()); }
  function fromLocalInput(v) { return v ? new Date(v).toISOString() : null; }
  function textsDefaultList(keys) { return keys.map(function (k) { var d = A.textDefaults(k); return { en: d.en, ar: d.ar, tr: d.tr }; }); }
  function i18nItem(label, o) {
    return function (item) {
      var f = A.fI18n(label, item || {}, o || {});
      return { el: f, get: function () { var v = f.get(); return v.en ? v : null; } };
    };
  }

  /* ------------------------------------------------------------------
     Section editor: texts (site_texts) + settings (page_sections) for one
     section of a page. fields: [[settingsPath, fieldElement, transform?]]
     ------------------------------------------------------------------ */
  function sectionEditor(o) {
    var row = A.section(o.page, o.key), base = clone(row.settings);
    var texts = (o.texts || []).map(function (x) { return A.textField(x[0], x[1], x[2]); });
    var vis = o.visible === false ? null : A.fToggle(t("f.visible"), row.is_visible !== false);
    var fields = (o.fields || []).slice();
    var st = base.style || {};
    var styleFields = [];
    if (o.style !== false) {
      styleFields = [["style.bg", A.fColor(t("f.bg"), st.bg)], ["style.text", A.fColor(t("f.text"), st.text)],
        ["style.pad_y", A.fText(t("f.pad"), st.pad_y ? parseInt(st.pad_y, 10) : "", { type: "number", placeholder: "auto" }), function (v) { return v ? Math.max(0, Math.min(400, parseInt(v, 10))) + "px" : ""; }]];
    }
    if (o.image) {
      styleFields.push(["image_url", A.fImage(t("f.sectionImage"), base.image_url, { folder: o.page })]);
      styleFields.push(["image_position", A.fSelect(t("f.imagePos"), base.image_position || "bottom", [["bottom", t("pos.bottom")], ["top", t("pos.top")]])]);
    }
    function collect() {
      var s = clone(base);
      fields.concat(styleFields).forEach(function (f) {
        var v = f[1].get();
        if (f[2]) v = f[2](v);
        A.setPath(s, f[0], v);
      });
      if (s.style && !Object.keys(s.style).length) delete s.style;
      if (o.collect) o.collect(s);
      return s;
    }
    fields.concat(styleFields).forEach(function (f) { f[1].setAttribute("data-path", f[0]); });
    var fieldEls = fields.map(function (f) { return f[1]; });
    var body = [];
    if (vis) body.push(vis);
    if (fieldEls.length) body.push(A.grid(o.cols || 2, fieldEls.map(function (el) { if (el.classList.contains("list-field") || el.querySelector(".list-editor,.uploader") || el.classList.contains("i18n")) el.classList.add("full"); return el; })));
    if (o.extra) body.push(o.extra);
    if (texts.length) body.push(h("h3", null, t("f.texts")), h("div", { class: "grid" }, texts));
    if (styleFields.length) body.push(h("details", { class: "style-box" }, h("summary", { class: "muted", style: { cursor: "pointer", margin: "12px 0" } }, t("f.style")), A.grid(3, styleFields.map(function (f) { return f[1]; }))));
    var el = A.card(o.title, body, { help: o.help });
    return {
      el: el, texts: texts,
      validate: function () { return A.validateAll(texts.concat(fieldEls).concat(o.validate ? [{ validate: o.validate }] : [])); },
      save: function () {
        var s = collect();
        var patch = { settings: s };
        if (vis) patch.is_visible = vis.get();
        return A.saveTexts(texts).then(function () { return A.saveSection(o.page, o.key, patch); }).then(function (r) { base = clone(r.settings); if (o.afterSave) return o.afterSave(); });
      },
      draft: function () {
        return { texts: A.textDraft(texts), section: Object.assign({}, row, { page: o.page, section_key: o.key, is_visible: vis ? vis.get() : true, settings: collect() }) };
      }
    };
  }
  /* Puts editors on a page with one Save button and live preview. */
  function editorPage(host, editors, extraSave) {
    editors.forEach(function (e) { host.appendChild(e.el); });
    host.appendChild(A.saveBar(function () {
      if (!editors.every(function (e) { return e.validate(); })) return false;
      return editors.reduce(function (p, e) { return p.then(e.save); }, Promise.resolve()).then(function () { if (extraSave) return extraSave(); });
    }, t("f.fallback")));
    function draft() {
      var msg = { texts: {}, sectionList: [] };
      editors.forEach(function (e) { var d = e.draft(); Object.assign(msg.texts, d.texts); if (d.section) msg.sectionList.push(d.section); if (d.settings) msg.settings = Object.assign(msg.settings || {}, d.settings); });
      return msg;
    }
    host.addEventListener("input", function () { A.queuePreview(draft); });
    host.addEventListener("change", function () { A.queuePreview(draft); });
  }
  /* Order + visibility + colours of the sections of one page. */
  function sectionsManager(page, defs, help) {
    var list = h("div", { class: "rows" });
    var sorted = defs.map(function (d, i) { var r = A.section(page, d[0]); return { key: d[0], label: d[1], row: r, i: A.data.sections[page + ":" + d[0]] ? r.sort_order : i }; })
      .sort(function (a, b) { return a.i - b.i; });
    sorted.forEach(function (d) {
      var vis = A.fToggle(t("f.visible"), d.row.is_visible !== false);
      var r = A.row({ id: d.key, title: d.label, sub: page + " · " + d.key, onMove: function () { A.setDirty(true); }, actions: vis });
      r._vis = vis;
      list.appendChild(r);
    });
    A.sortable(list, function () { A.setDirty(true); }, "sections-" + page);
    return {
      el: A.card(t("home.sections"), list, { help: help || t("home.sectionsHelp") }),
      texts: [],
      validate: function () { return true; },
      save: function () {
        return A.$$(":scope > .row", list).reduce(function (p, r, i) {
          return p.then(function () { return A.saveSection(page, r.getAttribute("data-id"), { sort_order: i, is_visible: r._vis.get() }); });
        }, Promise.resolve());
      },
      draft: function () {
        return { texts: {}, sectionList: null, section: null, all: A.$$(":scope > .row", list).map(function (r, i) { return Object.assign({}, A.section(page, r.getAttribute("data-id")), { page: page, section_key: r.getAttribute("data-id"), sort_order: i, is_visible: r._vis.get() }); }) };
      },
      list: list
    };
  }
  function managerPage(host, mgr) {
    host.appendChild(mgr.el);
    host.appendChild(A.saveBar(mgr.save));
    var send = function () { A.queuePreview(function () { return { sectionList: mgr.draft().all }; }); };
    host.addEventListener("input", send); host.addEventListener("change", send);
    mgr.list.addEventListener("drop", send); mgr.list.addEventListener("click", send);
  }

  /* Generic table list (committees, FAQ, sponsors, applications) */
  function tableList(host, o) {
    var list = h("div", { class: "rows" }), search = h("input", { type: "search", class: "search", placeholder: "🔍" });
    var rows = [];
    function render() {
      list.innerHTML = "";
      var q = search.value.trim().toLowerCase();
      var shown = rows.filter(function (r) { return !q || JSON.stringify(r).toLowerCase().indexOf(q) >= 0; });
      if (!shown.length) list.appendChild(h("div", { class: "empty" }, q ? t("msg.noSearch") : t("msg.empty")));
      shown.forEach(function (r) {
        var info = o.rowInfo(r);
        list.appendChild(A.row({ id: r.id, title: info.title, sub: info.sub, thumb: info.thumb === undefined ? undefined : info.thumb, contain: o.contain,
          badges: r.is_published === false ? A.badge(t("f.published") + " ✕", "off") : null,
          draggable: !q, onMove: q ? null : function () { A.saveOrder(o.table, list); },
          onEdit: function () { edit(r); },
          onDelete: function () { A.confirm(t("msg.confirmDelete"), t("btn.delete")).then(function (ok) { if (!ok) return; db.from(o.table).delete().eq("id", r.id).then(function (x) { if (x.error) return A.fail(x.error); A.toast(t("msg.deleted"), "ok"); load(); }); }); } }));
      });
    }
    function load() {
      return db.from(o.table).select("*").order("sort_order").then(function (r) { if (r.error) throw r.error; rows = r.data || []; render(); if (o.onLoad) o.onLoad(rows); });
    }
    function edit(r) {
      var isNew = !r; r = r || {};
      var fields = o.fields(r);
      fields.forEach(function (f) { if (f[0]) f[1].setAttribute("data-field", f[0]); });
      var pub = A.fToggle(t("f.published"), r.is_published !== false);
      var body = h("div", { class: "grid" }, fields.map(function (f) { return f[1]; }), pub);
      A.modal({ title: isNew ? o.newLabel : (o.rowInfo(r).title || t("btn.edit")), body: body, actions: [
        { label: t("btn.cancel"), cls: "btn-ghost", onClick: function (m) { m.close(); } },
        { label: t("btn.save"), cls: "btn-gold", onClick: function (m, btn) {
          if (!A.validateAll(fields.map(function (f) { return f[1]; }))) return;
          var rec = { is_published: pub.get() };
          fields.forEach(function (f) { if (!f[0]) return; var v = f[2] ? f[2](f[1]) : (f[1].getOrNull ? f[1].getOrNull() : f[1].get()); rec[f[0]] = v === "" ? null : v; });
          if (isNew) rec.sort_order = rows.length;
          A.busy(btn, true);
          (isNew ? db.from(o.table).insert(rec) : db.from(o.table).update(rec).eq("id", r.id)).then(function (x) {
            A.busy(btn, false);
            if (x.error) return A.fail(x.error);
            m.close(); A.toast(t("msg.saved"), "ok"); load(); A.preview.reload();
          });
        } }] });
    }
    A.sortable(list, function () { A.saveOrder(o.table, list); }, o.table);
    search.addEventListener("input", render);
    host.appendChild(A.card(o.title, [h("div", { class: "toolbar", "data-nodirty": "1" }, search, h("button", { type: "button", class: "btn btn-gold", on: { click: function () { edit(null); } } }, "+ " + o.newLabel)), list], { help: o.help }));
    return load();
  }

  /* ================================================================== */
  /* DASHBOARD                                                           */
  /* ================================================================== */
  A.register("dashboard", { group: "overview", icon: "⌂", title: "nav.dashboard", render: function (view) {
    var stats = h("div", { class: "stats" });
    var items = [["team_members", "dash.members", "team"], ["sponsors", "dash.sponsors", "sponsors"], ["applications", "dash.apps", "applications"], ["committees", "dash.committees", "committees"], ["faqs", "dash.faqs", "faqs"]];
    items.forEach(function (it) {
      var b = h("b", null, "…");
      stats.appendChild(h("button", { type: "button", class: "stat", on: { click: function () { A.go(it[2]); } } }, b, h("span", null, t(it[1]))));
      db.from(it[0]).select("id", { count: "exact", head: true }).then(function (r) { b.textContent = r.error ? "—" : r.count; });
    });
    stats.appendChild(h("button", { type: "button", class: "stat", on: { click: function () { A.go("texts"); } } }, h("b", null, String(Object.keys(A.data.texts).length)), h("span", null, t("dash.texts"))));
    var quick = h("div", { class: "quick" }, ["header", "home", "president", "applications", "about", "team", "footer", "design", "media"].map(function (id) {
      var p = A.pages[id];
      return h("button", { type: "button", on: { click: function () { A.go(id); } } }, h("span", { class: "ico" }, p.icon), h("span", null, t(p.title)));
    }));
    var health = h("div");
    function check(ok, label) { health.appendChild(h("div", { class: "check" + (ok ? "" : " bad") }, h("i"), label + (ok ? "" : " ✕"))); }
    check(A.migrationOk, t("dash.ok"));
    db.storage.from("site-media").list("", { limit: 1 }).then(function (r) { check(!r.error, t("dash.storage")); });
    view.appendChild(h("div", { class: "card" }, h("h2", { style: { fontSize: "24px" } }, t("dash.welcome")), h("p", { class: "muted" }, t("dash.text"))));
    view.appendChild(A.card(t("dash.stats"), stats));
    view.appendChild(A.card(t("dash.quick"), quick));
    view.appendChild(A.card(t("dash.health"), health));
  } });

  /* ================================================================== */
  /* HEADER & NAVIGATION                                                 */
  /* ================================================================== */
  var NAV = [["home", "./", "nav.home"], ["applications", "applications/", "nav.applications"], ["committees", "committees/", "nav.committees"], ["about", "about/", "nav.about"], ["team", "team/", "nav.team"], ["faq", "faq/", "nav.faq"]];
  A.register("header", { group: "pages", icon: "☰", title: "nav.header", preview: "./", render: function (view) {
    var s = A.section("global", "header").settings || {};
    var items = Array.isArray(s.nav) && s.nav.length ? s.nav : NAV.map(function (n) { return { page: n[0], href: n[1], visible: true }; });
    NAV.forEach(function (n) { if (!items.some(function (i) { return i.page === n[0]; })) items.push({ page: n[0], href: n[1], visible: false }); });
    var navField = A.fList(t("hdr.nav"), items, function (item) {
      var builtin = NAV.filter(function (n) { return n[0] === item.page; })[0];
      var href = A.fText(t("f.link"), item.href || (builtin && builtin[1]) || "", { url: true, required: true });
      var vis = A.fToggle(t("f.visible"), item.visible !== false);
      var label = builtin ? null : A.fI18n(t("f.label"), item.label || {}, { required: true });
      var newTab = builtin ? null : A.fToggle(t("f.newTab"), !!item.new_tab);
      var title = builtin ? h("strong", null, A.textField(builtin[2]).get().en || builtin[0]) : null;
      return { el: h("div", { class: "grid grid-2" }, title ? h("div", { class: "full" }, title, " ", A.badge(builtin[0])) : null, label ? h("div", { class: "full" }, label) : null, href, h("div", null, vis, newTab)),
        get: function () { var o = { page: item.page, href: href.get(), visible: vis.get() }; if (label) { o.label = label.get(); o.new_tab = newTab.get(); } return o; },
        validate: function () { return href.validate() && (!label || label.validate()); } };
    }, function () { return { page: "custom-" + Date.now().toString(36), href: "https://", visible: true, label: {} }; }, { addLabel: t("hdr.custom"), help: t("hdr.navHelp") });
    navField.classList.add("list-field");
    var ed = sectionEditor({ page: "global", key: "header", title: t("nav.header"), visible: false, cols: 2,
      fields: [["logo_url", A.fImage(t("hdr.logo"), s.logo_url || "images/logo.webp", { folder: "global" })], ["show_name", A.fToggle(t("hdr.showName"), s.show_name !== false)], ["nav", navField]],
      texts: [["brand.name"], ["nav.home"], ["nav.applications"], ["nav.committees"], ["nav.about"], ["nav.team"], ["nav.faq"]],
      validate: function () { return navField.validate(); } });
    editorPage(view, [ed]);
  } });

  /* ================================================================== */
  /* HOMEPAGE                                                            */
  /* ================================================================== */
  function heroEditor() {
    var s = A.section("home", "hero").settings || {};
    var start = A.data.settings["event.start"] || "2027-03-20T09:00:00+03:00";
    var startMs = new Date(start).getTime();
    var startVal = isNaN(startMs) ? "" : new Date(startMs + 3 * 3600e3).toISOString().slice(0, 16);
    var date = A.fText(t("hero.countdownDate"), startVal, { type: "datetime-local" });
    var ed = sectionEditor({ page: "home", key: "hero", title: t("home.hero"),
      fields: [
        ["emblem_url", A.fImage(t("hero.emblem"), s.emblem_url || "images/emblem-gold.webp", { folder: "home/hero" })],
        ["bg_image_url", A.fImage(t("hero.bg"), s.bg_image_url, { folder: "home/hero" })],
        ["use_video", A.fToggle(t("hero.useVideo"), s.use_video !== false)],
        ["overlay_color", A.fColor(t("hero.overlay"), s.overlay_color, "#081933")],
        ["overlay_opacity", A.fText(t("hero.opacity"), s.overlay_opacity === undefined ? "" : s.overlay_opacity, { type: "number", placeholder: "50" }), function (v) { return v === "" ? "" : Math.max(0, Math.min(100, +v)); }],
        ["show_buttons", A.fToggle(t("hero.buttons"), s.show_buttons !== false)],
        ["cta1_href", A.fText(t("hero.cta1"), s.cta1_href || "applications/", { url: true })],
        ["cta2_href", A.fText(t("hero.cta2"), s.cta2_href || "committees/", { url: true })],
        ["show_countdown", A.fToggle(t("hero.countdown"), s.show_countdown !== false)]
      ],
      extra: A.grid(2, [date]),
      texts: [["hero.l1"], ["hero.l2"], ["hero.l3"], ["hero.year"], ["hero.tagline"], ["hero.apply"], ["nav.committees"], ["cd.label"], ["cd.days"], ["cd.hours"], ["cd.minutes"], ["cd.seconds"], ["alt.emblem"]],
      afterSave: function () {
        var v = date.get();
        if (!v || v === startVal) return;
        var iso = v + ":00+03:00";
        return A.saveSetting("event.start", iso, "Event start (countdown target)").then(function () { startVal = v; });
      } });
    var draft = ed.draft;
    ed.draft = function () { var d = draft(); var v = date.get(); if (v) d.settings = { "event.start": v + ":00+03:00" }; return d; };
    return ed;
  }
  function presidentEditor() {
    var s = A.section("home", "president").settings || {};
    return sectionEditor({ page: "home", key: "president", title: t("home.president"),
      fields: [
        ["photo_url", A.fImage(t("pres.photo"), s.photo_url || "images/team/president.webp", { folder: "home/president" })],
        ["signature_url", A.fImage(t("pres.signature"), s.signature_url, { folder: "home/president" })],
        ["photo_position", A.fSelect(t("pres.pos"), s.photo_position || "left", [["left", t("pos.left")], ["right", t("pos.right")]])],
        ["button_href", A.fText(t("pres.btnHref"), s.button_href || "president/", { url: true })],
        ["show_photo", A.fToggle(t("pres.showPhoto"), s.show_photo !== false)],
        ["show_button", A.fToggle(t("pres.showBtn"), s.show_button !== false)]
      ],
      texts: [["pres.title"], ["pres.dear"], ["letter.p1", null, { multiline: true }], ["letter.p2", null, { multiline: true }], ["letter.p3", null, { multiline: true }], ["letter.p4", null, { multiline: true }], ["letter.close", null, { multiline: true }], ["pres.name"], ["pres.role"], ["pres.more"], ["pres.back"], ["alt.pres"]],
      help: t("pres.letter") });
  }
  function venueEditor() {
    var s = A.section("home", "venue").settings || {};
    return sectionEditor({ page: "home", key: "venue", title: t("home.venue"),
      fields: [
        ["address", A.fText(t("venue.address"), s.address || "Osmanlı Mah. Çakmak Küme Evleri İç Kapı No: 5, Şahinbey / Gaziantep")],
        ["email", A.fText(t("venue.email"), s.email || "gdf27.official@gmail.com", { type: "email", pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ })],
        ["phone", A.fText(t("venue.phone"), s.phone || "+90 5822 064 300", { dir: "ltr" })],
        ["maps_url", A.fText(t("venue.maps"), s.maps_url || "https://maps.google.com/?cid=5253672414103134596", { url: true })],
        ["embed_url", A.fText(t("venue.embed"), s.embed_url || "", { url: true, https: true, placeholder: "https://www.google.com/maps/embed?pb=…", pattern: /^https:\/\/(www\.)?google\.[a-z.]+\/maps\/embed/i, patternMsg: t("venue.embed") }), null],
        ["show_map", A.fToggle(t("venue.showMap"), s.show_map !== false)],
        ["photo_url", A.fImage(t("venue.photo"), s.photo_url, { folder: "home/venue" })]
      ],
      texts: [["venue.title"], ["venue.school"], ["lbl.address"], ["lbl.email"], ["lbl.phone"], ["venue.maps"]] });
  }
  var HOME_SECTIONS = function () { return [["hero", t("home.hero")], ["president", t("home.president")], ["venue", t("home.venue")], ["sponsors", t("sp.section")]]; };
  A.register("home", { group: "pages", icon: "◈", title: "nav.home", preview: "./", render: function (view) {
    view.appendChild(A.tabs([
      { key: "hero", label: t("home.hero"), render: function (host) { editorPage(host, [heroEditor()]); } },
      { key: "president", label: t("home.president"), render: function (host) { editorPage(host, [presidentEditor()]); } },
      { key: "venue", label: t("home.venue"), render: function (host) { editorPage(host, [venueEditor()]); } },
      { key: "sponsors", label: t("nav.sponsors"), render: function (host) { host.appendChild(h("p", null, h("button", { type: "button", class: "btn", on: { click: function () { A.go("sponsors"); } } }, t("nav.sponsors") + " →"))); } },
      { key: "sections", label: t("home.sections"), render: function (host) { managerPage(host, sectionsManager("home", HOME_SECTIONS())); } }
    ]));
  } });
  A.register("president", { group: "pages", icon: "✉", title: "nav.president", preview: "president/", render: function (view) { editorPage(view, [presidentEditor()]); } });

  /* ================================================================== */
  /* APPLICATIONS                                                        */
  /* ================================================================== */
  var APP_BULLETS = ["app.b1", "app.b2", "app.b3", "app.b4", "app.b5", "app.b6", "app.b7"];
  function appFields(r) {
    return [
      ["title", A.fI18n(t("f.title"), r.title, { required: true })],
      ["description", A.fI18n(t("f.description"), r.description, { multiline: true })],
      ["button_label", A.fI18n(t("app.btn"), r.button_label, { placeholder: "Apply Now" })],
      ["form_url", A.fText(t("app.form"), r.form_url, { url: true, https: true, required: true })],
      ["image_url", A.fImage(t("f.image"), r.image_url, { folder: "applications" })],
      ["opens_at", A.fText(t("app.opens"), toLocalInput(r.opens_at), { type: "datetime-local" }), function (f) { return fromLocalInput(f.get()); }],
      ["closes_at", A.fText(t("app.closes"), toLocalInput(r.closes_at), { type: "datetime-local" }), function (f) { return fromLocalInput(f.get()); }]
    ];
  }
  A.register("applications", { group: "pages", icon: "↗", title: "nav.applications", preview: "applications/", render: function (view) {
    view.appendChild(A.tabs([
      { key: "forms", label: t("app.forms"), render: function (host) {
        return tableList(host, { table: "applications", title: t("app.forms"), newLabel: t("app.new"), fields: appFields,
          rowInfo: function (r) { var now = Date.now(); var st = r.closes_at && new Date(r.closes_at) < now ? " · closed" : (r.opens_at && new Date(r.opens_at) > now ? " · opens " + new Date(r.opens_at).toLocaleDateString() : ""); return { title: A.tx(r.title), sub: (r.form_url || "") + st, thumb: r.image_url || "" }; } });
      } },
      { key: "info", label: t("app.info"), render: function (host) {
        var s = A.section("applications", "info").settings || {};
        var defaults = textsDefaultList(APP_BULLETS);
        var bullets = A.fList(t("app.bullets"), Array.isArray(s.bullets) && s.bullets.length ? s.bullets : defaults, i18nItem(t("app.bullets"), { multiline: true, rows: 2 }), function () { return {}; });
        bullets.classList.add("list-field");
        editorPage(host, [sectionEditor({ page: "applications", key: "info", title: t("app.info"), image: true,
          fields: [["bullets", bullets, function (v) { return same(v, defaults) ? "" : v; }], ["protocol_url", A.fText(t("app.protocol"), s.protocol_url || "", { url: true, placeholder: "https://…/protocol.pdf" })], ["show_protocol", A.fToggle(t("app.showProtocol"), s.show_protocol !== false)]],
          texts: [["app.info.h"], ["app.download"]] })]);
      } },
      { key: "page", label: t("app.page"), render: function (host) {
        editorPage(host, [sectionEditor({ page: "applications", key: "cards", title: t("app.cards"), image: true, texts: [["nav.applications", t("app.page")], ["app.apply_now"], ["app.delegation"], ["app.delegate"], ["app.press"], ["app.chair"]],
          help: "The four original cards are shown only while the Application forms list is empty." })]);
      } },
      { key: "sections", label: t("home.sections"), render: function (host) { managerPage(host, sectionsManager("applications", [["cards", t("app.cards")], ["info", t("app.info")]])); } }
    ]));
  } });

  /* ================================================================== */
  /* SPONSORS                                                            */
  /* ================================================================== */
  function sponsorCats() {
    var s = A.section("home", "sponsors").settings || {};
    return Array.isArray(s.categories) && s.categories.length ? s.categories : [{ slug: "sponsor", label: { en: "Sponsors", ar: "الرعاة", tr: "Sponsorlar" } }, { slug: "partner", label: { en: "Partners", ar: "الشركاء", tr: "Partnerler" } }, { slug: "media", label: { en: "Media partners", ar: "الشركاء الإعلاميون", tr: "Medya partnerleri" } }];
  }
  A.register("sponsors", { group: "content", icon: "✧", title: "nav.sponsors", preview: "./#sponsors", render: function (view) {
    var listHost = h("div"), secHost = h("div");
    view.appendChild(listHost); view.appendChild(secHost);
    var cats = sponsorCats();
    tableList(listHost, { table: "sponsors", title: t("sp.list"), newLabel: t("sp.new"), contain: true,
      fields: function (r) {
        return [
          ["name", A.fText(t("f.name"), r.name, { required: true })],
          ["website_url", A.fText(t("f.website"), r.website_url, { url: true, placeholder: "https://" })],
          ["logo_url", A.fImage(t("f.logo"), r.logo_url, { folder: "sponsors", required: true })],
          ["category", A.fSelect(t("f.category"), r.category || cats[0].slug, cats.map(function (c) { return [c.slug, A.tx(c.label) || c.slug]; }))],
          ["tier", A.fText(t("f.tier"), r.tier)]
        ];
      },
      rowInfo: function (r) { var c = cats.filter(function (x) { return x.slug === r.category; })[0]; return { title: r.name, sub: (c ? A.tx(c.label) : r.category) + (r.tier ? " · " + r.tier : "") + (r.website_url ? " · " + r.website_url : ""), thumb: r.logo_url || "" }; } });
    var s = A.section("home", "sponsors").settings || {};
    var catField = A.fList(t("sp.cats"), cats, function (c) {
      var slug = A.fText(t("f.slug"), c.slug, { required: true, pattern: /^[a-z0-9-]{1,40}$/, patternMsg: t("f.slugHelp") });
      var label = A.fI18n(t("f.label"), c.label || {}, { required: true });
      return { el: h("div", { class: "grid grid-2" }, slug, label), get: function () { return { slug: slug.get(), label: label.get() }; }, validate: function () { return slug.validate() && label.validate(); } };
    }, function () { return { slug: "", label: {} }; });
    catField.classList.add("list-field");
    editorPage(secHost, [sectionEditor({ page: "home", key: "sponsors", title: t("sp.section"),
      fields: [["show_category_titles", A.fToggle(t("sp.showCats"), s.show_category_titles === true)], ["categories", catField]],
      texts: [["sponsors.title"]], validate: function () { return catField.validate(); } })]);
  } });

  /* ================================================================== */
  /* ABOUT                                                               */
  /* ================================================================== */
  var ABOUT_PARTNERS = [
    { logo_url: "images/ugaihl.webp", url: "https://uluslararasigaziantepaihl.meb.k12.tr/", name: { en: "International Gaziantep Anatolian Imam Hatip High School" } },
    { logo_url: "images/giptu.webp", url: "https://www.gibtu.edu.tr/", name: { en: "GAZİANTEP İSLAM BİLİM VE TEKNOLOJİ ÜNİVERSİTESİ" } }
  ];
  var AIMS = ["about.aims.1", "about.aims.2", "about.aims.3", "about.aims.4"];
  A.register("about", { group: "pages", icon: "ℹ", title: "nav.about", preview: "about/", render: function (view) {
    view.appendChild(A.tabs([
      { key: "content", label: t("f.texts"), render: function (host) {
        var b = A.section("about", "behind").settings || {}, v = A.section("about", "vmca").settings || {};
        var partners = A.fList(t("about.partners"), Array.isArray(b.partners) && b.partners.length ? b.partners : ABOUT_PARTNERS, function (p) {
          var logo = A.fImage(t("f.logo"), p.logo_url, { folder: "about" }), url = A.fText(t("f.link"), p.url, { url: true }), name = A.fI18n(t("f.name"), p.name || {}, { required: true });
          return { el: h("div", { class: "grid grid-2" }, logo, h("div", { class: "grid" }, name, url)), get: function () { return { logo_url: logo.get(), url: url.get(), name: name.get() }; }, validate: function () { return name.validate() && url.validate(); } };
        }, function () { return { name: {} }; });
        partners.classList.add("list-field");
        var aimDefaults = textsDefaultList(AIMS);
        var aims = A.fList(t("about.aims"), Array.isArray(v.aims) && v.aims.length ? v.aims : aimDefaults, i18nItem(t("about.aims"), { multiline: true, rows: 2 }), function () { return {}; });
        aims.classList.add("list-field");
        editorPage(host, [
          sectionEditor({ page: "about", key: "page", title: t("about.page"), visible: false, style: false, texts: [["about.title"], ["title.about"], ["meta.about"]] }),
          sectionEditor({ page: "about", key: "overview", title: t("about.overview"), image: true, texts: [["about.overview.h"], ["about.what.p", null, { multiline: true, rows: 6 }]] }),
          sectionEditor({ page: "about", key: "behind", title: t("about.behind"), image: true, fields: [["partners", partners, function (x) { return same(x, ABOUT_PARTNERS) ? "" : x; }]], texts: [["about.behind.h"], ["alt.school"], ["alt.univ"]], validate: function () { return partners.validate(); } }),
          sectionEditor({ page: "about", key: "why", title: t("about.why"), image: true, texts: [["about.why.h"], ["about.why.p", null, { multiline: true, rows: 6 }]] }),
          sectionEditor({ page: "about", key: "vmca", title: t("about.vmca"), image: true, fields: [["aims", aims, function (x) { return same(x, aimDefaults) ? "" : x; }]], texts: [["about.vmca.h"], ["about.vision.h"], ["about.vision.p", null, { multiline: true }], ["about.mission.h"], ["about.mission.p", null, { multiline: true }], ["about.aims.h"]] })
        ]);
      } },
      { key: "sections", label: t("home.sections"), render: function (host) { managerPage(host, sectionsManager("about", [["overview", t("about.overview")], ["behind", t("about.behind")], ["why", t("about.why")], ["vmca", t("about.vmca")]])); } }
    ]));
  } });

  /* ================================================================== */
  /* TEAM                                                                */
  /* ================================================================== */
  A.register("team", { group: "pages", icon: "♙", title: "nav.team", preview: "team/", render: function (view) {
    var D = { tabs: [], groups: [], placements: [], members: [] }, activeTab = null;
    var tabsList = h("div", { class: "rows" }), groupsHost = h("div"), membersHost = h("div");
    var tabTitle = h("h2"), tabActions = h("div", { class: "toolbar", style: { margin: 0 } });
    function load() {
      return Promise.all([
        db.from("team_tabs").select("*").order("sort_order"),
        db.from("team_groups").select("*").order("sort_order"),
        db.from("team_placements").select("*").order("row_no").order("sort_order"),
        db.from("team_members").select("*").order("sort_order")
      ]).then(function (r) {
        var bad = r.filter(function (x) { return x.error; })[0]; if (bad) throw bad.error;
        D.tabs = r[0].data; D.groups = r[1].data; D.placements = r[2].data; D.members = r[3].data;
        if (!activeTab || !D.tabs.some(function (x) { return x.id === activeTab; })) activeTab = D.tabs[0] && D.tabs[0].id;
        renderTabs(); renderGroups(); renderMembers();
      }).catch(A.fail);
    }
    var member = function (id) { return D.members.filter(function (m) { return m.id === id; })[0]; };
    function renderTabs() {
      tabsList.innerHTML = "";
      D.tabs.forEach(function (tb) {
        var r = A.row({ id: tb.id, title: A.tx(tb.title), sub: tb.slug + " · " + D.placements.filter(function (p) { return p.tab_id === tb.id; }).length,
          badges: tb.is_published ? null : A.badge(t("f.published") + " ✕", "off"),
          onMove: function () { A.saveOrder("team_tabs", tabsList).then(A.preview.reload); },
          onEdit: function (e) { e.stopPropagation(); editTab(tb); },
          onDelete: function (e) { e.stopPropagation(); A.confirm(t("msg.confirmDelete") + " (" + A.tx(tb.title) + ")", t("btn.delete")).then(function (ok) { if (ok) db.from("team_tabs").delete().eq("id", tb.id).then(done); }); } });
        r.classList.add("tab-row"); if (tb.id === activeTab) r.classList.add("active");
        r.style.cursor = "pointer";
        r.addEventListener("click", function (e) { if (e.target.closest("button")) return; activeTab = tb.id; renderTabs(); renderGroups(); });
        tabsList.appendChild(r);
      });
      if (!D.tabs.length) tabsList.appendChild(h("div", { class: "empty" }, t("msg.empty")));
    }
    function done(x) { if (x && x.error) return A.fail(x.error); A.toast(t("msg.saved"), "ok"); A.preview.reload(); return load(); }
    function placementRow(p) {
      var m = member(p.member_id); if (!m) return null;
      var r = A.row({ id: p.id, title: A.tx(m.name), sub: A.tx(m.role) + " · " + t("team.row") + " " + p.row_no, thumb: m.photo_url || "",
        badges: m.is_published ? null : A.badge(t("f.published") + " ✕", "off"),
        onMove: function (row) { saveGroupOrder(row.parentNode, row.getAttribute("data-id")); },
        onEdit: function () { editMember(m); },
        onDelete: function () { A.confirm(t("msg.confirmDelete"), t("btn.delete")).then(function (ok) { if (ok) db.from("team_placements").delete().eq("id", p.id).then(done); }); } });
      return r;
    }
    /* The list order becomes sort_order; a moved member joins the row (row_no) of the member it was placed next to. */
    function saveGroupOrder(list, movedId) {
      var gid = list.getAttribute("data-group") || null;
      var ids = A.$$(":scope > .row", list).map(function (r) { return r.getAttribute("data-id"); });
      var pmap = {}; D.placements.forEach(function (p) { pmap[p.id] = p; });
      var rowNo = {}; ids.forEach(function (id) { rowNo[id] = pmap[id] ? pmap[id].row_no : 0; });
      if (movedId && pmap[movedId]) {
        var i = ids.indexOf(movedId), mp = pmap[movedId];
        var before = D.placements.filter(function (p) { return p.tab_id === mp.tab_id && (p.group_id || null) === gid; }).map(function (p) { return p.id; });
        var oldIdx = before.indexOf(movedId);
        var movedUp = oldIdx < 0 ? true : i < oldIdx;
        var nb = movedUp ? (ids[i + 1] || ids[i - 1]) : (ids[i - 1] || ids[i + 1]);
        if (nb) rowNo[movedId] = rowNo[nb];
      }
      return A.saveOrder("team_placements", list, function (id) { return { group_id: gid, row_no: rowNo[id] || 0 }; }).then(function () { A.preview.reload(); return load(); });
    }
    function groupBlock(g, items) {
      var list = h("div", { class: "rows", "data-group": g ? g.id : "" });
      items.forEach(function (p) { var r = placementRow(p); if (r) list.appendChild(r); });
      if (!items.length) list.appendChild(h("div", { class: "empty" }, t("msg.empty")));
      A.sortable(list, function (row, target) { saveGroupOrder(target, row.getAttribute("data-id")); }, "team-placements");
      var head = h("div", { class: "g-head" },
        g && g.image_url ? h("img", { class: "r-thumb contain", src: g.image_url, alt: "" }) : null,
        h("div", { class: "r-main" }, h("div", { class: "r-title" }, g ? (A.tx(g.title) || (t("team.group") + " " + (D.groups.filter(function (x) { return x.tab_id === g.tab_id; }).indexOf(g) + 1))) : t("team.noGroup"), g && !g.is_published ? A.badge(t("f.published") + " ✕", "off") : null), g && A.tx(g.description) ? h("div", { class: "r-sub" }, A.tx(g.description)) : null),
        g ? h("div", { class: "r-actions" },
          h("button", { type: "button", class: "icon-btn", title: t("btn.up"), on: { click: function () { moveGroup(g, -1); } } }, "↑"),
          h("button", { type: "button", class: "icon-btn", title: t("btn.down"), on: { click: function () { moveGroup(g, 1); } } }, "↓"),
          h("button", { type: "button", class: "icon-btn", title: t("btn.edit"), on: { click: function () { editGroup(g); } } }, "✎"),
          h("button", { type: "button", class: "icon-btn danger", title: t("btn.delete"), on: { click: function () { A.confirm(t("msg.confirmDelete"), t("btn.delete")).then(function (ok) { if (ok) db.from("team_groups").delete().eq("id", g.id).then(done); }); } } }, "🗑")) : null);
      return h("div", { class: "group-card" }, head, list);
    }
    function moveGroup(g, dir) {
      var gs = D.groups.filter(function (x) { return x.tab_id === g.tab_id; });
      var i = gs.indexOf(g), j = i + dir;
      if (j < 0 || j >= gs.length) return;
      gs.splice(j, 0, gs.splice(i, 1)[0]);
      Promise.all(gs.map(function (x, k) { return db.from("team_groups").update({ sort_order: k }).eq("id", x.id); })).then(function (res) { var b = res.filter(function (x) { return x.error; })[0]; done(b); });
    }
    function renderGroups() {
      groupsHost.innerHTML = "";
      var tb = D.tabs.filter(function (x) { return x.id === activeTab; })[0];
      tabTitle.textContent = tb ? A.tx(tb.title) : "";
      tabActions.innerHTML = "";
      if (!tb) { groupsHost.appendChild(h("div", { class: "empty" }, t("msg.empty"))); return; }
      tabActions.appendChild(h("button", { type: "button", class: "btn btn-sm", on: { click: function () { editGroup(null); } } }, "+ " + t("team.newGroup")));
      tabActions.appendChild(h("button", { type: "button", class: "btn btn-sm btn-gold", on: { click: function () { editMember(null, { tab_id: tb.id }); } } }, "+ " + t("team.newMember")));
      var groups = D.groups.filter(function (g) { return g.tab_id === tb.id; });
      var places = D.placements.filter(function (p) { return p.tab_id === tb.id; });
      groups.forEach(function (g) { groupsHost.appendChild(groupBlock(g, places.filter(function (p) { return p.group_id === g.id; }))); });
      var loose = places.filter(function (p) { return !p.group_id || !groups.some(function (g) { return g.id === p.group_id; }); });
      if (loose.length || !groups.length) groupsHost.appendChild(groupBlock(null, loose));
    }
    function renderMembers(q) {
      membersHost.innerHTML = "";
      q = (q || "").toLowerCase();
      var list = h("div", { class: "rows" });
      D.members.filter(function (m) { return !q || JSON.stringify([m.name, m.role]).toLowerCase().indexOf(q) >= 0; }).forEach(function (m) {
        var tabs = D.placements.filter(function (p) { return p.member_id === m.id; }).map(function (p) { var tb = D.tabs.filter(function (x) { return x.id === p.tab_id; })[0]; return tb ? A.tx(tb.title) : ""; }).filter(Boolean);
        list.appendChild(A.row({ id: m.id, draggable: false, title: A.tx(m.name), sub: A.tx(m.role) + " · " + (tabs.length ? tabs.join(", ") : t("team.unplaced")), thumb: m.photo_url || "",
          badges: m.is_published ? null : A.badge(t("f.published") + " ✕", "off"),
          onEdit: function () { editMember(m); },
          onDelete: function () { A.confirm(t("msg.confirmDelete") + " (" + A.tx(m.name) + ")", t("btn.delete")).then(function (ok) { if (ok) db.from("team_members").delete().eq("id", m.id).then(done); }); } }));
      });
      if (!list.children.length) list.appendChild(h("div", { class: "empty" }, t("msg.noSearch")));
      membersHost.appendChild(list);
    }
    function editTab(tb) {
      var isNew = !tb; tb = tb || {};
      var title = A.fI18n(t("f.title"), tb.title, { required: true });
      var slug = A.fText(t("f.slug"), tb.slug || "", { required: true, pattern: /^[a-z0-9-]+$/, patternMsg: t("f.slugHelp"), help: t("f.slugHelp") });
      if (isNew) title.inputs.en.addEventListener("input", function () { slug.set(A.slugify(title.inputs.en.value)); });
      var desc = A.fI18n(t("f.description"), tb.description, { multiline: true, rows: 3 });
      var pub = A.fToggle(t("f.published"), tb.is_published !== false);
      A.modal({ title: isNew ? t("team.newTab") : A.tx(tb.title), body: h("div", { class: "grid" }, title, slug, desc, pub), actions: [
        { label: t("btn.cancel"), cls: "btn-ghost", onClick: function (m) { m.close(); } },
        { label: t("btn.save"), cls: "btn-gold", onClick: function (m, btn) {
          if (!A.validateAll([title, slug])) return;
          var rec = { title: title.get(), slug: slug.get(), description: desc.getOrNull(), is_published: pub.get() };
          if (isNew) rec.sort_order = D.tabs.length;
          A.busy(btn, true);
          (isNew ? db.from("team_tabs").insert(rec).select().single() : db.from("team_tabs").update(rec).eq("id", tb.id).select().single()).then(function (x) {
            A.busy(btn, false); if (x.error) return A.fail(x.error);
            m.close(); if (isNew) activeTab = x.data.id; done();
          });
        } }] });
    }
    function editGroup(g) {
      var isNew = !g; g = g || {};
      var title = A.fI18n(t("team.groupTitle"), g.title), desc = A.fI18n(t("f.description"), g.description, { multiline: true, rows: 3 });
      var img = A.fImage(t("f.image"), g.image_url, { folder: "team/units" }), pub = A.fToggle(t("f.published"), g.is_published !== false);
      A.modal({ title: isNew ? t("team.newGroup") : (A.tx(g.title) || t("team.group")), body: h("div", { class: "grid" }, title, desc, img, pub), actions: [
        { label: t("btn.cancel"), cls: "btn-ghost", onClick: function (m) { m.close(); } },
        { label: t("btn.save"), cls: "btn-gold", onClick: function (m, btn) {
          var rec = { title: title.getOrNull(), description: desc.getOrNull(), image_url: img.get() || null, is_published: pub.get() };
          if (isNew) { rec.tab_id = activeTab; rec.sort_order = D.groups.filter(function (x) { return x.tab_id === activeTab; }).length; }
          A.busy(btn, true);
          (isNew ? db.from("team_groups").insert(rec) : db.from("team_groups").update(rec).eq("id", g.id)).then(function (x) { A.busy(btn, false); if (x.error) return A.fail(x.error); m.close(); done(); });
        } }] });
    }
    function editMember(m, preset) {
      var isNew = !m; m = m || {};
      var name = A.fI18n(t("f.name"), m.name, { required: true }), role = A.fI18n(t("f.role"), m.role, { required: true });
      var bio = A.fI18n(t("f.bio"), m.bio, { multiline: true, rows: 6 });
      var photo = A.fImage(t("f.photo"), m.photo_url, { folder: "team/members" });
      var so = m.social || {};
      var social = ["instagram", "linkedin", "x", "website", "email"].map(function (k) { return [k, A.fText(k === "x" ? "X" : k.charAt(0).toUpperCase() + k.slice(1), so[k] || "", k === "email" ? { type: "email" } : { url: true, https: true, placeholder: "https://" })]; });
      var pub = A.fToggle(t("f.published"), m.is_published !== false);
      [["name", name], ["role", role], ["bio", bio], ["photo_url", photo]].forEach(function (x) { x[1].setAttribute("data-field", x[0]); });
      var existing = isNew ? (preset ? [{ tab_id: preset.tab_id, group_id: null, row_no: 0 }] : []) : D.placements.filter(function (p) { return p.member_id === m.id; });
      var places = A.fList(t("team.placements"), existing, function (p) {
        var tabSel = A.fSelect(t("team.tab"), p.tab_id || (D.tabs[0] && D.tabs[0].id), D.tabs.map(function (x) { return [x.id, A.tx(x.title)]; }));
        var grpSel = A.fSelect(t("team.group"), "", [["", t("team.noGroup")]]);
        function fillGroups(v) {
          var opts = [["", t("team.noGroup")]].concat(D.groups.filter(function (g) { return g.tab_id === tabSel.get(); }).map(function (g, i) { return [g.id, A.tx(g.title) || (t("team.group") + " " + (i + 1))]; }));
          grpSel.input.innerHTML = ""; opts.forEach(function (o) { grpSel.input.appendChild(h("option", { value: o[0] }, o[1])); });
          grpSel.set(v || "");
        }
        var firstGroup = function () { var g = D.groups.filter(function (x) { return x.tab_id === tabSel.get(); })[0]; return g ? g.id : ""; };
        fillGroups(p.id ? p.group_id : (p.group_id || firstGroup()));
        tabSel.input.addEventListener("change", function () { fillGroups(firstGroup()); });
        var rowNo = A.fText(t("team.row"), p.row_no || 0, { type: "number", help: t("team.rowHelp") });
        var touched = false; rowNo.input.addEventListener("input", function () { touched = true; });
        return { el: h("div", { class: "grid grid-3" }, tabSel, grpSel, rowNo), get: function () { return { id: p.id, tab_id: tabSel.get(), group_id: grpSel.get() || null, row_no: parseInt(rowNo.get(), 10) || 0, sort_order: p.sort_order || 0, rowTouched: touched, moved: !p.id || p.tab_id !== tabSel.get() || (p.group_id || null) !== (grpSel.get() || null) }; } };
      }, function () { return { tab_id: activeTab, row_no: 0 }; }, { addLabel: t("team.addPlacement") });
      var body = h("div", { class: "grid" }, A.grid(2, [h("div", { class: "grid" }, name, role), photo]), bio,
        h("details", null, h("summary", { class: "muted", style: { cursor: "pointer" } }, t("team.social")), A.grid(2, social.map(function (s) { return s[1]; }))), places, pub);
      A.modal({ title: isNew ? t("team.newMember") : A.tx(m.name), body: body, actions: [
        { label: t("btn.cancel"), cls: "btn-ghost", onClick: function (md) { md.close(); } },
        { label: t("btn.save"), cls: "btn-gold", onClick: function (md, btn) {
          if (!A.validateAll([name, role].concat(social.map(function (s) { return s[1]; })))) return;
          var pl = places.get();
          var tabIds = pl.map(function (p) { return p.tab_id; });
          if (tabIds.some(function (x, i) { return tabIds.indexOf(x) !== i; })) { A.toast(t("team.tab") + ": duplicate", "error"); return; }
          var soc = {}; social.forEach(function (s) { if (s[1].get()) soc[s[0]] = s[1].get(); });
          var rec = { name: name.get(), role: role.get(), bio: bio.getOrNull(), photo_url: photo.get() || null, social: soc, is_published: pub.get() };
          if (isNew) rec.sort_order = D.members.length;
          A.busy(btn, true);
          (isNew ? db.from("team_members").insert(rec).select().single() : db.from("team_members").update(rec).eq("id", m.id).select().single()).then(function (x) {
            if (x.error) throw x.error;
            var mid = x.data.id;
            var keep = pl.filter(function (p) { return p.id; }).map(function (p) { return p.id; });
            var old = existing.filter(function (p) { return p.id && keep.indexOf(p.id) < 0; }).map(function (p) { return p.id; });
            var jobs = [];
            if (old.length) jobs.push(db.from("team_placements").delete().in("id", old));
            return Promise.all(jobs).then(function () {
              return Promise.all(pl.map(function (p) {
                var rec2 = { tab_id: p.tab_id, member_id: mid, group_id: p.group_id, row_no: p.row_no };
                if (p.moved) {
                  /* a member added to / moved into a group goes to the end of its last row */
                  var target = D.placements.filter(function (q) { return q.tab_id === p.tab_id && (q.group_id || null) === p.group_id && q.id !== p.id; });
                  rec2.sort_order = target.reduce(function (m, q) { return Math.max(m, q.sort_order + 1); }, 0);
                  if (!p.rowTouched) rec2.row_no = target.reduce(function (m, q) { return Math.max(m, q.row_no); }, 0);
                }
                if (p.id) return db.from("team_placements").update(rec2).eq("id", p.id);
                return db.from("team_placements").insert(rec2);
              }));
            });
          }).then(function (res) {
            var bad = (res || []).filter(function (r) { return r && r.error; })[0]; if (bad) throw bad.error;
            md.close(); done();
          }).catch(A.fail).then(function () { A.busy(btn, false); });
        } }] });
    }
    A.sortable(tabsList, function () { A.saveOrder("team_tabs", tabsList).then(function () { A.preview.reload(); return load(); }); }, "team-tabs");
    var search = h("input", { type: "search", class: "search", placeholder: t("team.search") });
    search.addEventListener("input", function () { renderMembers(search.value); });
    view.appendChild(A.tabs([
      { key: "structure", label: t("team.tabs") + " & " + t("team.groups"), render: function (host) {
        host.appendChild(h("div", { class: "team-layout" },
          A.card(t("team.tabs"), tabsList, { actions: h("button", { type: "button", class: "btn btn-sm btn-gold", on: { click: function () { editTab(null); } } }, "+ " + t("team.newTab")) }),
          h("section", { class: "card" }, h("div", { class: "card-head" }, tabTitle, tabActions), h("p", { class: "muted small" }, t("team.dragHelp")), groupsHost)));
        return load();
      } },
      { key: "members", label: t("team.allMembers"), render: function (host) {
        host.appendChild(A.card(t("team.allMembers"), [h("div", { class: "toolbar", "data-nodirty": "1" }, search, h("button", { type: "button", class: "btn btn-gold", on: { click: function () { editMember(null); } } }, "+ " + t("team.newMember"))), membersHost]));
        return load();
      } },
      { key: "texts", label: t("f.texts"), render: function (host) {
        editorPage(host, [sectionEditor({ page: "team", key: "members", title: t("nav.team"), texts: [["team.title"], ["team.view"], ["team.tba"], ["team.bio.soon"], ["title.team"]] })]);
      } }
    ]));
  } });

  /* ================================================================== */
  /* FOOTER                                                              */
  /* ================================================================== */
  var PLATFORMS = ["instagram", "facebook", "x", "linkedin", "youtube", "tiktok", "whatsapp", "website"];
  A.register("footer", { group: "pages", icon: "▁", title: "nav.footer", preview: "./#contact", render: function (view) {
    var s = A.section("global", "footer").settings || {};
    var phones = A.fList(t("ft.phones"), s.phones || ["+90 582 206 43 00", "+90 501 335 54 73"], function (p) {
      var f = A.fText("", p, { dir: "ltr", placeholder: "+90 …" });
      return { el: f, get: function () { return f.get() || null; } };
    }, function () { return ""; });
    var socials = A.fList(t("ft.socials"), s.socials || [{ platform: "instagram", url: "https://www.instagram.com/gdf.2027?mdxt=dXg1OGZkbHh3Mmhx", label: "GDF'27" }], function (x) {
      var pf = A.fSelect(t("ft.platform"), x.platform || "instagram", PLATFORMS.map(function (p) { return [p, p.charAt(0).toUpperCase() + p.slice(1)]; }));
      var url = A.fText(t("f.url"), x.url || "", { url: true, https: true, required: true });
      var label = A.fText(t("f.label"), typeof x.label === "string" ? x.label : A.tx(x.label));
      return { el: h("div", { class: "grid grid-3" }, pf, url, label), get: function () { return { platform: pf.get(), url: url.get(), label: label.get() }; }, validate: function () { return url.validate(); } };
    }, function () { return { platform: "instagram", url: "" }; });
    phones.classList.add("list-field"); socials.classList.add("list-field");
    editorPage(view, [sectionEditor({ page: "global", key: "footer", title: t("nav.footer"), visible: false,
      fields: [
        ["logo_url", A.fImage(t("ft.logo"), s.logo_url || "images/logo.webp", { folder: "global" })],
        ["show_name", A.fToggle(t("ft.showName"), s.show_name !== false)],
        ["address", A.fText(t("venue.address"), s.address || "Osmanlı Mah. Çakmak Küme Evleri İç Kapı No: 5, Şahinbey / Gaziantep")],
        ["email", A.fText(t("venue.email"), s.email || "gdf27.official@gmail.com", { type: "email", pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ })],
        ["phones", phones], ["socials", socials],
        ["show_contact", A.fToggle(t("ft.showContact"), s.show_contact !== false)],
        ["show_quick", A.fToggle(t("ft.showQuick"), s.show_quick !== false)],
        ["show_social", A.fToggle(t("ft.showSocial"), s.show_social !== false)],
        ["show_credit", A.fToggle(t("ft.showCredit"), s.show_credit !== false)]
      ],
      texts: [["footer.desc", null, { multiline: true }], ["footer.contact"], ["lbl.school"], ["footer.quick"], ["nav.verify"], ["footer.follow"], ["footer.copy"], ["footer.made"], ["footer.design"]],
      validate: function () { return socials.validate(); } })]);
  } });

  /* ================================================================== */
  /* DESIGN SETTINGS                                                     */
  /* ================================================================== */
  var FONTS = ["", "Inter", "Playfair Display", "Cormorant Garamond", "Montserrat", "Lora", "Poppins", "Merriweather", "Cairo", "Tajawal", "Arial", "Georgia"];
  A.register("design", { group: "system", icon: "◐", title: "nav.design", preview: "./", render: function (view) {
    var tk = clone(A.data.settings["theme.tokens"]);
    var colors = [["primary", "ds.primary", "#081933"], ["gold", "ds.gold", "#EAD7B0"], ["secondary", "ds.secondary", "#EAD7B0"], ["background", "ds.background", "#F1E8D1"], ["text", "ds.text", "#262626"], ["heading", "ds.heading", "#081933"], ["surface", "ds.surface", "#0e2041"], ["border", "ds.border", "#EAD7B0"], ["button_bg", "ds.buttonBg", "#EAD7B0"], ["button_text", "ds.buttonText", "#081933"]]
      .map(function (c) { return [c[0], A.fColor(t(c[1]), tk[c[0]], c[2])]; });
    var px = function (v) { return v === "" || v == null ? "" : Math.max(0, Math.min(200, parseInt(v, 10))) + "px"; };
    var type = [
      ["font_body", A.fSelect(t("ds.fontBody"), tk.font_body || "", FONTS.map(function (f) { return [f, f || t("ds.default")]; }))],
      ["font_heading", A.fSelect(t("ds.fontHeading"), tk.font_heading || "", FONTS.map(function (f) { return [f, f || t("ds.default")]; }))],
      ["font_size", A.fSelect(t("ds.fontSize"), tk.font_size || "", [["", t("ds.default")], ["14px", "14px"], ["15px", "15px"], ["16px", "16px"], ["17px", "17px"], ["18px", "18px"]])]
    ];
    var shape = [
      ["radius", A.fText(t("ds.radius") + " (px)", tk.radius ? parseInt(tk.radius, 10) : "", { type: "number", placeholder: "auto" }), px],
      ["section_y", A.fText(t("ds.sectionY") + " (px)", tk.section_y ? parseInt(tk.section_y, 10) : "", { type: "number", placeholder: "auto" }), px],
      ["button_style", A.fSelect(t("ds.buttonStyle"), tk.button_style || "", [["", t("ds.default")], ["pill", t("ds.pill")], ["square", t("ds.square")], ["outline", t("ds.outline")]])]
    ];
    var all = colors.concat(type, shape);
    function collect() { var o = {}; all.forEach(function (f) { var v = f[1].get(); if (f[2]) v = f[2](v); if (v !== "" && v != null) o[f[0]] = v; }); return o; }
    view.appendChild(h("p", { class: "muted" }, t("ds.help")));
    if (A.role !== "admin") view.appendChild(h("div", { class: "banner", style: { margin: "0 0 16px" } }, t("msg.adminOnly")));
    view.appendChild(A.card(t("ds.colors"), A.grid(4, colors.map(function (c) { return c[1]; }))));
    view.appendChild(A.card(t("ds.type"), A.grid(3, type.map(function (c) { return c[1]; }))));
    view.appendChild(A.card(t("ds.shape"), A.grid(3, shape.map(function (c) { return c[1]; }))));
    var reset = h("button", { type: "button", class: "btn btn-ghost", on: { click: function () {
      A.confirm(t("btn.reset") + "?", t("btn.reset"), false).then(function (ok) { if (!ok) return; A.saveSetting("theme.tokens", {}, "Design tokens").then(function () { A.toast(t("msg.saved"), "ok"); A.setDirty(false); A.go("design", true); }).catch(A.fail); });
    } } }, t("btn.reset"));
    var bar = A.saveBar(function () { return A.saveSetting("theme.tokens", collect(), "Design tokens (Design Settings page)"); });
    bar.insertBefore(reset, bar.lastChild);
    view.appendChild(bar);
    var send = function () { A.queuePreview(function () { return { settings: { "theme.tokens": collect() } }; }); };
    view.addEventListener("input", send); view.addEventListener("change", send);
  } });

  /* ================================================================== */
  /* COMMITTEES + FAQ                                                    */
  /* ================================================================== */
  A.register("committees", { group: "content", icon: "▤", title: "nav.committees", preview: "committees/", render: function (view) {
    return tableList(view, { table: "committees", title: t("nav.committees"), newLabel: t("cm.new"),
      fields: function (r) {
        var name = A.fI18n(t("f.name"), r.name, { required: true }), slug = A.fText(t("f.slug"), r.slug || "", { required: true, pattern: /^[a-z0-9-]+$/, patternMsg: t("f.slugHelp"), help: t("f.slugHelp") });
        if (!r.id) name.inputs.en.addEventListener("input", function () { slug.set(A.slugify(name.inputs.en.value)); });
        return [["name", name], ["slug", slug], ["short_desc", A.fI18n(t("cm.short"), r.short_desc, { required: true, multiline: true, rows: 3 })], ["about", A.fI18n(t("cm.about"), r.about, { multiline: true })], ["expect", A.fI18n(t("cm.expect"), r.expect, { multiline: true })], ["image_url", A.fImage(t("f.image"), r.image_url, { folder: "committees" })], ["image_alt", A.fI18n(t("cm.alt"), r.image_alt)]];
      },
      rowInfo: function (r) { return { title: A.tx(r.name), sub: r.slug + " · " + A.tx(r.short_desc), thumb: r.image_url || "" }; } });
  } });
  A.register("faqs", { group: "content", icon: "?", title: "nav.faqs", preview: "faq/", render: function (view) {
    return tableList(view, { table: "faqs", title: t("nav.faqs"), newLabel: t("fq.new"),
      fields: function (r) { return [["question", A.fI18n(t("fq.q"), r.question, { required: true })], ["answer", A.fI18n(t("fq.a"), r.answer, { required: true, multiline: true })], ["link_url", A.fText(t("f.link"), r.link_url, { url: true })], ["link_label", A.fI18n(t("fq.linkLabel"), r.link_label)]]; },
      rowInfo: function (r) { return { title: A.tx(r.question), sub: A.tx(r.answer) }; } });
  } });

  /* ================================================================== */
  /* ALL WEBSITE TEXTS                                                   */
  /* ================================================================== */
  var PAGE_NAMES = { index: "nav.home", "about-us": "nav.about", applications: "nav.applications", "message-from-president": "nav.president", "our-team": "nav.team", committees: "nav.committees", "committee-detail": "nav.committees", faq: "nav.faqs", verify: "verify", certificate: "certificate", "404": "404" };
  A.register("texts", { group: "content", icon: "Aa", title: "nav.texts", render: function (view) {
    var search = h("input", { type: "search", class: "search", placeholder: t("tx.search") });
    var pageSel = h("select", { style: { maxWidth: "240px" } }, h("option", { value: "" }, t("tx.all")), Object.keys(PAGE_NAMES).map(function (p) { return h("option", { value: p }, t(PAGE_NAMES[p]) + " (" + p + ")"); }));
    var editedOnly = A.fToggle(t("tx.edited"), false);
    var host = h("div");
    var fields = A.allTextKeys().map(function (k) {
      var f = A.textField(k, A.textDefaults(k).en.replace(/<[^>]+>/g, " ").slice(0, 70) || k, { rows: 3 });
      var row = h("div", { class: "text-row", "data-key": k }, h("div", null, h("code", null, k), A.data.texts[k] ? A.badge(t("tx.edited"), "gold") : null, h("div", { class: "small muted" }, A.textPages(k).join(", "))), f);
      row._f = f;
      host.appendChild(row);
      return f;
    });
    function filter() {
      var q = search.value.trim().toLowerCase(), p = pageSel.value, ed = editedOnly.get(), n = 0;
      A.$$(".text-row", host).forEach(function (r) {
        var k = r.getAttribute("data-key"), f = r._f;
        var ok = (!p || A.textPages(k).indexOf(p) >= 0) && (!ed || A.data.texts[k]) && (!q || (k + " " + JSON.stringify(f.get())).toLowerCase().indexOf(q) >= 0);
        r.hidden = !ok; if (ok) n++;
      });
    }
    [search, pageSel, editedOnly].forEach(function (el) { el.addEventListener("input", filter); el.addEventListener("change", filter); });
    view.appendChild(A.card(t("nav.texts"), [h("div", { class: "toolbar", "data-nodirty": "1" }, search, pageSel, editedOnly), host], { help: t("f.fallback") }));
    view.appendChild(A.saveBar(function () { return A.saveTexts(fields).then(function () { A.go("texts", true); }); }));
  } });

  /* ================================================================== */
  /* MEDIA LIBRARY                                                       */
  /* ================================================================== */
  A.register("media", { group: "system", icon: "▣", title: "nav.media", render: function (view) {
    var grid = h("div", { class: "media-grid" }), filter = "all", files = [], usage = "";
    var filt = h("div", { class: "toolbar", "data-nodirty": "1" }, ["all", "inUse", "unused"].map(function (k) {
      return h("button", { type: "button", class: "chip" + (k === "all" ? " on" : ""), "data-f": k, on: { click: function (e) { filter = k; A.$$("[data-f]", filt).forEach(function (b) { b.classList.toggle("on", b === e.currentTarget); }); render(); } } }, t(k === "all" ? "md.all" : "md." + k));
    }));
    var up = A.fImage(t("btn.upload"), "", { folder: "library", onChange: function () { load(); } });
    up.setAttribute("data-nodirty", "1");
    function listAll(prefix, depth) {
      return db.storage.from("site-media").list(prefix, { limit: 1000, sortBy: { column: "created_at", order: "desc" } }).then(function (r) {
        if (r.error) throw r.error;
        var out = [], jobs = [];
        (r.data || []).forEach(function (o) {
          var path = prefix ? prefix + "/" + o.name : o.name;
          if (!o.id && depth < 5) jobs.push(listAll(path, depth + 1).then(function (x) { out = out.concat(x); }));
          else if (o.id) out.push({ path: path, name: o.name, size: o.metadata && o.metadata.size, created: o.created_at });
        });
        return Promise.all(jobs).then(function () { return out; });
      });
    }
    function loadUsage() {
      var tbl = [["team_members", "photo_url"], ["team_groups", "image_url"], ["sponsors", "logo_url"], ["applications", "image_url"], ["committees", "image_url"], ["page_sections", "settings"], ["site_settings", "value"]];
      return Promise.all(tbl.map(function (x) { return db.from(x[0]).select(x[1]); })).then(function (res) { usage = res.map(function (r) { return JSON.stringify(r.data || []); }).join(" "); });
    }
    function inUse(f) { return usage.indexOf(f.path) >= 0 || usage.indexOf(encodeURI(f.path)) >= 0; }
    function render() {
      grid.innerHTML = "";
      var shown = files.filter(function (f) { return filter === "all" || (filter === "inUse") === inUse(f); });
      if (!shown.length) { grid.appendChild(h("div", { class: "empty", style: { gridColumn: "1/-1" } }, t("md.empty"))); return; }
      shown.forEach(function (f) {
        var url = A.publicUrl(f.path), used = inUse(f);
        grid.appendChild(h("div", { class: "media-item" }, h("div", { class: "mi-img" }, h("img", { src: url, alt: "", loading: "lazy" })),
          h("div", { class: "mi-body" }, h("div", { class: "mi-name", title: f.path }, f.name), h("div", null, (f.size ? Math.round(f.size / 1024) + " KB " : ""), A.badge(used ? t("md.inUse") : t("md.unused"), used ? "ok" : "")),
            h("div", { class: "mi-actions" },
              h("button", { type: "button", class: "btn btn-sm", on: { click: function () { (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { A.toast(t("msg.copied"), "ok"); }, function () { window.prompt("URL", url); }); } } }, t("btn.copy")),
              h("button", { type: "button", class: "btn btn-sm btn-danger", on: { click: function () {
                A.confirm(used ? t("md.deleteUsed") : t("msg.confirmDelete"), t("btn.delete")).then(function (ok) {
                  if (!ok) return;
                  db.storage.from("site-media").remove([f.path]).then(function (r) { if (r.error) return A.fail(r.error); A.toast(t("msg.deleted"), "ok"); load(); });
                });
              } } }, t("btn.delete"))))));
      });
    }
    function load() { grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><span class="spinner sm"></span></div>'; return Promise.all([listAll("", 0), loadUsage()]).then(function (r) { files = r[0]; render(); }).catch(A.fail); }
    view.appendChild(A.card(t("btn.upload"), up));
    view.appendChild(A.card(t("md.title"), [filt, grid]));
    return load();
  } });

  A.start();
})();
