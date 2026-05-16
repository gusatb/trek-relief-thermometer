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
