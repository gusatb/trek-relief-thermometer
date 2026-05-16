(function (global) {
  "use strict";

  const TDM = global.TDM;

  let _queue = [];
  let _showing = false;
  let _host = null;

  function getHost() {
    if (_host) return _host;
    const pane = document.querySelector(".embed-map-pane");
    if (!pane) return null;
    _host = document.createElement("div");
    _host.className = "tv-spotlight-host";
    _host.setAttribute("aria-live", "polite");
    pane.appendChild(_host);
    return _host;
  }

  function formatDonationAmount(amount, currency) {
    const c = (currency || "usd").toLowerCase();
    if (c === "usd") {
      return Number(amount).toLocaleString("en-US", { style: "currency", currency: "USD" });
    }
    return String(currency || "").toUpperCase() + " " + Number(amount).toLocaleString();
  }

  function buildMessage(item) {
    if (item.kind === "dream") {
      const name = TDM.escapeHtml(((item.pin.name || "") + "").trim() || "Someone");
      const place = TDM.escapeHtml(((item.pin.location_name || "") + "").trim() || "the world");
      return (
        '<span class="tv-spotlight-eyebrow">New dream</span>' +
        "<strong>" +
        name +
        "</strong> just dreamed of a program in <em>" +
        place +
        "</em>!"
      );
    }
    if (item.kind === "cheer") {
      const who = TDM.escapeHtml(item.sharedBy || "Someone");
      return '<span class="tv-spotlight-eyebrow">Cheer</span><strong>' + who + "</strong> shares that dream!";
    }
    if (item.kind === "donation") {
      const name = TDM.escapeHtml(item.name || "Someone");
      const amt = formatDonationAmount(item.amount, item.currency);
      return (
        '<span class="tv-spotlight-eyebrow">Donation</span><strong>' +
        name +
        "</strong> just gave " +
        TDM.escapeHtml(amt) +
        "!"
      );
    }
    return "";
  }

  function pump() {
    if (_showing || !_queue.length) return;
    const host = getHost();
    if (!host) return;

    _showing = true;
    const item = _queue.shift();
    const reduceMotion = global.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const el = document.createElement("div");
    el.className = "tv-spotlight-toast";
    el.innerHTML = buildMessage(item);
    host.appendChild(el);
    void el.offsetWidth;
    el.classList.add("tv-spotlight-toast--show");

    if (item.kind === "dream" && item.pin && item.map && !reduceMotion) {
      TDM.highlightPinSpotlight(item.map, item.pin, { skipFly: false });
    } else if (item.kind === "cheer" && item.pin && item.map && !reduceMotion) {
      TDM.highlightPinSpotlight(item.map, item.pin, { skipFly: true, ringMs: 2800 });
    }

    const duration = reduceMotion ? 4000 : TDM.config.SPOTLIGHT_DURATION_MS;
    global.setTimeout(function () {
      el.classList.remove("tv-spotlight-toast--show");
      global.setTimeout(function () {
        el.remove();
        _showing = false;
        pump();
      }, 380);
    }, duration);
  }

  TDM.enqueueSpotlight = function (item) {
    const key =
      item.kind +
      ":" +
      (item.pin && item.pin.id) +
      ":" +
      (item.sharedBy || item.name || "");
    const now = Date.now();
    const recent = _queue.find(function (q) {
      return q._key === key && now - (q._ts || 0) < 5000;
    });
    if (recent) return;

    item._key = key;
    item._ts = now;
    _queue.push(item);
    if (_queue.length > 6) _queue = _queue.slice(-6);
    pump();
  };

  TDM.initTvSpotlightBridge = function (map) {
    global.addEventListener("message", function (ev) {
      if (ev.origin !== global.location.origin) return;
      const data = ev.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "DONATION_SPOTLIGHT") {
        TDM.enqueueSpotlight({
          kind: "donation",
          name: data.name,
          amount: data.amount,
          currency: data.currency,
          map: map,
        });
      }
    });
  };

  TDM.spotlightHandlersForMap = function (map) {
    return {
      onPinInsert: function (pin) {
        TDM.enqueueSpotlight({ kind: "dream", pin: pin, map: map });
      },
      onShareInsert: function (info) {
        if (!info.pin) return;
        TDM.enqueueSpotlight({
          kind: "cheer",
          pin: info.pin,
          sharedBy: info.sharedBy,
          map: map,
        });
      },
    };
  };
})(typeof window !== "undefined" ? window : this);
