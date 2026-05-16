(function (global) {
  "use strict";

  const TDM = global.TDM;
  TDM.markersByPinId = TDM.markersByPinId || {};

  TDM.divIconForPin = function (pin) {
    const cheers = TDM.cheerCount(pin) > 0;
    const tag = "div";
    return global.L.divIcon({
      className: "custom",
      html:
        "<" +
        tag +
        " class='pin-pulse" +
        (cheers ? " pin-pulse--cheers" : "") +
        "'></" +
        tag +
        ">",
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
  };

  TDM.refreshMarkerIcon = function (marker) {
    const pin = marker._dreamPin;
    if (!pin) return;
    marker.setIcon(TDM.divIconForPin(pin));
  };

  TDM.wireMarkerTooltipClick = function (marker) {
    function attach() {
      const tooltip = marker.getTooltip && marker.getTooltip();
      if (!tooltip) return;
      const el = tooltip.getElement && tooltip.getElement();
      if (!el || el._dreamTooltipClick) return;
      el._dreamTooltipClick = true;
      el.classList.add("name-label--clickable");
      el.addEventListener("click", function (ev) {
        if (global.L && global.L.DomEvent) {
          global.L.DomEvent.stop(ev);
        }
        marker.openPopup();
      });
    }
    marker.on("add", attach);
    if (marker._map) attach();
  };

  TDM.pulseMarkerBounce = function (marker) {
    try {
      const el = marker.getElement();
      if (!el) return;
      el.classList.remove("dream-marker-pop");
      void el.offsetWidth;
      el.classList.add("dream-marker-pop");
      global.setTimeout(function () {
        el.classList.remove("dream-marker-pop");
      }, 600);
    } catch (e) {}
  };

  TDM.renderPin = function (pin, map) {
    const jitterLat = (Math.random() - 0.5) * 0.8;
    const jitterLng = (Math.random() - 0.5) * 0.8;

    pin.share_count = TDM.cheerCount(pin);
    pin.share_names = pin.share_names || [];

    const marker = global.L.marker(
      [pin.latitude + jitterLat, pin.longitude + jitterLng],
      { icon: TDM.divIconForPin(pin) }
    ).addTo(map);

    marker._dreamPin = pin;
    TDM.markersByPinId[Number(pin.id)] = marker;

    const labelClass = map._tdmDark ? "name-label name-label--dark" : "name-label";
    const isInteractiveMap = !map._tdmEmbed;
    marker.bindTooltip(String(pin.name), {
      permanent: true,
      interactive: isInteractiveMap,
      className: labelClass,
      direction: "top",
      offset: [0, -10],
    });
    if (isInteractiveMap) {
      TDM.wireMarkerTooltipClick(marker);
    }

    marker.bindPopup(
      function () {
        return TDM.buildPinPopupHtml(marker._dreamPin);
      },
      { maxWidth: 280, minWidth: 232, className: "dream-popup-wrap" }
    );

    return marker;
  };

  TDM.loadAllPins = async function (map, onCount) {
    const sb = TDM.getSupabase();
    const { data } = await sb.from("map_pins").select("*");
    const list = data || [];
    const agg = await TDM.loadSharesAgg();
    TDM.attachSharesToPins(list, agg.byPinId);
    list.forEach(function (p) {
      TDM.renderPin(p, map);
    });
    if (typeof onCount === "function") onCount(list.length, agg.total);
    return list;
  };

  let _spotlightRing = null;
  let _spotlightZoomOutTimer = null;

  function clearSpotlightZoomOutTimer() {
    if (_spotlightZoomOutTimer) {
      global.clearTimeout(_spotlightZoomOutTimer);
      _spotlightZoomOutTimer = null;
    }
  }

  function scheduleSpotlightZoomOut(map) {
    clearSpotlightZoomOutTimer();
    const ms = TDM.config.SPOTLIGHT_ZOOM_OUT_MS || 15000;
    _spotlightZoomOutTimer = global.setTimeout(function () {
      _spotlightZoomOutTimer = null;
      try {
        if (map._tdmEmbed) {
          map.flyTo([12, 18], 2, { duration: 1.4 });
        }
      } catch (e) {}
    }, ms);
  }

  TDM.highlightPinSpotlight = function (map, pin, options) {
    const opts = options || {};
    const reduceMotion = global.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const marker = TDM.markersByPinId[Number(pin.id)];

    if (_spotlightRing) {
      try {
        map.removeLayer(_spotlightRing);
      } catch (e) {}
      _spotlightRing = null;
    }

    if (!reduceMotion && !opts.skipFly) {
      const lat = pin.latitude;
      const lng = pin.longitude;
      const z = Math.min((map.getZoom() || 2) + 1, 8);
      map.flyTo([lat, lng], z, { duration: 1.1 });
      scheduleSpotlightZoomOut(map);
    }

    if (marker) TDM.pulseMarkerBounce(marker);

    if (!reduceMotion) {
      _spotlightRing = global.L.circleMarker([pin.latitude, pin.longitude], {
        radius: 22,
        color: "#f0a825",
        fillColor: "#f0a825",
        fillOpacity: 0.15,
        weight: 3,
        className: "dream-spotlight-ring",
      }).addTo(map);
      global.setTimeout(function () {
        if (_spotlightRing) {
          try {
            map.removeLayer(_spotlightRing);
          } catch (e) {}
          _spotlightRing = null;
        }
      }, opts.ringMs || 4500);
    }
  };
})(typeof window !== "undefined" ? window : this);
