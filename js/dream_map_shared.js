/**
 * Shared Dream Map logic (Leaflet + Supabase).
 * Used by dream_map.html (full UI) and dream_map_embed.html (view-only + pin list).
 *
 * "Cheers" = +1 on someone else's dream (table map_pin_shares). See web/supabase/map_pin_shares.sql
 */
(function (global) {
  "use strict";

  const SUPABASE_URL = "https://dxwyqrmorjlmnuuychfn.supabase.co";
  const SUPABASE_KEY = "sb_publishable_8MS3E7SW33zJwTmhXO5YBQ_CTwdxeGC";
  const SHARES_TABLE = "map_pin_shares";

  let _supabaseClient = null;
  /** @type {Object<number, L.Marker>} */
  const _markersByPinId = {};
  /** Dedupe Realtime echo right after a local cheer (insert has no returning row). */
  const _shareEchoDedupKeys = new Set();

  function markShareEchoDedup(pinId, sharedBy) {
    const k = String(pinId) + "\0" + String(sharedBy).trim();
    _shareEchoDedupKeys.add(k);
    global.setTimeout(function () {
      _shareEchoDedupKeys.delete(k);
    }, 15000);
  }

  function consumeShareEchoDedup(pinId, sharedBy) {
    const k = String(pinId) + "\0" + String(sharedBy).trim();
    if (_shareEchoDedupKeys.has(k)) {
      _shareEchoDedupKeys.delete(k);
      return true;
    }
    return false;
  }

  function getSupabase() {
    if (_supabaseClient) return _supabaseClient;
    if (!global.supabase || typeof global.supabase.createClient !== "function") {
      throw new Error("Supabase JS SDK must be loaded before dream_map_shared.js");
    }
    _supabaseClient = global.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return _supabaseClient;
  }

  function escapeHtmlMap(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function refreshEmbedMarkers(map) {
    map.eachLayer(function (layer) {
      if (layer instanceof global.L.Marker) {
        const ll = layer.getLatLng();
        layer.setLatLng(ll);
      }
    });
  }

  /**
   * Slow eastward drift for the thermometer embed only (pixel pan — reads clearly on TV).
   * Waits until the map has a real size (iframe layout).
   */
  function startThermometerEmbedEastwardPan(map) {
    if (global.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const pxPerSecond = 25;
    let last = performance.now();
    let running = false;
    let tick = 0;

    function step(now) {
      const dt = Math.min(0.22, (now - last) / 1000);
      last = now;
      try {
        const el = map.getContainer();
        if (!el || !el.isConnected) return;
        const dx = pxPerSecond * dt;
        if (dx > 0) {
          map.panBy([dx, 0], { animate: false });
        }
        tick += 1;
        if (tick % 8 === 0) {
          refreshEmbedMarkers(map);
        }
      } catch (e) {
        return;
      }
      global.requestAnimationFrame(step);
    }

    function tryStart() {
      if (running) return;
      try {
        map.invalidateSize();
      } catch (e) {}
      const el = map.getContainer();
      if (!el || !el.isConnected || el.clientWidth < 20) return;
      running = true;
      last = performance.now();
      global.requestAnimationFrame(function (t) {
        last = t;
        global.requestAnimationFrame(step);
      });
    }

    global.setTimeout(tryStart, 120);
    global.setTimeout(tryStart, 500);
    global.setTimeout(tryStart, 1400);
  }

  function createMap(mapElementId, mapOptions) {
    const opts = mapOptions || {};
    const embed = !!opts.embed;

    const el = document.getElementById(mapElementId);
    if (!el) throw new Error("Dream Map: missing container #" + mapElementId);

    const map = global.L.map(mapElementId, {
      zoomControl: false,
      minZoom: embed ? 2 : 3,
      maxZoom: 12,
      worldCopyJump: embed ? false : true,
      fadeAnimation: embed ? false : true,
      zoomAnimation: embed ? false : true,
    }).setView(embed ? [12, 18] : [15, 10], embed ? 2 : 3);

    global.L.control.zoom({ position: "bottomleft" }).addTo(map);

    global.L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
    ).addTo(map);
    global.L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png",
      { pane: "markerPane" }
    ).addTo(map);

    if (embed) {
      startThermometerEmbedEastwardPan(map);
    }

    return map;
  }

  async function loadSharesAgg() {
    const out = { byPinId: {}, total: 0 };
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from(SHARES_TABLE).select("pin_id, shared_by");
      if (error) {
        console.warn("Dream cheers (" + SHARES_TABLE + "):", error.message);
        return out;
      }
      (data || []).forEach(function (row) {
        const id = Number(row.pin_id);
        if (!out.byPinId[id]) out.byPinId[id] = { count: 0, names: [] };
        const nm = String(row.shared_by || "").trim() || "—";
        out.byPinId[id].count += 1;
        out.byPinId[id].names.push(nm);
        out.total += 1;
      });
    } catch (e) {
      console.warn("loadSharesAgg:", e);
    }
    return out;
  }

  function attachSharesToPins(list, byPinId) {
    list.forEach(function (p) {
      const sid = Number(p.id);
      const agg = byPinId[sid];
      p.share_count = agg ? agg.count : 0;
      p.share_names = agg ? agg.names.slice() : [];
    });
  }

  function divIconForPin(pin) {
    const cheers = (pin.share_count || 0) > 0;
    return global.L.divIcon({
      className: "custom",
      html:
        "<div class='pin-pulse" +
        (cheers ? " pin-pulse--cheers" : "") +
        "' data-has-cheers='" +
        (cheers ? "1" : "0") +
        "'></div>",
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
  }

  function refreshMarkerIcon(marker) {
    const pin = marker._dreamPin;
    if (!pin) return;
    marker.setIcon(divIconForPin(pin));
  }

  function pulseMarkerBounce(marker) {
    try {
      const el = marker.getElement();
      if (!el) return;
      el.classList.remove("dream-marker-pop");
      void el.offsetWidth;
      el.classList.add("dream-marker-pop");
      global.setTimeout(function () {
        el.classList.remove("dream-marker-pop");
      }, 600);
    } catch (e) {}
  }

  function buildCheerListHtml(names) {
    const max = 24;
    const slice = names.slice(0, max);
    let html = slice
      .map(function (n) {
        return "<li>" + escapeHtmlMap(n) + "</li>";
      })
      .join("");
    if (names.length > max) {
      html +=
        '<li class="dream-cheer-more">+' +
        (names.length - max) +
        " more</li>";
    }
    return html;
  }

  function buildPinPopupHtml(pin) {
    const names = pin.share_names || [];
    const count = pin.share_count || 0;
    const listBlock =
      count > 0
        ? "<ul class=\"dream-cheer-list\">" + buildCheerListHtml(names) + "</ul>"
        : "<p class=\"dream-cheer-empty\">Be the first to cheer this dream on.</p>";

    return (
      '<div class="dream-pin-popup">' +
      '<div class="dream-pin-popup-main">' +
      "<strong>" +
      escapeHtmlMap(String(pin.name || "")) +
      "</strong>" +
      '<p class="dream-pin-popup-loc">Dreams of: <span>' +
      escapeHtmlMap(String(pin.location_name || "")) +
      "</span></p>" +
      "</div>" +
      '<div class="dream-cheer-block">' +
      '<div class="dream-cheer-heading">Same dream squad</div>' +
      '<p class="dream-cheer-sub">' +
      (count === 1
        ? "1 person feels the same way."
        : count + " people feel the same way.") +
      "</p>" +
      listBlock +
      '<div class="dream-share-box">' +
      '<label class="dream-share-label" for="dream-share-in-' +
      pin.id +
      '">Your name <span class="dream-share-hint">(shows here)</span></label>' +
      '<div class="dream-share-row">' +
      '<input id="dream-share-in-' +
      pin.id +
      '" class="dream-share-input" type="text" maxlength="80" placeholder="e.g. Jamie" autocomplete="name" />' +
      '<button type="button" class="dream-share-btn" data-pin-id="' +
      pin.id +
      '">Same dream ✨</button>' +
      "</div>" +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }

  function submitDreamShare(pinId, sharedBy) {
    const sb = getSupabase();
    return sb
      .from(SHARES_TABLE)
      .insert([{ pin_id: pinId, shared_by: sharedBy }])
      .then(function (res) {
        if (res.error) throw res.error;
        return res;
      });
  }

  function wireMapShareClicks(map, embedPinList) {
    if (map.__dreamShareClicksWired) return;
    map.__dreamShareClicksWired = true;
    map.getContainer().addEventListener("click", function (ev) {
      const btn = ev.target.closest(".dream-share-btn");
      if (!btn) return;
      ev.preventDefault();
      const pinId = Number(btn.getAttribute("data-pin-id"));
      const box = btn.closest(".dream-share-box");
      const input = box ? box.querySelector("input.dream-share-input") : null;
      const name = input ? input.value.trim() : "";
      if (!name) {
        if (input) input.focus();
        return;
      }
      btn.disabled = true;
      const prev = btn.textContent;
      btn.textContent = "…";
      submitDreamShare(pinId, name)
        .then(function () {
          markShareEchoDedup(pinId, name);
          const marker = _markersByPinId[pinId];
          if (marker && marker._dreamPin) {
            marker._dreamPin.share_count = (marker._dreamPin.share_count || 0) + 1;
            (marker._dreamPin.share_names = marker._dreamPin.share_names || []).push(name);
            refreshMarkerIcon(marker);
            marker.setPopupContent(buildPinPopupHtml(marker._dreamPin));
            marker.openPopup();
            pulseMarkerBounce(marker);
          }
          const sc = document.getElementById("share-count");
          if (sc) sc.textContent = String(Number(sc.textContent || 0) + 1);
          if (embedPinList && typeof embedPinList.incrementCheers === "function") {
            embedPinList.incrementCheers(pinId);
          }
        })
        .catch(function (err) {
          console.error(err);
          const detail =
            err && (err.message || err.error_description || (err.error && err.error.message));
          const hint = detail ? "\n\n(" + detail + ")" : "";
          alert("Could not save your cheer — try again in a moment." + hint);
        })
        .then(function () {
          btn.disabled = false;
          btn.textContent = prev;
        });
    });
  }

  function renderPin(pin, map) {
    const jitterLat = (Math.random() - 0.5) * 0.8;
    const jitterLng = (Math.random() - 0.5) * 0.8;

    pin.share_count = pin.share_count || 0;
    pin.share_names = pin.share_names || [];

    const marker = global.L.marker(
      [pin.latitude + jitterLat, pin.longitude + jitterLng],
      { icon: divIconForPin(pin) }
    ).addTo(map);

    marker._dreamPin = pin;
    _markersByPinId[Number(pin.id)] = marker;

    marker.bindTooltip(String(pin.name), {
      permanent: true,
      className: "name-label",
      direction: "top",
      offset: [0, -10],
    });

    marker.bindPopup(
      function () {
        return buildPinPopupHtml(marker._dreamPin);
      },
      { maxWidth: 300, minWidth: 260, className: "dream-popup-wrap" }
    );
  }

  /**
   * @returns {Promise<Array>} rows from map_pins (each with share_count, share_names)
   */
  async function loadAllPins(map, onCount) {
    const sb = getSupabase();
    const { data } = await sb.from("map_pins").select("*");
    const list = data || [];
    const agg = await loadSharesAgg();
    attachSharesToPins(list, agg.byPinId);
    list.forEach(function (p) {
      renderPin(p, map);
    });
    if (typeof onCount === "function") {
      onCount(list.length, agg.total);
    }
    return list;
  }

  function subscribeRealtime(map, onInsert) {
    const sb = getSupabase();
    sb.channel("map_pins_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", table: "map_pins" },
        function (payload) {
          const row = payload.new;
          row.share_count = 0;
          row.share_names = [];
          renderPin(row, map);
          if (typeof onInsert === "function") onInsert(row);
        }
      )
      .subscribe();
  }

  function subscribeSharesRealtime(map, embedPinList) {
    const sb = getSupabase();
    sb.channel("map_pin_shares_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: SHARES_TABLE },
        function (payload) {
          const row = payload.new;
          const pid = Number(row.pin_id);
          const nm = String(row.shared_by || "").trim() || "—";
          if (consumeShareEchoDedup(pid, nm)) {
            return;
          }
          const marker = _markersByPinId[pid];
          if (marker && marker._dreamPin) {
            marker._dreamPin.share_count = (marker._dreamPin.share_count || 0) + 1;
            (marker._dreamPin.share_names = marker._dreamPin.share_names || []).push(nm);
            refreshMarkerIcon(marker);
            if (typeof marker.isPopupOpen === "function" && marker.isPopupOpen()) {
              marker.setPopupContent(buildPinPopupHtml(marker._dreamPin));
            }
          }
          if (embedPinList && typeof embedPinList.incrementCheers === "function") {
            embedPinList.incrementCheers(pid);
          }
          const cheerEl = document.getElementById("share-count");
          if (cheerEl) {
            cheerEl.textContent = String(Number(cheerEl.textContent || 0) + 1);
          }
        }
      )
      .subscribe();
  }

  async function submitPinFromForm() {
    const nameEl = document.getElementById("userName");
    const locEl = document.getElementById("userLocation");
    const btn = document.getElementById("submitBtn");
    if (!nameEl || !locEl || !btn) return;

    const name = nameEl.value.trim();
    const loc = locEl.value.trim();
    if (!name || !loc) return;

    try {
      const res = await fetch(
        "https://nominatim.openstreetmap.org/search?format=json&q=" +
          encodeURIComponent(loc)
      );
      const geo = await res.json();
      if (!geo.length) return;

      const { lat, lon } = geo[0];
      const sb = getSupabase();
      const { error } = await sb.from("map_pins").insert([
        {
          name: name,
          location_name: loc,
          latitude: parseFloat(lat),
          longitude: parseFloat(lon),
        },
      ]);

      if (error) throw error;

      nameEl.value = "";
      locEl.value = "";

      btn.innerText = "PINNED!";
      btn.classList.add("success");
      global.setTimeout(function () {
        btn.innerText = "Submit";
        btn.classList.remove("success");
      }, 2000);
    } catch (err) {
      console.error(err);
    }
  }

  function scheduleMapResize(map, resizeRootEl) {
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
  }

  function createEmbedPinListMarquee(viewportId, tapeId, segAId, segBId, onLayout) {
    let pins = [];
    let raf = null;

    function renderRows(segEl, pinArr) {
      segEl.innerHTML = "";
      pinArr.forEach(function (p) {
        const row = document.createElement("div");
        row.className = "embed-pin-row";
        const name = ((p.name || "") + "").trim() || "—";
        const place = ((p.location_name || "") + "").trim() || "—";
        const nCheer = Number(p.share_count) || 0;
        const cheerLabel =
          nCheer === 0 ? "—" : String(nCheer);
        row.innerHTML =
          '<span class="embed-pin-name" title="' +
          escapeHtmlMap(name) +
          '">' +
          escapeHtmlMap(name) +
          "</span>" +
          '<span class="embed-pin-place" title="' +
          escapeHtmlMap(place) +
          '">' +
          escapeHtmlMap(place) +
          "</span>" +
          '<span class="embed-pin-cheers" title="Cheers — people who said they share this dream">' +
          cheerLabel +
          "</span>";
        segEl.appendChild(row);
      });
    }

    function refresh() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        raf = requestAnimationFrame(function () {
          raf = null;
          const viewport = document.getElementById(viewportId);
          const tape = document.getElementById(tapeId);
          const segA = document.getElementById(segAId);
          const segB = document.getElementById(segBId);
          if (!viewport || !tape || !segA || !segB) return;

          segB.innerHTML = "";
          tape.classList.remove("embed-pin-tape-autoscroll");
          tape.style.animationDuration = "";
          void tape.offsetWidth;

          if (!pins.length) {
            segA.innerHTML =
              '<div class="embed-pin-row embed-pin-row-empty"><span class="embed-pin-name" style="opacity:0.65">No dreams yet</span></div>';
            if (typeof onLayout === "function") onLayout();
            return;
          }

          renderRows(segA, pins);

          if (global.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            viewport.classList.add("embed-pin-list-static");
            if (typeof onLayout === "function") onLayout();
            return;
          }
          viewport.classList.remove("embed-pin-list-static");

          const vh = viewport.clientHeight;
          const sh = segA.offsetHeight;
          if (sh < 8) {
            if (typeof onLayout === "function") onLayout();
            return;
          }
          if (sh <= vh + 2) {
            if (typeof onLayout === "function") onLayout();
            return;
          }

          segB.innerHTML = segA.innerHTML;
          void tape.offsetWidth;
          const duration = Math.max(18, sh / 38);
          tape.style.animationDuration = duration + "s";
          tape.classList.add("embed-pin-tape-autoscroll");
          if (typeof onLayout === "function") onLayout();
        });
      });
    }

    return {
      setPins: function (newPins) {
        pins = newPins.slice();
        refresh();
      },
      addPin: function (p) {
        p.share_count = p.share_count || 0;
        p.share_names = p.share_names || [];
        pins.push(p);
        refresh();
      },
      incrementCheers: function (pinId) {
        const pid = Number(pinId);
        for (let i = 0; i < pins.length; i++) {
          if (Number(pins[i].id) === pid) {
            pins[i].share_count = (pins[i].share_count || 0) + 1;
            break;
          }
        }
        refresh();
      },
      refresh: refresh,
    };
  }

  async function initEmbedded(mapElementId) {
    const id = mapElementId || "map";
    const embedRoot = document.getElementById("embed-root");
    const map = createMap(id, { embed: true });
    const pinList = createEmbedPinListMarquee(
      "embed-pin-viewport",
      "embed-pin-tape",
      "embed-pin-seg-a",
      "embed-pin-seg-b",
      function () {
        try {
          map.invalidateSize();
        } catch (e) {}
      }
    );

    const pins = await loadAllPins(map, null);
    pinList.setPins(pins);

    subscribeRealtime(map, function (newPin) {
      pinList.addPin(newPin);
    });
    subscribeSharesRealtime(map, pinList);

    scheduleMapResize(map, embedRoot || map.getContainer().parentElement);
  }

  /**
   * Leaflet popups live in .leaflet-popup-pane (z-index 700). The branding box was a
   * body sibling with z-index 1000, so popups hid underneath. Mount branding in a
   * custom pane at 640 so it stays above tiles/markers but below popups/tooltips.
   */
  function mountBrandingBelowMapPopups(map) {
    const branding = document.querySelector(".branding-overlay");
    if (!branding || !map || typeof map.createPane !== "function") return;
    const pane = map.createPane("dreamBrandUnderPopup");
    pane.style.pointerEvents = "none";
    pane.style.zIndex = "640";
    branding.style.pointerEvents = "auto";
    pane.appendChild(branding);
  }

  async function initFullPage() {
    const map = createMap("map");
    mountBrandingBelowMapPopups(map);
    let pinCount = 0;

    await loadAllPins(map, function (n, cheerTotal) {
      pinCount = n;
      const el = document.getElementById("pin-count");
      if (el) el.textContent = String(pinCount);
      const elCh = document.getElementById("share-count");
      if (elCh) elCh.textContent = String(cheerTotal);
    });

    subscribeRealtime(map, function (newPin) {
      pinCount += 1;
      const el = document.getElementById("pin-count");
      if (el) el.textContent = String(pinCount);
    });
    subscribeSharesRealtime(map, null);

    wireMapShareClicks(map, null);

    const btn = document.getElementById("submitBtn");
    if (btn) {
      btn.addEventListener("click", function () {
        submitPinFromForm();
      });
    }

    scheduleMapResize(map, null);
  }

  global.DreamMap = {
    initEmbedded: initEmbedded,
    initFullPage: initFullPage,
    renderPin: renderPin,
    createMap: createMap,
    loadAllPins: loadAllPins,
    subscribeRealtime: subscribeRealtime,
  };
})(typeof window !== "undefined" ? window : this);
