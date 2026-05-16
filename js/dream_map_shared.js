/**
 * Trek Relief Dream Map — public entry (loads after dream_map/* modules).
 */
(function (global) {
  "use strict";

  if (!global.TDM) {
    throw new Error("Dream map modules must load before dream_map_shared.js");
  }

  global.DreamMap = {
    initEmbedded: global.TDM.initEmbedded,
    initFullPage: global.TDM.initFullPage,
    renderPin: global.TDM.renderPin,
    createMap: global.TDM.createMap,
    loadAllPins: global.TDM.loadAllPins,
    subscribeRealtime: global.TDM.subscribeRealtime,
  };
})(typeof window !== "undefined" ? window : this);
