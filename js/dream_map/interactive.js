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
      TDM.syncMapStatsCounters();
    });

    TDM.subscribeRealtime(map, {
      onPinInsert: function () {
        pinCount += 1;
        TDM.syncMapStatsCounters();
      },
    });

    TDM.subscribeSharesRealtime(map, {
      onShareInsert: function () {
        TDM.syncMapStatsCounters();
      },
      onShareDelete: function () {
        TDM.syncMapStatsCounters();
      },
    });

    global.setInterval(function () {
      TDM.refreshMapStatsFromServer().then(function (stats) {
        pinCount = stats.pinCount;
        cheerTotal = stats.cheerTotal;
      });
    }, 30000);

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
