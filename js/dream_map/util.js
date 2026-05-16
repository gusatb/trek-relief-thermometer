(function (global) {
  "use strict";

  global.TDM = global.TDM || {};

  let _supabaseClient = null;
  const _shareEchoDedupKeys = new Set();

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

  global.TDM.cheerCount = function (pin) {
    return Number(pin && pin.share_count) || 0;
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
