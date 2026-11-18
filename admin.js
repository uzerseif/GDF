/* =====================================================================
   GDF'27 Content Studio — core (auth, UI kit, uploads, data helpers).
   Pages are registered in admin-pages.js.
   Security: only the publishable key is used; every write is checked by
   Row Level Security (admin_users + is_staff()/is_admin()) in Supabase.
   ===================================================================== */
(function () {
  "use strict";
  var cfg = window.GDF_SUPABASE || {};
  var A = window.CMSA = { pages: {}, order: [] };
  var db = A.db = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "gdf-admin-auth" } });
  var DICT = window.ADMIN_I18N || { en: {} };
  var LANG_KEY = "gdf-admin-lang";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  A.$ = $; A.$$ = $$;

  /* ---------------- interface language (independent from the public site) ---------------- */
  A.lang = (function () { try { var l = localStorage.getItem(LANG_KEY); return DICT[l] ? l : "en"; } catch (e) { return "en"; } })();
  var t = A.t = function (k) { return (DICT[A.lang] && DICT[A.lang][k]) || DICT.en[k] || k; };
  function applyLang() {
    document.documentElement.lang = A.lang;
    document.documentElement.dir = A.lang === "ar" ? "rtl" : "ltr";
    $$("[data-t]").forEach(function (el) { el.textContent = t(el.getAttribute("data-t")); });
    $$("[data-admin-lang]").forEach(function (box) {
      box.innerHTML = "";
      ["en", "ar", "tr"].forEach(function (l) {
        var b = h("button", { type: "button", class: "chip" + (l === A.lang ? " on" : ""), title: t("lang." + l), on: { click: function () { setLang(l); } } }, l.toUpperCase());
        box.appendChild(b);
      });
    });
  }
  function setLang(l) {
    A.lang = l;
    try { localStorage.setItem(LANG_KEY, l); } catch (e) { /* ignore */ }
    applyLang();
    if (A.user) { buildNav(); if (!A.dirty) A.go(A.current, true); else $("#pageTitle").textContent = t(A.pages[A.current].title); }
  }

  /* ---------------- DOM helpers ---------------- */
  var h = A.h = function (tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === undefined || v === null || v === false) return;
      if (k === "on") Object.keys(v).forEach(function (ev) { el.addEventListener(ev, v[ev]); });
      else if (k === "class") el.className = v;
      else if (k === "html") el.innerHTML = v;
      else if (k === "text") el.textContent = v;
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k in el && typeof v !== "string" && k !== "list") el[k] = v;
      else el.setAttribute(k, v === true ? "" : v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  };
  function append(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  A.esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  A.tx = function (o) { return o && typeof o === "object" ? (o[A.lang] || o.en || "") : (o || ""); };
  A.slugify = function (s) { return String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60); };
  A.validUrl = function (u, opts) {
    u = String(u || "").trim();
    if (!u) return !(opts && opts.required);
    if (opts && opts.https) return /^https:\/\/[^\s"'<>]+$/i.test(u);
    return /^(https?:\/\/[^\s"'<>]+|mailto:[^\s"'<>]+|tel:[+\d\s()-]+|#[\w-]*|[a-z0-9._~\/-]+(?:\.html)?\/?([?#][^\s"'<>]*)?)$/i.test(u);
  };

  /* ---------------- toasts / dialogs ---------------- */
  A.toast = function (msg, type) {
    var el = h("div", { class: "toast " + (type || ""), role: type === "error" ? "alert" : "status" }, msg);
    $("#toasts").appendChild(el);
    setTimeout(function () { el.remove(); }, type === "error" ? 7000 : 3500);
  };
  A.fail = function (err, fallback) {
    var m = (err && (err.message || err.error_description || err.error)) || fallback || t("msg.error");
    if (/row-level security|permission denied|violates row-level/i.test(m)) m = t("msg.adminOnly") + " (" + m + ")";
    A.toast(t("msg.error") + ": " + m, "error");
    console.warn("CMS:", m);
  };
  A.modal = function (opts) {
    var root = $("#modalRoot"), last = document.activeElement;
    var body = h("div", { class: "modal-body" }, opts.body);
    var foot = h("div", { class: "modal-foot" });
    var box = h("div", { class: "modal " + (opts.size || ""), role: "dialog", "aria-modal": "true", "aria-label": opts.title },
      h("div", { class: "modal-head" }, h("h2", null, opts.title), h("button", { type: "button", class: "icon-btn", "aria-label": t("btn.close"), on: { click: function () { api.close(); } } }, "✕")),
      body, foot);
    var bd = h("div", { class: "modal-backdrop" }, box);
    var api = {
      el: box, body: body,
      close: function () { bd.remove(); document.removeEventListener("keydown", onKey); if (last && last.focus) last.focus(); if (opts.onClose) opts.onClose(); }
    };
    (opts.actions || []).forEach(function (a) {
      var b = h("button", { type: "button", class: "btn " + (a.cls || ""), on: { click: function () { a.onClick(api, b); } } }, a.label);
      foot.appendChild(b);
    });
    if (!foot.children.length) foot.remove();
    function onKey(e) { if (e.key === "Escape") api.close(); }
    document.addEventListener("keydown", onKey);
    bd.addEventListener("mousedown", function (e) { if (e.target === bd) api.close(); });
    root.appendChild(bd);
    setTimeout(function () { var f = box.querySelector("input,textarea,select,.modal-foot .btn"); if (f) f.focus(); }, 30);
    return api;
  };
  A.confirm = function (msg, okLabel, danger) {
    return new Promise(function (resolve) {
      var done = false;
      A.modal({ title: t("btn.confirm"), size: "sm", body: h("p", null, msg), onClose: function () { if (!done) resolve(false); },
        actions: [{ label: t("btn.cancel"), cls: "btn-ghost", onClick: function (m) { m.close(); } },
          { label: okLabel || t("btn.confirm"), cls: danger === false ? "btn-gold" : "btn-danger", onClick: function (m) { done = true; m.close(); resolve(true); } }] });
    });
  };
  A.busy = function (btn, on, label) {
    if (!btn) return;
    if (on) { btn._label = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> ' + A.esc(label || t("btn.saving")); }
    else { btn.disabled = false; if (btn._label) btn.innerHTML = btn._label; }
  };

  /* ---------------- dirty tracking ---------------- */
  A.dirty = false;
  A.setDirty = function (on) {
    A.dirty = !!on;
    var b = $("#dirtyBadge"); if (b) b.hidden = !A.dirty;
  };
  window.addEventListener("beforeunload", function (e) { if (A.dirty) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------------- form fields ---------------- */
  function wrap(label, input, help) {
    return h("label", { class: "field" }, label ? h("span", null, label) : null, input, help ? h("small", null, help) : null);
  }
  A.fText = function (label, value, o) {
    o = o || {};
    var input = o.multiline ? h("textarea", { rows: o.rows || 4, placeholder: o.placeholder || "" }) : h("input", { type: o.type || "text", placeholder: o.placeholder || "", dir: o.dir });
    input.value = value == null ? "" : value;
    var el = wrap(label, input, o.help);
    el.get = function () { return input.value.trim(); };
    el.set = function (v) { input.value = v == null ? "" : v; };
    el.input = input;
    el.validate = function () {
      var v = el.get(), ok = true;
      if (o.required && !v) ok = false;
      if (ok && o.url && !A.validUrl(v, { https: o.https })) ok = false;
      if (ok && o.pattern && v && !o.pattern.test(v)) ok = false;
      el.classList.toggle("invalid", !ok);
      if (!ok) { input.focus(); A.toast(o.url ? t("msg.invalidUrl") : (o.patternMsg || t("msg.required")), "error"); }
      return ok;
    };
    return el;
  };
  A.fToggle = function (label, checked) {
    var input = h("input", { type: "checkbox" });
    input.checked = checked !== false;
    var el = h("label", { class: "toggle" }, input, h("span", null, label));
    el.get = function () { return input.checked; };
    el.set = function (v) { input.checked = !!v; };
    el.input = input;
    return el;
  };
  A.fSelect = function (label, value, options) {
    var sel = h("select");
    options.forEach(function (o) { var op = h("option", { value: o[0] }, o[1]); sel.appendChild(op); });
    sel.value = value == null ? options[0] && options[0][0] : value;
    var el = wrap(label, sel);
    el.get = function () { return sel.value; };
    el.set = function (v) { sel.value = v; };
    el.input = sel;
    return el;
  };
  var HEX = /^#[0-9a-fA-F]{6}$/;
  A.fColor = function (label, value, placeholder) {
    var picker = h("input", { type: "color" }), text = h("input", { type: "text", placeholder: placeholder || "#______", maxlength: 9 });
    function sync(v) { text.value = v || ""; picker.value = HEX.test(v || "") ? v : (HEX.test(placeholder || "") ? placeholder : "#000000"); }
    sync(value);
    picker.addEventListener("input", function () { text.value = picker.value; text.dispatchEvent(new Event("input", { bubbles: true })); });
    text.addEventListener("input", function () { if (HEX.test(text.value)) picker.value = text.value; });
    var clear = h("button", { type: "button", class: "icon-btn", title: t("btn.reset"), on: { click: function () { sync(""); text.dispatchEvent(new Event("input", { bubbles: true })); } } }, "↺");
    var el = wrap(label, h("div", { class: "color-field" }, picker, text, clear));
    el.get = function () { var v = text.value.trim(); return /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : ""; };
    el.set = sync;
    return el;
  };

  /* Translated value {en, ar, tr}. o.defaults = original texts (fallback + "reset"). */
  A.fI18n = function (label, value, o) {
    o = o || {};
    var defs = o.defaults || {}, cur = "en";
    value = value || {};
    var inputs = {};
    var tabs = h("div", { class: "i18n-tabs", role: "tablist" });
    var body = h("div", { class: "i18n-body" });
    ["en", "ar", "tr"].forEach(function (l) {
      var inp = o.multiline ? h("textarea", { rows: o.rows || 4, "data-lang": l }) : h("input", { type: "text", "data-lang": l });
      inp.value = value[l] != null && value[l] !== "" ? value[l] : (defs[l] || "");
      inp.placeholder = l === "en" ? (o.placeholder || "") : (value.en || defs.en || "");
      inp.hidden = l !== "en";
      inp.lang = l;
      inp.addEventListener("input", mark);
      inputs[l] = inp;
      body.appendChild(inp);
      tabs.appendChild(h("button", { type: "button", class: "i18n-tab" + (l === "en" ? " on" : ""), "data-l": l, on: { click: function () { show(l); } } }, l.toUpperCase()));
    });
    function show(l) {
      cur = l;
      ["en", "ar", "tr"].forEach(function (x) { inputs[x].hidden = x !== l; });
      $$(".i18n-tab", tabs).forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-l") === l); });
    }
    function mark() {
      $$(".i18n-tab", tabs).forEach(function (b) {
        var l = b.getAttribute("data-l");
        b.classList.toggle("edited", !!inputs[l].value.trim() && inputs[l].value.trim() !== String(defs[l] || "").trim());
      });
    }
    var hint = h("div", { class: "hint" }, h("span", null, o.html ? t("f.htmlHint") : (o.defaults ? t("f.fallback") : "")),
      o.defaults ? h("button", { type: "button", class: "reset-txt", on: { click: function () { ["en", "ar", "tr"].forEach(function (l) { inputs[l].value = defs[l] || ""; }); mark(); body.dispatchEvent(new Event("input", { bubbles: true })); } } }, t("btn.reset")) : null);
    body.appendChild(hint);
    var el = h("div", { class: "i18n field" }, h("div", { class: "i18n-head" }, h("span", { class: "lbl" }, label + (o.required ? " *" : "")), tabs), body);
    mark();
    el.get = function () {
      var out = {};
      ["en", "ar", "tr"].forEach(function (l) { var v = inputs[l].value.trim(); if (v) out[l] = v; });
      return out;
    };
    /* only the languages that differ from the original texts */
    el.diff = function () {
      var out = {};
      ["en", "ar", "tr"].forEach(function (l) { var v = inputs[l].value.trim(); if (v && v !== String(defs[l] || "").trim()) out[l] = v; });
      return out;
    };
    el.getOrNull = function () { var v = el.get(); return Object.keys(v).length ? v : null; };
    el.validate = function () {
      var ok = !o.required || !!inputs.en.value.trim();
      el.classList.toggle("invalid", !ok);
      if (!ok) { show("en"); inputs.en.focus(); A.toast(label + ": " + t("msg.required"), "error"); }
      return ok;
    };
    el.inputs = inputs;
    return el;
  };

  /* ---------------- image upload (Supabase Storage, bucket site-media) ---------------- */
  var TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }, MAX = 5 * 1024 * 1024;
  A.publicUrl = function (path) { return cfg.url.replace(/\/$/, "") + "/storage/v1/object/public/site-media/" + path.split("/").map(encodeURIComponent).join("/"); };
  A.upload = function (file, folder, onProgress) {
    return new Promise(function (resolve, reject) {
      if (!file || !TYPES[file.type]) return reject(new Error(t("up.badType")));
      if (file.size > MAX) return reject(new Error(t("up.tooBig")));
      db.auth.getSession().then(function (r) {
        var token = r.data && r.data.session && r.data.session.access_token;
        if (!token) return reject(new Error("Not signed in"));
        var d = new Date(), base = A.slugify(file.name.replace(/\.[^.]+$/, "")) || "image";
        var path = (folder || "misc") + "/" + d.getFullYear() + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + base + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + "." + TYPES[file.type];
        var xhr = new XMLHttpRequest();
        xhr.open("POST", cfg.url.replace(/\/$/, "") + "/storage/v1/object/site-media/" + path);
        xhr.setRequestHeader("Authorization", "Bearer " + token);
        xhr.setRequestHeader("apikey", cfg.key);
        xhr.setRequestHeader("x-upsert", "false");
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.setRequestHeader("Cache-Control", "max-age=31536000");
        xhr.upload.onprogress = function (e) { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
        xhr.onload = function () {
          if (xhr.status >= 200 && xhr.status < 300) resolve({ path: path, url: A.publicUrl(path) });
          else { var m = xhr.responseText; try { m = JSON.parse(m).message || m; } catch (e) { /* text */ } reject(new Error(m || ("HTTP " + xhr.status))); }
        };
        xhr.onerror = function () { reject(new Error("Network error")); };
        xhr.send(file);
      });
    });
  };
  A.fImage = function (label, url, o) {
    o = o || {};
    var value = url || "";
    var thumb = h("div", { class: "thumb" });
    var file = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp", hidden: true, "data-nodirty": "1" });
    var bar = h("div", { class: "progress", hidden: true }, h("i"));
    var removeBtn = h("button", { type: "button", class: "btn btn-sm btn-danger", on: { click: function () { set(""); changed(); } } }, t("btn.remove"));
    var pickBtn = h("button", { type: "button", class: "btn btn-sm", on: { click: function () { file.click(); } } }, t("btn.upload"));
    var box = h("div", { class: "uploader" }, thumb, h("div", null,
      h("div", { class: "u-hint" }, t("up.drop")), h("div", { class: "u-hint small" }, t("up.types")),
      h("div", { class: "u-actions" }, pickBtn, removeBtn), bar, file));
    function set(v) {
      value = v || "";
      thumb.innerHTML = "";
      if (value) {
        var src = /^https?:/i.test(value) || value.charAt(0) === "/" ? value : value;
        thumb.appendChild(h("img", { src: src, alt: "" }));
      } else thumb.appendChild(h("span", null, t("up.none")));
      pickBtn.textContent = value ? t("btn.replace") : t("btn.upload");
      removeBtn.hidden = !value || o.required;
    }
    function changed() { box.dispatchEvent(new Event("input", { bubbles: true })); if (o.onChange) o.onChange(value); }
    function handle(f) {
      if (!f) return;
      bar.hidden = false; bar.firstChild.style.width = "0%";
      pickBtn.disabled = true;
      A.upload(f, o.folder, function (p) { bar.firstChild.style.width = Math.round(p * 100) + "%"; }).then(function (r) {
        set(r.url); changed(); A.toast(t("up.done"), "ok");
      }, function (e) { A.toast(t("up.failed") + ": " + e.message, "error"); }).then(function () {
        pickBtn.disabled = false; file.value = ""; setTimeout(function () { bar.hidden = true; }, 600);
      });
    }
    file.addEventListener("change", function () { handle(file.files[0]); });
    thumb.addEventListener("click", function () { file.click(); });
    ["dragenter", "dragover"].forEach(function (ev) { box.addEventListener(ev, function (e) { if (e.dataTransfer && [].indexOf.call(e.dataTransfer.types, "Files") >= 0) { e.preventDefault(); box.classList.add("drag"); } }); });
    ["dragleave", "drop"].forEach(function (ev) { box.addEventListener(ev, function () { box.classList.remove("drag"); }); });
    box.addEventListener("drop", function (e) { if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); handle(e.dataTransfer.files[0]); } });
    set(value);
    var el = h("div", { class: "field" }, label ? h("span", { class: "field-label" }, label) : null, box);
    el.get = function () { return value; };
    el.set = set;
    el.validate = function () { var ok = !o.required || !!value; if (!ok) A.toast(label + ": " + t("msg.required"), "error"); box.classList.toggle("invalid", !ok); return ok; };
    el.upload = handle;
    return el;
  };

  /* ---------------- drag & drop ordering ---------------- */
  /* Makes the .row children of `list` sortable. onDrop(rowEl, targetList) is called after a move. */
  var dragEl = null;
  A.sortable = function (list, onDrop, group) {
    list.classList.add("drop-zone");
    list.setAttribute("data-sort-group", group || "default");
    list.addEventListener("dragstart", function (e) {
      var row = e.target.closest && e.target.closest(".row[draggable]");
      if (!row || row.parentNode !== list) return;
      dragEl = row; row.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", row.getAttribute("data-id") || ""); } catch (x) { /* ie */ }
    });
    list.addEventListener("dragend", function () { if (dragEl) dragEl.classList.remove("dragging"); dragEl = null; $$(".drop-before,.drop-after").forEach(function (r) { r.classList.remove("drop-before", "drop-after"); }); $$(".drop-zone.over").forEach(function (z) { z.classList.remove("over"); }); });
    list.addEventListener("dragover", function (e) {
      if (!dragEl || dragEl.parentNode.getAttribute("data-sort-group") !== list.getAttribute("data-sort-group")) return;
      e.preventDefault();
      list.classList.add("over");
      var rows = $$(":scope > .row", list).filter(function (r) { return r !== dragEl; });
      $$(".drop-before,.drop-after", list).forEach(function (r) { r.classList.remove("drop-before", "drop-after"); });
      var after = null;
      rows.some(function (r) { var b = r.getBoundingClientRect(); if (e.clientY < b.top + b.height / 2) { after = r; return true; } return false; });
      if (after) after.classList.add("drop-before"); else if (rows.length) rows[rows.length - 1].classList.add("drop-after");
      list._dropBefore = after;
    });
    list.addEventListener("dragleave", function (e) { if (!list.contains(e.relatedTarget)) list.classList.remove("over"); });
    list.addEventListener("drop", function (e) {
      if (!dragEl || dragEl.parentNode.getAttribute("data-sort-group") !== list.getAttribute("data-sort-group")) return;
      e.preventDefault();
      var empty = list.querySelector(":scope > .empty"); if (empty) empty.remove();
      list.insertBefore(dragEl, list._dropBefore || null);
      var moved = dragEl;
      list.classList.remove("over");
      if (onDrop) onDrop(moved, list);
    });
  };
  /* keyboard / button alternative */
  A.moveRow = function (row, dir) {
    var sib = dir < 0 ? row.previousElementSibling : row.nextElementSibling;
    if (!sib || !sib.classList.contains("row")) return false;
    if (dir < 0) row.parentNode.insertBefore(row, sib); else row.parentNode.insertBefore(sib, row);
    return true;
  };
  /* Saves sort_order = position for every row in `list` (data-id) of `table`. */
  A.saveOrder = function (table, list, extra) {
    var ids = $$(":scope > .row", list).map(function (r) { return r.getAttribute("data-id"); }).filter(Boolean);
    return Promise.all(ids.map(function (id, i) {
      var patch = Object.assign({ sort_order: i }, extra ? extra(id) : {});
      return db.from(table).update(patch).eq("id", id);
    })).then(function (res) {
      var bad = res.filter(function (r) { return r.error; })[0];
      if (bad) throw bad.error;
      A.toast(t("msg.orderSaved"), "ok");
    }).catch(A.fail);
  };
  /* A list row with drag handle + up/down buttons + actions */
  A.row = function (o) {
    var r = h("div", { class: "row", draggable: o.draggable === false ? null : "true", "data-id": o.id },
      o.draggable === false ? null : h("span", { class: "handle", title: "Drag", "aria-hidden": "true" }, "⋮⋮"),
      o.thumb !== undefined ? (o.thumb ? h("img", { class: "r-thumb" + (o.contain ? " contain" : ""), src: o.thumb, alt: "", loading: "lazy" }) : h("span", { class: "r-thumb" })) : null,
      h("div", { class: "r-main" }, h("div", { class: "r-title" }, o.title, o.badges || null), o.sub ? h("div", { class: "r-sub" }, o.sub) : null),
      h("div", { class: "r-actions" },
        o.onMove ? h("button", { type: "button", class: "icon-btn", title: t("btn.up"), "aria-label": t("btn.up"), on: { click: function () { if (A.moveRow(r, -1)) o.onMove(r); } } }, "↑") : null,
        o.onMove ? h("button", { type: "button", class: "icon-btn", title: t("btn.down"), "aria-label": t("btn.down"), on: { click: function () { if (A.moveRow(r, 1)) o.onMove(r); } } }, "↓") : null,
        o.onEdit ? h("button", { type: "button", class: "icon-btn", title: t("btn.edit"), "aria-label": t("btn.edit"), on: { click: o.onEdit } }, "✎") : null,
        o.onDelete ? h("button", { type: "button", class: "icon-btn danger", title: t("btn.delete"), "aria-label": t("btn.delete"), on: { click: o.onDelete } }, "🗑") : null,
        o.actions || null));
    return r;
  };
  A.badge = function (text, cls) { return h("span", { class: "badge " + (cls || "") }, text); };

  /* Repeatable list editor (nav items, phones, partners, bullets…) */
  A.fList = function (label, items, renderItem, newItem, o) {
    o = o || {};
    var box = h("div", { class: "list-editor" });
    var entries = [];
    function add(item) {
      var ent = renderItem(item || newItem());
      var row = h("div", { class: "li-row" },
        h("div", { class: "li-tools" },
          h("button", { type: "button", class: "icon-btn", title: t("btn.up"), on: { click: function () { var p = row.previousElementSibling; if (p) { box.insertBefore(row, p); changed(); } } } }, "↑"),
          h("button", { type: "button", class: "icon-btn", title: t("btn.down"), on: { click: function () { var n = row.nextElementSibling; if (n && n.classList.contains("li-row")) { box.insertBefore(n, row); changed(); } } } }, "↓")),
        h("div", { class: "li-body" }, ent.el),
        h("button", { type: "button", class: "icon-btn danger", title: t("btn.remove"), on: { click: function () { row.remove(); entries = entries.filter(function (x) { return x !== ent; }); changed(); } } }, "✕"));
      row._ent = ent;
      entries.push(ent);
      box.insertBefore(row, addBtn);
    }
    function changed() { box.dispatchEvent(new Event("input", { bubbles: true })); }
    var addBtn = h("button", { type: "button", class: "btn btn-sm", on: { click: function () { add(null); changed(); } } }, "+ " + (o.addLabel || t("btn.addItem")));
    box.appendChild(addBtn);
    (items || []).forEach(add);
    var el = h("div", { class: "field" }, label ? h("span", { class: "field-label" }, label) : null, o.help ? h("small", null, o.help) : null, box);
    el.get = function () { return $$(":scope > .li-row", box).map(function (r) { return r._ent.get(); }).filter(function (x) { return x !== null && x !== undefined; }); };
    el.validate = function () { return $$(":scope > .li-row", box).every(function (r) { return !r._ent.validate || r._ent.validate(); }); };
    return el;
  };

  /* ---------------- CMS data: texts, sections, settings ---------------- */
  var DEF = (window.GDF_CMS_DEFAULTS && window.GDF_CMS_DEFAULTS.texts) || {};
  var TR = window.GDF_TRANSLATIONS || {};
  function decode(s) { var ta = document.createElement("textarea"); ta.innerHTML = s; return ta.value; }
  A.textDefaults = function (key) {
    var d = DEF[key] || {};
    var en = d.en || "";
    en = d.html ? en.replace(/<br\s*\/?>/gi, "<br>") : decode(en.replace(/<[^>]+>/g, ""));
    return { en: en.trim(), ar: (TR.ar && TR.ar[key]) || "", tr: (TR.tr && TR.tr[key]) || "" };
  };
  A.isHtmlKey = function (key) { return !!(DEF[key] && DEF[key].html); };
  A.allTextKeys = function () { return Object.keys(DEF); };
  A.textPages = function (key) { return (DEF[key] && DEF[key].pages) || []; };
  A.data = { texts: {}, sections: {}, settings: {} };
  A.loadCore = function () {
    return Promise.all([
      db.from("site_texts").select("key,value"),
      db.from("page_sections").select("*"),
      db.from("site_settings").select("key,value")
    ]).then(function (r) {
      A.migrationOk = !r[0].error && !r[1].error;
      $("#banner").hidden = A.migrationOk;
      if (!A.migrationOk) $("#banner").textContent = t("msg.migration");
      A.data.texts = {}; (r[0].data || []).forEach(function (x) { A.data.texts[x.key] = x.value || {}; });
      A.data.sections = {}; (r[1].data || []).forEach(function (x) { A.data.sections[x.page + ":" + x.section_key] = x; });
      A.data.settings = {}; (r[2].data || []).forEach(function (x) { A.data.settings[x.key] = x.value; });
    });
  };
  /* Translated text field bound to a site_texts key (pre-filled with the current website text). */
  A.textField = function (key, label, o) {
    o = Object.assign({}, o || {});
    var defs = A.textDefaults(key), cur = A.data.texts[key] || {};
    o.defaults = defs;
    o.html = o.html === undefined ? A.isHtmlKey(key) : o.html;
    if (o.multiline === undefined) o.multiline = (defs.en || "").length > 90;
    var merged = { en: cur.en || defs.en, ar: cur.ar || defs.ar, tr: cur.tr || defs.tr };
    var f = A.fI18n(label || defs.en || key, merged, o);
    f.textKey = key;
    f.setAttribute("data-key", key);
    return f;
  };
  A.saveTexts = function (fields) {
    var ups = [], dels = [];
    fields.forEach(function (f) {
      if (!f || !f.textKey) return;
      var d = f.diff();
      if (Object.keys(d).length) ups.push({ key: f.textKey, value: d, is_html: A.isHtmlKey(f.textKey) });
      else if (A.data.texts[f.textKey]) dels.push(f.textKey);
    });
    var jobs = [];
    if (ups.length) jobs.push(db.from("site_texts").upsert(ups, { onConflict: "key" }));
    if (dels.length) jobs.push(db.from("site_texts").delete().in("key", dels));
    return Promise.all(jobs).then(function (res) {
      var bad = res.filter(function (r) { return r.error; })[0];
      if (bad) throw bad.error;
      ups.forEach(function (u) { A.data.texts[u.key] = u.value; });
      dels.forEach(function (k) { delete A.data.texts[k]; });
    });
  };
  A.textDraft = function (fields) {
    var out = {};
    fields.forEach(function (f) { if (f && f.textKey) out[f.textKey] = f.get(); });
    return out;
  };
  A.section = function (page, key) { return A.data.sections[page + ":" + key] || { page: page, section_key: key, is_visible: true, sort_order: 0, settings: {} }; };
  A.saveSection = function (page, key, patch) {
    var row = Object.assign({ page: page, section_key: key }, patch);
    if (!A.data.sections[page + ":" + key] && row.sort_order === undefined) row.sort_order = 0;
    return db.from("page_sections").upsert(row, { onConflict: "page,section_key" }).select().single().then(function (r) {
      if (r.error) throw r.error;
      A.data.sections[page + ":" + key] = r.data;
      return r.data;
    });
  };
  A.saveSetting = function (key, value, label) {
    return db.from("site_settings").upsert({ key: key, value: value, label: label || null }, { onConflict: "key" }).select().then(function (r) {
      if (r.error) throw r.error;
      if (!r.data || !r.data.length) throw new Error(t("msg.adminOnly"));
      A.data.settings[key] = value;
    });
  };
  /* get/set a dotted path inside an object */
  A.getPath = function (o, p) { return p.split(".").reduce(function (a, k) { return a && a[k] !== undefined ? a[k] : undefined; }, o); };
  A.setPath = function (o, p, v) {
    var ks = p.split("."), last = ks.pop(), cur = o;
    ks.forEach(function (k) { if (!cur[k] || typeof cur[k] !== "object") cur[k] = {}; cur = cur[k]; });
    if (v === "" || v === undefined || v === null) delete cur[last]; else cur[last] = v;
  };

  /* ---------------- live preview ---------------- */
  var pv = { file: null, last: null, lang: "en", ready: false };
  A.preview = {
    available: function (file) {
      pv.file = file || null;
      $("#previewToggle").hidden = !file;
      if (!file) { $("#preview").hidden = true; return; }
      if (!$("#preview").hidden) A.preview.load();
    },
    open: function () { $("#preview").hidden = false; A.preview.load(); },
    close: function () { $("#preview").hidden = true; },
    load: function () {
      if (!pv.file) return;
      var f = $("#previewFrame");
      pv.ready = false;
      f.onload = function () { pv.ready = true; setTimeout(function () { if (pv.last) A.preview.send(pv.last); }, 400); };
      f.src = pv.file + (pv.file.indexOf("?") < 0 ? "?" : "&") + "cms-preview=1&t=" + Date.now();
    },
    send: function (msg) {
      pv.last = msg;
      var f = $("#previewFrame");
      if ($("#preview").hidden || !pv.ready || !f.contentWindow) return;
      f.contentWindow.postMessage(Object.assign({ type: "gdf-cms-preview", lang: pv.lang }, msg), location.origin);
    },
    reload: function () { pv.last = null; A.preview.load(); }
  };
  var pvTimer = null;
  A.queuePreview = function (fn) { clearTimeout(pvTimer); pvTimer = setTimeout(function () { try { var m = fn(); if (m) A.preview.send(m); } catch (e) { console.warn(e); } }, 250); };

  /* ---------------- standard page pieces ---------------- */
  A.card = function (title, children, o) {
    o = o || {};
    return h("section", { class: "card" }, title || o.actions ? h("div", { class: "card-head" }, h("h2", null, title || ""), o.actions || null) : null, o.help ? h("p", { class: "muted small", style: { marginTop: "-6px" } }, o.help) : null, children);
  };
  A.grid = function (n, children) { return h("div", { class: "grid grid-" + n }, children); };
  A.pageHead = function (title, desc, actions) { return h("div", { class: "page-head" }, h("div", null, h("p", { class: "muted", style: { margin: 0 } }, desc || "")), actions || null); };
  A.saveBar = function (onSave, note) {
    var btn = h("button", { type: "button", class: "btn btn-gold", on: { click: function () {
      A.busy(btn, true);
      Promise.resolve().then(onSave).then(function (ok) {
        if (ok === false) return;
        A.setDirty(false); A.toast(t("msg.saved"), "ok"); A.preview.reload();
      }).catch(A.fail).then(function () { A.busy(btn, false); });
    } } }, t("btn.save"));
    return h("div", { class: "savebar" }, note ? h("span", { class: "note" }, note) : null, btn);
  };
  A.tabs = function (defs, onShow) {
    var bar = h("div", { class: "tabs", role: "tablist" });
    var host = h("div");
    defs.forEach(function (d, i) {
      bar.appendChild(h("button", { type: "button", class: "tab" + (i === 0 ? " on" : ""), "data-k": d.key, on: { click: function () { select(d.key); } } }, d.label));
    });
    function select(k) {
      if (A.dirty && !window.confirm(t("msg.unsaved"))) return;
      A.setDirty(false);
      $$(".tab", bar).forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-k") === k); });
      host.innerHTML = "";
      var d = defs.filter(function (x) { return x.key === k; })[0];
      Promise.resolve(d.render(host)).catch(A.fail);
      if (onShow) onShow(k);
    }
    setTimeout(function () { select(defs[0].key); }, 0);
    return h("div", null, bar, host);
  };
  A.validateAll = function (fields) { return fields.every(function (f) { return !f || !f.validate || f.validate(); }); };

  /* ---------------- navigation ---------------- */
  A.register = function (id, def) { A.pages[id] = def; A.order.push(id); };
  function buildNav() {
    var nav = $("#sideNav"); nav.innerHTML = "";
    var group = null, groups = ["overview", "pages", "content", "system"];
    A.order.slice().sort(function (a, b) { return groups.indexOf(A.pages[a].group) - groups.indexOf(A.pages[b].group) || A.order.indexOf(a) - A.order.indexOf(b); }).forEach(function (id) {
      var p = A.pages[id];
      if (p.group !== group) { group = p.group; nav.appendChild(h("div", { class: "nav-group" }, t("nav.group." + group))); }
      nav.appendChild(h("button", { type: "button", class: "nav-item" + (id === A.current ? " active" : ""), "data-section": id, on: { click: function () { A.go(id); } } }, h("span", { class: "ico", "aria-hidden": "true" }, p.icon), h("span", null, t(p.title))));
    });
  }
  A.go = function (id, force) {
    if (!A.pages[id]) id = "dashboard";
    if (!force && A.dirty && !window.confirm(t("msg.unsaved"))) return;
    A.setDirty(false);
    A.current = id;
    try { history.replaceState(null, "", "#" + id); } catch (e) { /* ignore */ }
    $$(".nav-item").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-section") === id); });
    $("#appView").classList.remove("nav-open");
    var p = A.pages[id], view = $("#view");
    $("#pageTitle").textContent = t(p.title);
    document.title = t(p.title) + " · " + t("app.title");
    view.innerHTML = '<div class="empty"><span class="spinner sm"></span> ' + A.esc(t("msg.loading")) + "</div>";
    A.preview.available(p.preview || null);
    Promise.resolve().then(function () { view.innerHTML = ""; return p.render(view); }).catch(function (e) { A.fail(e); });
    view.style.animation = "none"; void view.offsetWidth; view.style.animation = "";
  };
  document.addEventListener("input", function (e) {
    if (!A.user || !e.target.closest || !e.target.closest("#view, .modal") || e.target.closest("[data-nodirty]")) return;
    if (e.target.closest("#view") && !e.target.closest(".toolbar")) A.setDirty(true);
  }, true);
  document.addEventListener("change", function (e) {
    if (!A.user || !e.target.closest || !e.target.closest("#view") || e.target.closest("[data-nodirty]") || e.target.closest(".toolbar")) return;
    A.setDirty(true);
  }, true);

  /* ---------------- auth ---------------- */
  function show(view) {
    $("#bootView").hidden = true;
    $("#loginView").hidden = view !== "login";
    $("#appView").hidden = view !== "app";
  }
  function loginError(msg) { var e = $("#loginError"); e.textContent = msg; e.hidden = !msg; }
  function enter(session) {
    return db.from("admin_users").select("role").eq("user_id", session.user.id).maybeSingle().then(function (r) {
      if (r.error || !r.data) {
        loginError(t("login.denied") + (r.error ? " (" + r.error.message + ")" : ""));
        return db.auth.signOut().then(function () { show("login"); });
      }
      A.user = session.user; A.role = r.data.role;
      $("#who").innerHTML = "<b>" + A.esc(t("role." + A.role)) + "</b>" + A.esc(session.user.email || "");
      show("app");
      return A.loadCore().then(function () {
        buildNav();
        A.go((location.hash || "").slice(1) || "dashboard", true);
      });
    });
  }
  $("#loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target, btn = f.querySelector("button[type=submit]");
    loginError("");
    if (!f.email.value || !f.password.value) { loginError(t("msg.required")); return; }
    A.busy(btn, true, t("login.busy"));
    db.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value }).then(function (r) {
      if (r.error) { loginError(t("login.failed") + ": " + r.error.message); return; }
      f.password.value = "";
      return enter(r.data.session);
    }).catch(function (err) { loginError(t("login.failed") + ": " + err.message); }).then(function () { A.busy(btn, false); });
  });
  $("#logoutBtn").addEventListener("click", function () {
    if (A.dirty && !window.confirm(t("msg.unsaved"))) return;
    A.setDirty(false);
    db.auth.signOut().then(function () { A.user = null; show("login"); });
  });
  db.auth.onAuthStateChange(function (ev) { if (ev === "SIGNED_OUT" && A.user) { A.user = null; show("login"); } });
  $("#menuToggle").addEventListener("click", function () { $("#appView").classList.toggle("nav-open"); });
  $("#sideBackdrop").addEventListener("click", function () { $("#appView").classList.remove("nav-open"); });
  $("#previewToggle").addEventListener("click", function () { if ($("#preview").hidden) A.preview.open(); else A.preview.close(); });
  $("#previewClose").addEventListener("click", A.preview.close);
  $("#previewReload").addEventListener("click", A.preview.reload);
  $$("[data-pv-lang]").forEach(function (b) {
    b.addEventListener("click", function () {
      pv.lang = b.getAttribute("data-pv-lang");
      $$("[data-pv-lang]").forEach(function (x) { x.classList.toggle("on", x === b); });
      A.preview.send(pv.last || {});
    });
  });

  A.start = function () {
    applyLang();
    db.auth.getSession().then(function (r) {
      var s = r.data && r.data.session;
      if (s) return enter(s);
      show("login");
    }).catch(function () { show("login"); });
  };
})();
