(function (global) {
  "use strict";

  const TDM = global.TDM;
  const cfg = TDM.config;

  function bumpGlobalCheerCount(delta) {
    const cheerEl = document.getElementById("share-count");
    if (!cheerEl) return;
    cheerEl.textContent = String(Math.max(0, Number(cheerEl.textContent || 0) + delta));
  }

  function applyShareInsert(row) {
    const shareId = Number(row.id);
    const pid = Number(row.pin_id);
    const nm = String(row.shared_by || "").trim() || "Anonymous";

    if (shareId && TDM.consumeShareEchoDedupShareId(shareId)) {
      return null;
    }

    const marker = TDM.markersByPinId[pid];
    if (marker && marker._dreamPin) {
      marker._dreamPin.share_count = TDM.cheerCount(marker._dreamPin) + 1;
      (marker._dreamPin.share_names = marker._dreamPin.share_names || []).push(nm);
      TDM.refreshMarkerIcon(marker);
      TDM.refreshOpenPinPopup(marker);
    }

    bumpGlobalCheerCount(1);
    return { pinId: pid, sharedBy: nm, pin: marker && marker._dreamPin };
  }

  function applyShareUpdate(row, oldRow) {
    const pid = Number(row.pin_id);
    const marker = TDM.markersByPinId[pid];
    if (!marker || !marker._dreamPin) return null;

    const oldName = String((oldRow && oldRow.shared_by) || "").trim() || "Anonymous";
    const newName = String(row.shared_by || "").trim() || "Anonymous";
    const names = marker._dreamPin.share_names || [];
    let replaced = false;

    for (let i = names.length - 1; i >= 0; i--) {
      if (names[i] === oldName) {
        names[i] = newName;
        replaced = true;
        break;
      }
    }
    if (!replaced) names.push(newName);

    TDM.refreshOpenPinPopup(marker);
    return { pinId: pid, sharedBy: newName, pin: marker._dreamPin };
  }

  function applyShareDelete(row) {
    const pid = Number(row.pin_id);
    const nm = String(row.shared_by || "").trim() || "Anonymous";
    const marker = TDM.markersByPinId[pid];
    if (!marker || !marker._dreamPin) return null;

    const names = marker._dreamPin.share_names || [];
    for (let i = names.length - 1; i >= 0; i--) {
      if (names[i] === nm) {
        names.splice(i, 1);
        break;
      }
    }
    marker._dreamPin.share_count = Math.max(0, TDM.cheerCount(marker._dreamPin) - 1);
    TDM.refreshMarkerIcon(marker);
    TDM.refreshOpenPinPopup(marker);
    bumpGlobalCheerCount(-1);
    return { pinId: pid, sharedBy: nm, pin: marker._dreamPin };
  }

  TDM.subscribeRealtime = function (map, handlers) {
    const h = handlers || {};
    const sb = TDM.getSupabase();
    sb.channel("map_pins_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "map_pins" },
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
    const table = cfg.SHARES_TABLE;

    sb.channel("map_pin_shares_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: table },
        function (payload) {
          const info = applyShareInsert(payload.new);
          if (info && typeof h.onShareInsert === "function") {
            h.onShareInsert(info);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: table },
        function (payload) {
          const info = applyShareUpdate(payload.new, payload.old);
          if (info && typeof h.onShareInsert === "function") {
            h.onShareInsert(info);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: table },
        function (payload) {
          const info = applyShareDelete(payload.old);
          if (info && typeof h.onShareDelete === "function") {
            h.onShareDelete(info);
          }
        }
      )
      .subscribe();
  };
})(typeof window !== "undefined" ? window : this);
