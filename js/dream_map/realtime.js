(function (global) {
  "use strict";

  const TDM = global.TDM;
  const cfg = TDM.config;

  TDM.subscribeRealtime = function (map, handlers) {
    const h = handlers || {};
    const sb = TDM.getSupabase();
    sb.channel("map_pins_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", table: "map_pins" },
        function (payload) {
          const row = payload.new;
          row.share_count = 0;
          row.share_names = [];
          TDM.renderPin(row, map);
          if (typeof h.onPinInsert === "function") h.onPinInsert(row);
        }
      )
      .subscribe();
  };

  TDM.subscribeSharesRealtime = function (map, handlers) {
    const h = handlers || {};
    const sb = TDM.getSupabase();
    sb.channel("map_pin_shares_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: cfg.SHARES_TABLE },
        function (payload) {
          const row = payload.new;
          const pid = Number(row.pin_id);
          const nm = String(row.shared_by || "").trim() || "Anonymous";
          if (TDM.consumeShareEchoDedup(pid, nm)) return;

          const marker = TDM.markersByPinId[pid];
          if (marker && marker._dreamPin) {
            marker._dreamPin.share_count = TDM.cheerCount(marker._dreamPin) + 1;
            (marker._dreamPin.share_names = marker._dreamPin.share_names || []).push(nm);
            TDM.refreshMarkerIcon(marker);
            if (typeof marker.isPopupOpen === "function" && marker.isPopupOpen()) {
              marker.setPopupContent(TDM.buildPinPopupHtml(marker._dreamPin));
            }
          }

          if (typeof h.onShareInsert === "function") {
            h.onShareInsert({ pinId: pid, sharedBy: nm, pin: marker && marker._dreamPin });
          }

          const cheerEl = document.getElementById("share-count");
          if (cheerEl) {
            cheerEl.textContent = String(Number(cheerEl.textContent || 0) + 1);
          }
        }
      )
      .subscribe();
  };
})(typeof window !== "undefined" ? window : this);
