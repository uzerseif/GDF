/* Active navigation state for the home page. */
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll('[data-page="home"]').forEach(function (link) {
    if (link.tagName.toLowerCase() === "a") {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
  });
});

/* Sponsors marquee: the HTML lists each sponsor once; this makes a second, hidden copy so the
   loop scrolls with no gap, and swaps any logo that fails to load for the sponsor's name. */
(function () {
  var track = document.getElementById("sponsorsTrack");
  var group = track && track.querySelector(".sponsors-group");
  if (!group) return;

  /* remember each name first, so the copy (whose alt is emptied) can use it too */
  group.querySelectorAll("img").forEach(function (img) { img.setAttribute("data-name", img.alt); });

  var copy = group.cloneNode(true);
  copy.setAttribute("aria-hidden", "true");
  copy.querySelectorAll("img").forEach(function (img) { img.alt = ""; });
  track.appendChild(copy);

  function useName(img) {
    if (!img.parentNode) return;
    var name = document.createElement("span");
    name.className = "sponsor-name";
    name.textContent = img.getAttribute("data-name") || "";
    img.replaceWith(name);
  }

  track.addEventListener("error", function (e) {
    if (e.target && e.target.tagName === "IMG") useName(e.target);
  }, true);
  track.querySelectorAll("img").forEach(function (img) {
    if (img.complete && img.naturalWidth === 0) useName(img);
  });
})();
