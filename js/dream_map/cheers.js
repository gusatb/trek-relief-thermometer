(function (global) {
  "use strict";

  const TDM = global.TDM;
  const cfg = TDM.config;

  TDM.loadSharesAgg = async function () {
    const out = { byPinId: {}, total: 0 };
    try {
      const sb = TDM.getSupabase();
      const { data, error } = await sb.from(cfg.SHARES_TABLE).select("pin_id, shared_by");
      if (error) {
        console.warn("Dream cheers (" + cfg.SHARES_TABLE + "):", error.message);
        return out;
      }
      (data || []).forEach(function (row) {
        const id = Number(row.pin_id);
        if (!out.byPinId[id]) out.byPinId[id] = { count: 0, names: [] };
        const nm = String(row.shared_by || "").trim() || "Anonymous";
        out.byPinId[id].count += 1;
        out.byPinId[id].names.push(nm);
        out.total += 1;
      });
    } catch (e) {
      console.warn("loadSharesAgg:", e);
    }
    return out;
  };

  TDM.attachSharesToPins = function (list, byPinId) {
    list.forEach(function (p) {
      const sid = Number(p.id);
      const agg = byPinId[sid];
      p.share_count = agg ? agg.count : 0;
      p.share_names = agg ? agg.names.slice() : [];
    });
  };

  TDM.submitDreamShare = function (pinId, sharedBy) {
    const sb = TDM.getSupabase();
    return sb
      .from(cfg.SHARES_TABLE)
      .insert([{ pin_id: pinId, shared_by: sharedBy }])
      .select("id")
      .then(function (res) {
        if (res.error) throw res.error;
        return res;
      });
  };

  TDM.refreshPinsCheerState = function (pins, map) {
    return TDM.loadSharesAgg().then(function (agg) {
      TDM.attachSharesToPins(pins, agg.byPinId);
      if (map) {
        pins.forEach(function (p) {
          const marker = TDM.markersByPinId[Number(p.id)];
          if (marker && marker._dreamPin) {
            marker._dreamPin.share_count = TDM.cheerCount(p);
            marker._dreamPin.share_names = (p.share_names || []).slice();
            TDM.refreshMarkerIcon(marker);
          }
        });
      }
      return agg;
    });
  };

  /**
   * Poll cheer counts from Supabase (used on TV embed when Realtime is unavailable).
   * Returns a stop function.
   */
  TDM.startCheersPoll = function (options) {
    const opts = options || {};
    const intervalMs = opts.intervalMs || TDM.config.EMBED_CHEER_POLL_MS || 6000;
    let timer = null;
    let lastSig = "";

    function cheerSignature(pinArr) {
      return pinArr
        .map(function (p) {
          return String(p.id) + ":" + TDM.cheerCount(p);
        })
        .join("|");
    }

    function tick() {
      const getPins = opts.getPins;
      if (typeof getPins !== "function") return Promise.resolve();
      const pinArr = getPins();
      return TDM.refreshPinsCheerState(pinArr, opts.map).then(function (agg) {
        const sig = cheerSignature(pinArr);
        const changed = sig !== lastSig;
        lastSig = sig;
        if (typeof opts.onSync === "function") {
          opts.onSync({ pins: pinArr, total: agg.total, changed: changed });
        }
      });
    }

    tick().catch(function (e) {
      console.warn("cheers poll:", e);
    });
    timer = global.setInterval(function () {
      tick().catch(function (e) {
        console.warn("cheers poll:", e);
      });
    }, intervalMs);

    return function stop() {
      if (timer) {
        global.clearInterval(timer);
        timer = null;
      }
    };
  };

  TDM.updateDreamShareName = function (shareId, sharedBy) {
    const name = String(sharedBy || "").trim();
    if (!name) return Promise.reject(new Error("Name is required"));
    const sb = TDM.getSupabase();
    return sb
      .from(cfg.SHARES_TABLE)
      .update({ shared_by: name })
      .eq("id", shareId)
      .then(function (res) {
        if (res.error) throw res.error;
        return res;
      });
  };
})(typeof window !== "undefined" ? window : this);
