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
      .select("id, pin_id, shared_by")
      .then(function (res) {
        if (res.error) throw res.error;
        if (!res.data || !res.data.length) {
          throw new Error(
            "Cheer saved but server did not return a row id. Check Supabase INSERT + SELECT policies."
          );
        }
        return res;
      });
  };

  /** Latest Anonymous cheer for this pin (fallback when insert id was not stored). */
  TDM.findLatestAnonymousShareId = async function (pinId) {
    const sb = TDM.getSupabase();
    const { data, error } = await sb
      .from(cfg.SHARES_TABLE)
      .select("id, shared_by, created_at")
      .eq("pin_id", pinId)
      .order("id", { ascending: false })
      .limit(5);
    if (error) {
      console.warn("findLatestAnonymousShareId:", error.message);
      return null;
    }
    const rows = data || [];
    for (let i = 0; i < rows.length; i++) {
      const nm = String(rows[i].shared_by || "").trim();
      if (nm === "Anonymous" || nm === "") return Number(rows[i].id);
    }
    return rows.length ? Number(rows[0].id) : null;
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
      .select("id, pin_id, shared_by")
      .then(function (res) {
        if (res.error) throw res.error;
        if (!res.data || !res.data.length) {
          return Promise.reject(
            new Error(
              "Name not saved — missing UPDATE permission on map_pin_shares in Supabase."
            )
          );
        }
        return res;
      });
  };

  /** Top-right counters on /map from live marker state. */
  TDM.syncMapStatsCounters = function () {
    const pinEl = document.getElementById("pin-count");
    const cheerEl = document.getElementById("share-count");
    if (!pinEl && !cheerEl) return;

    let pins = 0;
    let cheers = 0;
    const byId = TDM.markersByPinId || {};
    Object.keys(byId).forEach(function (key) {
      const m = byId[key];
      if (m && m._dreamPin) {
        pins += 1;
        cheers += TDM.cheerCount(m._dreamPin);
      }
    });
    if (pinEl) pinEl.textContent = String(pins);
    if (cheerEl) cheerEl.textContent = String(cheers);
  };

  /** Reload counters from Supabase (authoritative). */
  TDM.refreshMapStatsFromServer = async function () {
    const sb = TDM.getSupabase();
    const [{ count: pinCount, error: pinErr }, agg] = await Promise.all([
      sb.from("map_pins").select("*", { count: "exact", head: true }),
      TDM.loadSharesAgg(),
    ]);
    const pinEl = document.getElementById("pin-count");
    const cheerEl = document.getElementById("share-count");
    if (!pinErr && pinEl) pinEl.textContent = String(pinCount || 0);
    if (cheerEl) cheerEl.textContent = String(agg.total || 0);
    return { pinCount: pinCount || 0, cheerTotal: agg.total || 0 };
  };
})(typeof window !== "undefined" ? window : this);
