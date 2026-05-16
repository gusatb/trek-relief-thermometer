/**
 * Trek Relief Dream Map — shared configuration.
 * Set PUBLIC_MAP_BASE_URL on the droplet if QR should use your public DNS (not localhost).
 */
(function (global) {
  "use strict";

  global.TDM = global.TDM || {};

  global.TDM.config = {
    SUPABASE_URL: "https://dxwyqrmorjlmnuuychfn.supabase.co",
    SUPABASE_KEY: "sb_publishable_8MS3E7SW33zJwTmhXO5YBQ_CTwdxeGC",
    SHARES_TABLE: "map_pin_shares",
    TREK_GET_INVOLVED_URL: "https://trekrelief.org/create-a-program",
    /** Production host for TV embed QR codes (empty = window.location.origin) */
    PUBLIC_MAP_BASE_URL: "http://161.35.13.143",
    TILES: {
      light: {
        base: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png",
        labels:
          "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png",
      },
      /** TV embed: colorful, readable Carto Voyager (not dark matter). */
      embed: {
        base: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png",
        labels:
          "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png",
      },
      dark: {
        base: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        labels:
          "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",
      },
    },
    WELCOME_STORAGE_KEY: "trek_dream_welcome_dismissed",
    SPOTLIGHT_DURATION_MS: 6200,
    /** After a new-dream zoom-in, return to world view (TV embed). */
    SPOTLIGHT_ZOOM_OUT_MS: 15000,
    /** TV embed: poll Supabase for new cheers (backup if Realtime is off). */
    EMBED_CHEER_POLL_MS: 6000,
    /** TV embed: eastward map auto-pan (pixels per second). */
    MAP_PAN_SPEED_DEFAULT: 25,
    MAP_PAN_SPEED_MIN: 5,
    MAP_PAN_SPEED_MAX: 80,
    MAP_PAN_SPEED_STORAGE_KEY: "trek_embed_map_pan_speed",
    TREK_LOGO_URL: "/trek_relief_logo.svg",
  };

  global.TDM.getMapPublicUrl = function () {
    const base =
      (global.TDM.config.PUBLIC_MAP_BASE_URL || "").trim() ||
      global.location.origin;
    return base.replace(/\/$/, "") + "/map";
  };
})(typeof window !== "undefined" ? window : this);
