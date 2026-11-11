/* Active navigation state for the about page. */
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll('[data-page="about"]').forEach(function (link) {
    if (link.tagName.toLowerCase() === "a") {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
  });
});
