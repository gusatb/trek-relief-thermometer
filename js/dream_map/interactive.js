(function (global) {
  "use strict";

  const TDM = global.TDM;

  TDM.initFullPage = async function () {
    const map = TDM.createMap("map", { embed: false, dark: false });
    let pinCount = 0;
    let cheerTotal = 0;

    await TDM.loadAllPins(map, function (n, total) {
      pinCount = n;
      cheerTotal = total;
      const el = document.getElementById("pin-count");
      if (el) el.textContent = String(pinCount);
      const elCh = document.getElementById("share-count");
      if (elCh) el.textContent = String(cheerTotal);
    });

    TDM.subscribeRealtime(map, {
      onPinInsert: function () {
        pinCount += 1;
        const el = document.getElementById("pin-count");
        if (el) el.textContent = String(pinCount);
      },
    });

    TDM.subscribeSharesRealtime(map, {
      onShareInsert: function () {
        /* counter updated in realtime.js */
      },
    });

    TDM.wireMapShareClicks(map);

    TDM.initWelcomeModal();
    TDM.initDreamSheet({
      onDreamSuccess: function (result) {
        TDM.showSuccessModal({
          title: "Dream pinned!",
          body:
            (result.name || "You") +
            ", your dream of " +
            (result.location || "somewhere amazing") +
            " is on the map.",
          ctaLabel: "Get involved",
        });
      },
    });

    TDM.scheduleMapResize(map, null);
    return { map: map };
  };
})(typeof window !== "undefined" ? window : this);
