(function (global) {
  "use strict";

  const TDM = global.TDM;

  TDM.initDreamSheet = function (callbacks) {
    const cb = callbacks || {};
    const fab = document.getElementById("fab-add-dream");
    const dialog = document.getElementById("dream-sheet");
    if (!fab || !dialog) return;

    function openSheet() {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      const nameEl = document.getElementById("userName");
      if (nameEl) global.setTimeout(function () { nameEl.focus(); }, 120);
    }

    function closeSheet() {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }

    fab.addEventListener("click", openSheet);
    dialog.querySelectorAll("[data-sheet-close]").forEach(function (el) {
      el.addEventListener("click", closeSheet);
    });
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) closeSheet();
    });

    const btn = document.getElementById("submitBtn");
    if (btn) {
      btn.addEventListener("click", function () {
        TDM.submitPinFromForm()
          .then(function (result) {
            if (!result || !result.ok) return;
            closeSheet();
            if (typeof cb.onDreamSuccess === "function") cb.onDreamSuccess(result);
          })
          .catch(function (e) {
            console.error(e);
          });
      });
    }

    TDM._closeDreamSheet = closeSheet;
  };

  TDM.submitPinFromForm = async function () {
    const nameEl = document.getElementById("userName");
    const locEl = document.getElementById("userLocation");
    const btn = document.getElementById("submitBtn");
    if (!nameEl || !locEl || !btn) return { ok: false };

    const name = nameEl.value.trim();
    const loc = locEl.value.trim();
    if (!name || !loc) return { ok: false };

    try {
      const res = await fetch(
        "https://nominatim.openstreetmap.org/search?format=json&q=" +
          encodeURIComponent(loc)
      );
      const geo = await res.json();
      if (!geo.length) {
        alert("We could not find that location. Try adding a country name.");
        return { ok: false };
      }

      const { lat, lon } = geo[0];
      const sb = TDM.getSupabase();
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

      return { ok: true, name: name, location: loc };
    } catch (err) {
      console.error(err);
      alert("Could not pin your dream. Please try again.");
      return { ok: false };
    }
  };
})(typeof window !== "undefined" ? window : this);
