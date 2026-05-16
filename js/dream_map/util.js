(function (global) {
  "use strict";

  global.TDM = global.TDM || {};

  let _supabaseClient = null;
  const _shareEchoDedupKeys = new Set();
  const _ownShareIds = new Set();

  global.TDM.escapeHtml = function (s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  };

  global.TDM.getSupabase = function () {
    if (_supabaseClient) return _supabaseClient;
    const cfg = global.TDM.config;
    if (!global.supabase || typeof global.supabase.createClient !== "function") {
      throw new Error("Supabase JS SDK must be loaded before dream map modules");
    }
    _supabaseClient = global.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY);
    return _supabaseClient;
  };

  global.TDM.markShareEchoDedup = function (pinId, sharedBy) {
    const k = String(pinId) + "\0" + String(sharedBy).trim();
    _shareEchoDedupKeys.add(k);
    global.setTimeout(function () {
      _shareEchoDedupKeys.delete(k);
    }, 15000);
  };

  global.TDM.consumeShareEchoDedup = function (pinId, sharedBy) {
    const k = String(pinId) + "\0" + String(sharedBy).trim();
    if (_shareEchoDedupKeys.has(k)) {
      _shareEchoDedupKeys.delete(k);
      return true;
    }
    return false;
  };

  /** Dedup realtime echo for a cheer row you just inserted (by share id). */
  global.TDM.markShareEchoDedupShareId = function (shareId) {
    const id = Number(shareId);
    if (!id) return;
    _ownShareIds.add(id);
    global.setTimeout(function () {
      _ownShareIds.delete(id);
    }, 15000);
  };

  global.TDM.consumeShareEchoDedupShareId = function (shareId) {
    const id = Number(shareId);
    if (_ownShareIds.has(id)) {
      _ownShareIds.delete(id);
      return true;
    }
    return false;
  };

  global.TDM.cheerCount = function (pin) {
    return Number(pin && pin.share_count) || 0;
  };

  /** Place lng on the world copy nearest map center (repeating tile maps). */
  global.TDM.wrapPinLng = function (lng, centerLng) {
    let l = Number(lng);
    const c = Number(centerLng);
    if (!Number.isFinite(l) || !Number.isFinite(c)) return l;
    while (l - c > 180) l -= 360;
    while (l - c < -180) l += 360;
    return l;
  };

  global.TDM.scheduleMapResize = function (map, resizeRootEl) {
    function tick() {
      try {
        map.invalidateSize();
      } catch (e) {}
    }
    global.addEventListener("load", function () {
      global.setTimeout(tick, 50);
      global.setTimeout(tick, 300);
    });
    const root = resizeRootEl || map.getContainer().parentElement;
    if (root && typeof global.ResizeObserver === "function") {
      const ro = new global.ResizeObserver(tick);
      ro.observe(root);
    }
  };
})(typeof window !== "undefined" ? window : this);
