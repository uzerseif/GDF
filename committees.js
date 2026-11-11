/* Active navigation state for the committees page. */
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll('[data-page="committees"]').forEach(function (link) {
    if (link.tagName.toLowerCase() === "a") {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
  });
});
