(function (global) {
  "use strict";

  const TDM = global.TDM;

  TDM.initWelcomeModal = function () {
    const dialog = document.getElementById("welcome-modal");
    if (!dialog) return;

    const key = TDM.config.WELCOME_STORAGE_KEY;
    if (global.localStorage.getItem(key) === "1") return;

    const closeBtn = dialog.querySelector("[data-welcome-close]");
    function dismiss() {
      global.localStorage.setItem(key, "1");
      dialog.close();
    }

    if (closeBtn) closeBtn.addEventListener("click", dismiss);
    dialog.addEventListener("cancel", function (e) {
      e.preventDefault();
      dismiss();
    });

    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  };
})(typeof window !== "undefined" ? window : this);
