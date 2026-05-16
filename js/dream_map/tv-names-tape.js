(function (global) {
  "use strict";

  const TDM = global.TDM;

  /**
   * Scrolling dream list for TV embed (name, place, cheer count).
   */
  TDM.createEmbedPinListMarquee = function (viewportId, tapeId, segAId, segBId, onLayout) {
    let pins = [];
    let raf = null;

    function renderRows(segEl, pinArr) {
      segEl.innerHTML = "";
      pinArr.forEach(function (p) {
        const row = document.createElement("div");
        row.className = "embed-pin-row";
        const name = ((p.name || "") + "").trim() || "—";
        const place = ((p.location_name || "") + "").trim() || "—";
        const cheers = TDM.cheerCount(p);
        const cheerClass =
          cheers > 0 ? "embed-pin-cheer embed-pin-cheer--active" : "embed-pin-cheer";
        row.innerHTML =
          '<span class="embed-pin-name" title="' +
          TDM.escapeHtml(name) +
          '">' +
          TDM.escapeHtml(name) +
          "</span>" +
          '<span class="embed-pin-place" title="' +
          TDM.escapeHtml(place) +
          '">' +
          TDM.escapeHtml(place) +
          "</span>" +
          '<span class="' +
          cheerClass +
          '">' +
          cheers +
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
              '<div class="embed-pin-row embed-pin-row-empty"><span class="embed-pin-name" style="opacity:0.65">No dreams yet — scan to add yours</span></div>';
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
          if (sh < 8 || sh <= vh + 2) {
            if (typeof onLayout === "function") onLayout();
            return;
          }

          segB.innerHTML = segA.innerHTML;
          void tape.offsetWidth;
          tape.style.animationDuration = Math.max(18, sh / 38) + "s";
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
        pins.push(p);
        refresh();
      },
      updatePin: function (p) {
        const id = Number(p && p.id);
        if (!id) return;
        for (let i = 0; i < pins.length; i++) {
          if (Number(pins[i].id) === id) {
            pins[i].share_count = TDM.cheerCount(p);
            if (p.share_names) pins[i].share_names = p.share_names;
            refresh();
            return;
          }
        }
      },
      refresh: refresh,
    };
  };
})(typeof window !== "undefined" ? window : this);
