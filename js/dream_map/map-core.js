(function (global) {
  "use strict";

  const TDM = global.TDM;
  const cfg = TDM.config;

  let _mapPanPxPerSecond = cfg.MAP_PAN_SPEED_DEFAULT || 25;

  try {
    const stored = global.localStorage.getItem(cfg.MAP_PAN_SPEED_STORAGE_KEY);
    if (stored != null && stored !== "") {
      _mapPanPxPerSecond = Number(stored);
    }
  } catch (e) {}

  TDM.getMapPanSpeed = function () {
    return _mapPanPxPerSecond;
  };

  TDM.setMapPanSpeed = function (pxPerSecond) {
    const min = cfg.MAP_PAN_SPEED_MIN || 5;
    const max = cfg.MAP_PAN_SPEED_MAX || 80;
    const n = Number(pxPerSecond);
    _mapPanPxPerSecond = Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
    try {
      global.localStorage.setItem(
        cfg.MAP_PAN_SPEED_STORAGE_KEY,
        String(_mapPanPxPerSecond)
      );
    } catch (e) {}
    return _mapPanPxPerSecond;
  };

  function refreshEmbedMarkers(map) {
    map.eachLayer(function (layer) {
      if (layer instanceof global.L.Marker) {
        const ll = layer.getLatLng();
        layer.setLatLng(ll);
      }
    });
  }

  function startThermometerEmbedEastwardPan(map) {
    if (global.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let last = performance.now();
    let running = false;
    let tick = 0;

    function step(now) {
      const dt = Math.min(0.22, (now - last) / 1000);
      last = now;
      try {
        const el = map.getContainer();
        if (!el || !el.isConnected) return;
        const dx = TDM.getMapPanSpeed() * dt;
        if (dx > 0) map.panBy([dx, 0], { animate: false });
        tick += 1;
        if (tick % 8 === 0) refreshEmbedMarkers(map);
      } catch (e) {
        return;
      }
      global.requestAnimationFrame(step);
    }

    function tryStart() {
      if (running) return;
      try {
        map.invalidateSize();
      } catch (e) {}
      const el = map.getContainer();
      if (!el || !el.isConnected || el.clientWidth < 20) return;
      running = true;
      last = performance.now();
      global.requestAnimationFrame(function (t) {
        last = t;
        global.requestAnimationFrame(step);
      });
    }

    global.setTimeout(tryStart, 120);
    global.setTimeout(tryStart, 500);
    global.setTimeout(tryStart, 1400);
  }

  TDM.createMap = function (mapElementId, mapOptions) {
    const opts = mapOptions || {};
    const embed = !!opts.embed;
    const dark = !!opts.dark && !embed;

    const el = document.getElementById(mapElementId);
    if (!el) throw new Error("Dream Map: missing container #" + mapElementId);

    const map = global.L.map(mapElementId, {
      zoomControl: false,
      minZoom: embed ? 2 : 3,
      maxZoom: 12,
      worldCopyJump: embed ? false : true,
      fadeAnimation: embed ? false : true,
      zoomAnimation: embed ? false : true,
    }).setView(embed ? [12, 18] : [15, 10], embed ? 2 : 3);

    global.L.control.zoom({ position: "bottomleft" }).addTo(map);

    const tiles = embed
      ? TDM.config.TILES.embed
      : dark
        ? TDM.config.TILES.dark
        : TDM.config.TILES.light;
    global.L.tileLayer(tiles.base).addTo(map);
    global.L.tileLayer(tiles.labels, { pane: "markerPane" }).addTo(map);

    if (embed) startThermometerEmbedEastwardPan(map);

    map._tdmEmbed = embed;
    map._tdmDark = dark;
    return map;
  };
})(typeof window !== "undefined" ? window : this);
