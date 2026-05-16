(function (global) {
  "use strict";

  const TDM = global.TDM;
  const cfg = TDM.config;

  /** Trek Relief logo (top-left on TV embed) + hidden map pan speed slider. */
  TDM.initEmbedMapControls = function () {
    const pane = document.querySelector(".embed-map-pane");
    if (!pane || pane.querySelector(".embed-map-brand")) return;

    const min = cfg.MAP_PAN_SPEED_MIN || 5;
    const max = cfg.MAP_PAN_SPEED_MAX || 80;
    const logoUrl = cfg.TREK_LOGO_URL || "/trek_relief_logo.svg";

    const wrap = document.createElement("div");
    wrap.className = "embed-map-brand";

    const logoBtn = document.createElement("button");
    logoBtn.type = "button";
    logoBtn.className = "embed-map-brand-btn";
    logoBtn.setAttribute("aria-label", "Trek Relief — adjust map scroll speed");
    logoBtn.setAttribute("aria-expanded", "false");
    logoBtn.setAttribute("aria-controls", "embed-map-speed-panel");

    const logo = document.createElement("img");
    logo.src = logoUrl;
    logo.alt = "Trek Relief";
    logo.className = "embed-map-brand-logo";
    logo.decoding = "async";
    logoBtn.appendChild(logo);

    const panel = document.createElement("div");
    panel.id = "embed-map-speed-panel";
    panel.className = "embed-map-speed-panel";
    panel.hidden = true;

    const label = document.createElement("label");
    label.className = "embed-map-speed-label";
    label.setAttribute("for", "embed-map-speed-range");
    label.textContent = "Map scroll speed";

    const valueEl = document.createElement("span");
    valueEl.className = "embed-map-speed-value";
    valueEl.setAttribute("aria-live", "polite");

    const slider = document.createElement("input");
    slider.type = "range";
    slider.id = "embed-map-speed-range";
    slider.className = "embed-map-speed-range";
    slider.min = String(min);
    slider.max = String(max);
    slider.step = "0.5";
    slider.value = String(TDM.getMapPanSpeed());

    function syncValueLabel() {
      valueEl.textContent = Number(slider.value).toFixed(1) + " px/s";
    }

    syncValueLabel();

    slider.addEventListener("input", function () {
      TDM.setMapPanSpeed(slider.value);
      syncValueLabel();
    });

    label.appendChild(valueEl);
    panel.appendChild(label);
    panel.appendChild(slider);

    function setPanelOpen(open) {
      panel.hidden = !open;
      logoBtn.setAttribute("aria-expanded", open ? "true" : "false");
      wrap.classList.toggle("embed-map-brand--open", open);
    }

    logoBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      setPanelOpen(panel.hidden);
    });

    document.addEventListener("click", function (e) {
      if (!wrap.contains(e.target)) setPanelOpen(false);
    });

    panel.addEventListener("click", function (e) {
      e.stopPropagation();
    });

    wrap.appendChild(logoBtn);
    wrap.appendChild(panel);
    pane.appendChild(wrap);
  };
})(typeof window !== "undefined" ? window : this);
