(function (global) {
  "use strict";

  const TDM = global.TDM;

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

    const pxPerSecond = 25;
    let last = performance.now();
    let running = false;
    let tick = 0;

    function step(now) {
      const dt = Math.min(0.22, (now - last) / 1000);
      last = now;
      try {
        const el = map.getContainer();
        if (!el || !el.isConnected) return;
        const dx = pxPerSecond * dt;
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
