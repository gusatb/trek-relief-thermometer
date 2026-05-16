(function (global) {
  "use strict";

  const TDM = global.TDM;

  TDM.showSuccessModal = function (options) {
    const opts = options || {};
    const dialog = document.getElementById("success-modal");
    if (!dialog) return;

    const titleEl = document.getElementById("success-modal-title");
    const bodyEl = document.getElementById("success-modal-body");
    const involvedHost = document.getElementById("success-modal-involved");

    if (titleEl) titleEl.textContent = opts.title || "Thank you!";
    if (bodyEl) {
      bodyEl.textContent =
        opts.body ||
        "Your dream is on the map. Help Trek Relief make these programs real.";
    }

    if (involvedHost) {
      involvedHost.innerHTML = TDM.buildGetInvolvedBlockHtml();
      TDM.hydrateGetInvolvedQrIn(involvedHost);
    }

    function close() {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }

    dialog.querySelectorAll("[data-success-close]").forEach(function (el) {
      el.onclick = close;
    });
    dialog.addEventListener(
      "click",
      function (e) {
        if (e.target === dialog) close();
      },
      { once: true }
    );

    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  };
})(typeof window !== "undefined" ? window : this);
