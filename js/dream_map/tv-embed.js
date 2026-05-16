(function (global) {
  "use strict";

  const TDM = global.TDM;

  TDM.initEmbedded = async function (mapElementId) {
    const id = mapElementId || "map";
    const embedRoot = document.getElementById("embed-root");

    TDM.initTvQrPanel();

    const map = TDM.createMap(id, { embed: true });
    TDM.initTvSpotlightBridge(map);

    const pinList = TDM.createEmbedPinListMarquee(
      "embed-pin-viewport",
      "embed-pin-tape",
      "embed-pin-seg-a",
      "embed-pin-seg-b",
      function () {
        try {
          map.invalidateSize();
        } catch (e) {}
      }
    );

    const spotlight = TDM.spotlightHandlersForMap(map);
    let cheerTotal = 0;

    const pins = await TDM.loadAllPins(map, function (_n, total) {
      cheerTotal = total;
      TDM.updateQrCheerTotal(total);
    });
    pinList.setPins(pins);

    function syncCheerTotalFromPins() {
      cheerTotal = pins.reduce(function (sum, p) {
        return sum + TDM.cheerCount(p);
      }, 0);
      TDM.updateQrCheerTotal(cheerTotal);
    }

    function syncPinInList(pin) {
      if (!pin) return;
      const idx = pins.findIndex(function (p) {
        return Number(p.id) === Number(pin.id);
      });
      if (idx >= 0) pins[idx] = pin;
    }

    TDM.subscribeRealtime(map, {
      onPinInsert: function (pin) {
        pins.push(pin);
        pinList.addPin(pin);
        spotlight.onPinInsert(pin);
      },
    });

    TDM.subscribeSharesRealtime(map, {
      onShareInsert: function (info) {
        syncPinInList(info.pin);
        syncCheerTotalFromPins();
        if (info.pin) pinList.updatePin(info.pin);
        spotlight.onShareInsert(info);
      },
      onShareDelete: function (info) {
        syncPinInList(info.pin);
        syncCheerTotalFromPins();
        if (info.pin) pinList.updatePin(info.pin);
      },
    });

    TDM.scheduleMapResize(map, embedRoot || map.getContainer().parentElement);
    global.setTimeout(function () {
      try {
        map.invalidateSize();
      } catch (e) {}
    }, 100);
    global.setTimeout(function () {
      try {
        map.invalidateSize();
      } catch (e) {}
    }, 800);
    if (global.parent !== global) {
      global.addEventListener("load", function () {
        try {
          map.invalidateSize();
        } catch (e) {}
      });
    }
    return { map: map, pins: pins };
  };
})(typeof window !== "undefined" ? window : this);
