(function (global) {
  "use strict";

  const TDM = global.TDM;
  const cfg = TDM.config;

  function getInvolvedUrl() {
    return (cfg.TREK_GET_INVOLVED_URL || "").trim() || "#";
  }

  TDM.isDemoMode = function () {
    try {
      return global.localStorage.getItem(cfg.DEMO_MODE_STORAGE_KEY) === "1";
    } catch (e) {
      return false;
    }
  };

  TDM.setDemoMode = function (on) {
    try {
      global.localStorage.setItem(cfg.DEMO_MODE_STORAGE_KEY, on ? "1" : "0");
    } catch (e) {}
    global.document.body.classList.toggle("dream-map-demo-mode", !!on);
    const toggle = global.document.getElementById("demo-mode-toggle");
    if (toggle) toggle.checked = !!on;
  };

  TDM.getInvolvedUrl = getInvolvedUrl;

  TDM.renderQrToHost = function (host, url, options) {
    if (!host) return;
    const opts = options || {};
    const targetUrl = url || getInvolvedUrl();
    const size = opts.size || 148;

    host.innerHTML = "";
    const canvas = global.document.createElement("canvas");
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "QR code — scan to get involved");
    host.appendChild(canvas);

    const QR =
      global.QRCode && typeof global.QRCode.toCanvas === "function"
        ? global.QRCode
        : global.QRCode && global.QRCode.default
          ? global.QRCode.default
          : null;

    if (!QR || typeof QR.toCanvas !== "function") {
      host.innerHTML =
        '<p class="dream-get-involved-qr-fallback">' +
        TDM.escapeHtml(targetUrl) +
        "</p>";
      return;
    }

    QR.toCanvas(
      canvas,
      targetUrl,
      {
        width: size,
        margin: 2,
        color: { dark: "#1a2114", light: "#ecf0f1" },
      },
      function (err) {
        if (err) {
          console.warn("Get involved QR:", err);
          host.innerHTML =
            '<p class="dream-get-involved-qr-fallback">' +
            TDM.escapeHtml(targetUrl) +
            "</p>";
        }
      }
    );
  };

  TDM.buildGetInvolvedBlockHtml = function () {
    if (!TDM.isDemoMode()) {
      const fundUrl = TDM.escapeHtml(getInvolvedUrl());
      return (
        '<a class="dream-fund-cta" href="' +
        fundUrl +
        '" target="_blank" rel="noopener noreferrer">Get Involved</a>'
      );
    }
    return (
      '<div class="dream-get-involved-qr-wrap">' +
      '<p class="dream-get-involved-qr-label">Get Involved</p>' +
      '<div class="dream-get-involved-qr-host" data-get-involved-qr></div>' +
      '<p class="dream-get-involved-qr-hint">Scan with your phone</p>' +
      "</div>"
    );
  };

  TDM.hydrateGetInvolvedQrIn = function (root) {
    if (!root || !TDM.isDemoMode()) return;
    const host = root.querySelector("[data-get-involved-qr]");
    if (host) TDM.renderQrToHost(host, getInvolvedUrl(), { size: 140 });
  };

  TDM.initDemoMode = function () {
    TDM.setDemoMode(TDM.isDemoMode());

    const panel = global.document.getElementById("demo-mode-panel");
    const toggle = global.document.getElementById("demo-mode-toggle");
    const dreamsHit = global.document.getElementById("map-stats-dreams-hit");

    if (toggle) {
      toggle.addEventListener("change", function () {
        TDM.setDemoMode(toggle.checked);
      });
    }

    if (dreamsHit && panel) {
      function togglePanel() {
        const open = panel.hidden;
        panel.hidden = !open;
        dreamsHit.setAttribute("aria-expanded", open ? "true" : "false");
      }
      dreamsHit.addEventListener("click", function (e) {
        e.stopPropagation();
        togglePanel();
      });
      dreamsHit.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          togglePanel();
        }
      });
      global.document.addEventListener("click", function (e) {
        if (panel.hidden) return;
        if (panel.contains(e.target) || dreamsHit.contains(e.target)) return;
        panel.hidden = true;
        dreamsHit.setAttribute("aria-expanded", "false");
      });
    }
  };
})(typeof window !== "undefined" ? window : this);
