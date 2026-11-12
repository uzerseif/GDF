
/* =========================================
   ACTIVE NAVIGATION STATE - HOME PAGE
========================================= */

document.addEventListener("DOMContentLoaded", function () {

  document.querySelectorAll('[data-page="home"]').forEach(function (link) {

    if (link.tagName.toLowerCase() === "a") {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }

  });

});
