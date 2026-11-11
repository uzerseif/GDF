/* Active navigation state for the applications page. */
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll('[data-page="applications"]').forEach(function (link) {
    if (link.tagName.toLowerCase() === "a") {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
  });
});
