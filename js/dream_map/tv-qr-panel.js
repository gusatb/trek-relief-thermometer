(function (global) {
  "use strict";

  const TDM = global.TDM;

  TDM.initTvQrPanel = function () {
    const host = document.getElementById("embed-qr-host");
    if (!host) return;

    const mapUrl = TDM.getMapPublicUrl();

    function showFallback(msg) {
      host.innerHTML =
        '<p class="embed-qr-fallback">' +
        (msg || "Scan to open the map") +
        "<br><strong>" +
        TDM.escapeHtml(mapUrl) +
        "</strong></p>";
    }

    function renderQr() {
      host.innerHTML = "";
      const canvas = document.createElement("canvas");
      canvas.id = "embed-qr-canvas";
      canvas.setAttribute("aria-label", "QR code for interactive map");
      host.appendChild(canvas);

      const w = host.clientWidth || 200;
      const h = host.clientHeight || 180;
      const size = Math.min(280, Math.max(120, Math.min(w, h) - 4));

      const QR =
        global.QRCode && typeof global.QRCode.toCanvas === "function"
          ? global.QRCode
          : global.QRCode && global.QRCode.default
            ? global.QRCode.default
            : null;

      if (!QR || typeof QR.toCanvas !== "function") {
        showFallback("QR library unavailable — open:");
        return;
      }

      QR.toCanvas(
        canvas,
        mapUrl,
        {
          width: size,
          margin: 2,
          color: { dark: "#e8f0dc", light: "#0a0c09" },
        },
        function (err) {
          if (err) {
            console.warn("QR render:", err);
            showFallback("Open this link on your phone:");
          }
        }
      );
    }

    renderQr();
    var resizeTimer;
    function scheduleRender() {
      clearTimeout(resizeTimer);
      resizeTimer = global.setTimeout(renderQr, 200);
    }
    global.addEventListener("resize", scheduleRender);
    if (typeof global.ResizeObserver === "function") {
      const ro = new global.ResizeObserver(scheduleRender);
      ro.observe(host);
      const row = document.querySelector(".embed-bottom-row");
      if (row) ro.observe(row);
    }
  };

  TDM.updateQrCheerTotal = function () {};
})(typeof window !== "undefined" ? window : this);
