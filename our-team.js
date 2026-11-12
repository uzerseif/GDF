/* =========================================
   Our Team page — السلوك فقط (Behavior only)
   - الأسماء والأدوار والصور والنبذات  →  our-team.html
   - الألوان والأحجام والتخطيط          →  our-team.css
   - هذا الملف: تبديل التبويبات + نافذة الملف الشخصي + اللغة.
   لا تحتاج لتعديل هذا الملف لتغيير أي نص أو إضافة شخص.
   ========================================= */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  var lang = function () { return root.lang || "en"; };

  var tabsEl = $("tmTabs");
  var detail = $("tmDetail");
  var modal = $("tmModal");
  if (!tabsEl || !modal) return;

  var tabs = [].slice.call(tabsEl.querySelectorAll(".tm-tab"));
  var panels = [].slice.call(document.querySelectorAll(".tm-panel"));

  /* ================= 1. التبويبات ================= */

  var current = null;

  /* يخفي الحواف التي فيها تبويبات إضافية خارج الشاشة */
  function updateFades() {
    if (!tabs.length) return;
    var rtl = root.dir === "rtl";
    var leftmost = rtl ? tabs[tabs.length - 1] : tabs[0];
    var rightmost = rtl ? tabs[0] : tabs[tabs.length - 1];
    var box = tabsEl.getBoundingClientRect();
    tabsEl.style.setProperty("--fl", leftmost.getBoundingClientRect().left < box.left - 4 ? "36px" : "0px");
    tabsEl.style.setProperty("--fr", rightmost.getBoundingClientRect().right > box.right + 4 ? "36px" : "0px");
  }

  /* يُبقي التبويب النشط في المنتصف */
  function centerTab(instant) {
    var tab = tabsEl.querySelector('[aria-current="true"]');
    if (tab && tab.scrollIntoView) {
      tab.scrollIntoView({ inline: "center", block: "nearest", behavior: instant ? "auto" : "smooth" });
    }
    window.setTimeout(updateFades, instant ? 0 : 350);
  }

  function show(id, instant) {
    current = id;
    tabs.forEach(function (t) {
      if (t.dataset.tab === id) t.setAttribute("aria-current", "true");
      else t.removeAttribute("aria-current");
    });
    panels.forEach(function (p) { p.hidden = p.dataset.panel !== id; });
    centerTab(instant);
    try { history.replaceState(null, "", "#" + id); } catch (e) { /* ignore */ }
    if (!instant && detail) {
      var top = detail.getBoundingClientRect().top + window.pageYOffset - 110;
      if (top < window.pageYOffset) window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
  }

  tabsEl.addEventListener("click", function (e) {
    var b = e.target.closest(".tm-tab");
    if (b && b.dataset.tab !== current) show(b.dataset.tab);
  });
  tabsEl.addEventListener("scroll", updateFades, { passive: true });
  window.addEventListener("resize", function () { if (current) centerTab(true); });

  /* ================= 2. نافذة الملف الشخصي ================= */

  var openCard = null;     // البطاقة المفتوحة حالياً
  var lastFocus = null;

  function removeBrokenImg(img) {
    img.addEventListener("error", function () { img.remove(); });
    if (img.complete && img.naturalWidth === 0 && img.getAttribute("src")) img.remove();
  }

  /* النبذة: من صندوق id="bio-<data-bio>" في الـHTML، باللغة الحالية ثم الإنجليزية */
  function bioHTML(card) {
    var key = card.dataset.bio;
    var box = key && $("bio-" + key);
    if (!box) return "";
    var node = box.querySelector(':scope > [lang="' + lang() + '"]') || box.querySelector(':scope > [lang="en"]');
    return node ? node.innerHTML.trim() : "";
  }

  /* الاسم والدور والصورة تُقرأ من البطاقة نفسها، فأي تعديل في الـHTML ينعكس هنا */
  function fillModal(card) {
    var photo = $("tmMPhoto");
    photo.innerHTML = "";
    var src = card.querySelector(".tm-photo");
    if (src) {
      var img = document.createElement("img");
      img.alt = "";
      img.src = src.getAttribute("src");
      photo.appendChild(img);
      removeBrokenImg(img);
    }
    $("tmMRole").textContent = card.querySelector(".tm-role").textContent.trim();
    $("tmMName").textContent = card.querySelector(".tm-name").textContent.trim();

    var html = bioHTML(card);
    var bio = $("tmMBio");
    bio.innerHTML = "";
    if (html) {
      bio.innerHTML = html;
    } else {
      var soon = $("tmBioSoon");
      if (soon) {
        var clone = soon.cloneNode(true);
        clone.removeAttribute("id");
        bio.appendChild(clone);
      }
    }
  }

  function openProfile(card) {
    lastFocus = document.activeElement;
    openCard = card;
    fillModal(card);
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    $("tmMBox").scrollTop = 0;
    $("tmMBody").scrollTop = 0;
    $("tmMClose").focus();
  }

  function closeProfile() {
    openCard = null;
    modal.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  var tm = $("tm");
  if (tm) tm.addEventListener("click", function (e) {
    var c = e.target.closest(".tm-card");
    if (c) openProfile(c);
  });
  modal.addEventListener("click", function (e) {
    if (e.target === modal || e.target.closest("#tmMClose")) closeProfile();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) closeProfile();
  });

  /* ================= 3. اللغة ================= */
  /* i18n.js يترجم عناصر data-i18n بنفسه؛ هنا نحدّث ما يعتمد على اللغة فقط */
  document.addEventListener("gdf:languagechange", function () {
    centerTab(true);
    if (openCard) fillModal(openCard);
  });

  /* ================= 4. البداية ================= */
  [].forEach.call(document.querySelectorAll(".tm-photo"), removeBrokenImg);

  var h = location.hash.slice(1);
  var start = tabs.some(function (t) { return t.dataset.tab === h; }) ? h : tabs[0].dataset.tab;
  show(start, true);

  /* رابط الصفحة النشط في القائمة (احتياطي؛ script.js يفعله أيضاً) */
  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll('a[data-page="team"]').forEach(function (a) {
      a.classList.add("active");
      a.setAttribute("aria-current", "page");
    });
  });
})();
