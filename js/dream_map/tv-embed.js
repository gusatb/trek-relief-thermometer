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

    TDM.subscribeRealtime(map, {
      onPinInsert: function (pin) {
        pinList.addPin(pin);
        spotlight.onPinInsert(pin);
      },
    });

    TDM.subscribeSharesRealtime(map, {
      onShareInsert: function (info) {
        cheerTotal += 1;
        TDM.updateQrCheerTotal(cheerTotal);
        if (info.pin) pinList.updatePin(info.pin);
        spotlight.onShareInsert(info);
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
