/**
 * Load Leaflet: try CDN first (works without vendor/ on server), then local copy.
 */
(function (global) {
  "use strict";

  var CSS_URLS = [
    "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
    "/vendor/leaflet/1.9.4/leaflet.css",
  ];

  var JS_URLS = [
    "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
    "/vendor/leaflet/1.9.4/leaflet.js",
  ];

  function loadStylesheet(href) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  CSS_URLS.forEach(loadStylesheet);

  function loadScript(urls, index, done) {
    if (global.L) {
      done();
      return;
    }
    if (index >= urls.length) {
      done(new Error("Leaflet failed to load"));
      return;
    }
    var s = document.createElement("script");
    s.src = urls[index];
    s.onload = function () {
      if (global.L) done();
      else loadScript(urls, index + 1, done);
    };
    s.onerror = function () {
      loadScript(urls, index + 1, done);
    };
    document.head.appendChild(s);
  }

  global.loadLeaflet = function (done) {
    if (global.L) {
      done();
      return;
    }
    loadScript(JS_URLS, 0, done);
  };
})(typeof window !== "undefined" ? window : this);
