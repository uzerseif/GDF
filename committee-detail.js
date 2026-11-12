/* Show the committee selected in the URL (?id=...). All content lives in committee-detail.html. */
(function () {
  var cards = document.querySelectorAll(".committee-detail[data-committee]");
  if (!cards.length) return;
  var selected = new URLSearchParams(window.location.search).get("id");
  var current = document.querySelector('.committee-detail[data-committee="' + selected + '"]') || cards[0];
  current.hidden = false;

  /* the tab title uses the committee name, in whichever language is active */
  function setTitle() {
    var title = current.querySelector(".page-title");
    if (title) document.title = title.textContent.trim() + " | GDF’27";
  }
  setTitle();
  document.addEventListener("gdf:languagechange", setTitle);
})();