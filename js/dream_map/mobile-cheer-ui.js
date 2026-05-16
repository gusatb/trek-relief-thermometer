(function (global) {
  "use strict";

  const TDM = global.TDM;
  /** DB requires non-empty shared_by; 1-click cheers use this label. */
  const ANON_CHEER_NAME = "Anonymous";

  function displayName(pin) {
    return TDM.escapeHtml(String((pin && pin.name) || "").trim() || "Someone");
  }

  function displayLocation(pin) {
    return TDM.escapeHtml(String((pin && pin.location_name) || "").trim() || "—");
  }

  function isUnnamedCheer(name) {
    const s = String(name || "").trim();
    return !s || s === ANON_CHEER_NAME;
  }

  function buildSocialProofHtml(pin) {
    const count = TDM.cheerCount(pin);
    if (count === 0) {
      return (
        '<p class="dream-popup-social dream-popup-social--empty">' +
        "<em>Be the first to back this dream!</em></p>"
      );
    }

    const raw = pin.share_names || [];
    const named = [];
    const seen = new Set();
    let anonCount = 0;

    raw.forEach(function (n) {
      if (isUnnamedCheer(n)) {
        anonCount += 1;
      } else {
        const label = String(n).trim();
        const key = label.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          named.push(label);
        }
      }
    });

    if (count > raw.length) {
      anonCount += count - raw.length;
    }
    if (count > 0 && named.length === 0 && anonCount === 0) {
      anonCount = count;
    }

    let items = named
      .map(function (n) {
        return "<li>" + TDM.escapeHtml(n) + "</li>";
      })
      .join("");

    if (anonCount > 0) {
      let tail;
      if (named.length === 0) {
        tail = anonCount === 1 ? "1 other" : anonCount + " others";
      } else {
        tail =
          anonCount === 1 ? "And 1 other" : "And " + anonCount + " others";
      }
      items +=
        '<li class="dream-popup-joined-others">' + tail + "</li>";
    }

    return (
      '<div class="dream-popup-social dream-popup-social--joined">' +
      '<p class="dream-popup-joined-label">Joined by:</p>' +
      '<ul class="dream-popup-joined-list">' +
      items +
      "</ul></div>"
    );
  }

  function buildNameOptInHtml(pin, nameSubmitReady) {
    const ready = nameSubmitReady !== false;
    return (
      '<div class="dream-popup-name-opt">' +
      '<input type="text" class="dream-popup-name-input" maxlength="80" placeholder="Your name" autocomplete="name" aria-label="Your name" />' +
      '<button type="button" class="dream-popup-name-submit" data-pin-id="' +
      pin.id +
      '"' +
      (ready ? "" : " disabled") +
      ">Submit</button>" +
      "</div>"
    );
  }

  TDM.buildPinPopupHtml = function (pin) {
    return (
      '<div class="dream-pin-popup">' +
      '<p class="dream-pin-popup-title"><strong>' +
      displayName(pin) +
      "'s</strong> Dream: <strong>" +
      displayLocation(pin) +
      "</strong></p>" +
      buildSocialProofHtml(pin) +
      '<div class="dream-popup-actions">' +
      '<button type="button" class="dream-cheer-btn dream-oneclick-cheer-btn" data-pin-id="' +
      pin.id +
      '"><span class="dream-cheer-btn-label">Cheer!</span><span class="dream-cheer-btn-sparks" aria-hidden="true"></span></button>' +
      "</div>" +
      "</div>"
    );
  };

  TDM.buildPinPopupSuccessHtml = function (pin, options) {
    const opts = options || {};
    const showNameForm = opts.showNameForm !== false;
    const fundUrl = TDM.escapeHtml(TDM.config.TREK_GET_INVOLVED_URL || "#");

    let nameBlock = "";
    if (showNameForm) {
      nameBlock = buildNameOptInHtml(pin, opts.nameSubmitReady);
    }

    return (
      '<div class="dream-pin-popup dream-pin-popup--success">' +
      buildSocialProofHtml(pin) +
      '<p class="dream-popup-success-msg"><em>Awesome! Help us make it happen.</em></p>' +
      nameBlock +
      '<a class="dream-fund-cta" href="' +
      fundUrl +
      '" target="_blank" rel="noopener noreferrer">Get Involved</a>' +
      "</div>"
    );
  };

  function replaceLastAnonymousName(pin, name) {
    const names = pin.share_names || [];
    for (let i = names.length - 1; i >= 0; i--) {
      if (names[i] === ANON_CHEER_NAME) {
        names[i] = name;
        return;
      }
    }
    names.push(name);
  }

  function showSuccessPopup(marker, pin, options) {
    if (!marker) return;
    marker.setPopupContent(TDM.buildPinPopupSuccessHtml(pin, options || {}));
  }

  TDM.refreshOpenPinPopup = function (marker) {
    if (!marker || !marker._dreamPin) return;
    if (typeof marker.isPopupOpen !== "function" || !marker.isPopupOpen()) return;
    const popupEl = marker.getPopup() && marker.getPopup().getElement();
    if (!popupEl) return;
    const pin = marker._dreamPin;
    if (popupEl.querySelector(".dream-pin-popup--success")) {
      const hasNameForm = !!popupEl.querySelector(".dream-popup-name-opt");
      marker.setPopupContent(
        TDM.buildPinPopupSuccessHtml(pin, {
          showNameForm: hasNameForm,
          nameSubmitReady: true,
        })
      );
    } else {
      marker.setPopupContent(TDM.buildPinPopupHtml(pin));
    }
  };

  function enableNameSubmitInPopup(marker) {
    const popupEl = marker.getPopup() && marker.getPopup().getElement();
    if (!popupEl) return;
    const btn = popupEl.querySelector(".dream-popup-name-submit");
    if (btn) btn.disabled = false;
  }

  function applyOptimisticCheer(marker) {
    if (!marker || !marker._dreamPin) return;
    const pin = marker._dreamPin;
    const prev = TDM.cheerCount(pin);
    pin.share_count = prev + 1;
    (pin.share_names = pin.share_names || []).push(ANON_CHEER_NAME);
    marker._lastCheerShareId = null;
    TDM.refreshMarkerIcon(marker);
    TDM.pulseMarkerBounce(marker);
    showSuccessPopup(marker, pin, { showNameForm: true, nameSubmitReady: false });
    const popupEl = marker.getPopup() && marker.getPopup().getElement();
    if (popupEl) {
      const inner = popupEl.querySelector(".dream-pin-popup");
      if (inner) {
        inner.classList.add("dream-pin-popup--celebrate");
        global.setTimeout(function () {
          inner.classList.remove("dream-pin-popup--celebrate");
        }, 520);
      }
    }
  }

  function revertCheer(marker, prevCount) {
    if (!marker || !marker._dreamPin) return;
    const pin = marker._dreamPin;
    pin.share_count = prevCount;
    if (pin.share_names && pin.share_names.length) {
      for (let i = pin.share_names.length - 1; i >= 0; i--) {
        if (pin.share_names[i] === ANON_CHEER_NAME) {
          pin.share_names.splice(i, 1);
          break;
        }
      }
    }
    marker._lastCheerShareId = null;
    TDM.refreshMarkerIcon(marker);
    marker.setPopupContent(TDM.buildPinPopupHtml(pin));
  }

  function triggerCheerBurst(btn) {
    btn.classList.add("dream-cheer-btn--burst");
    global.setTimeout(function () {
      btn.classList.remove("dream-cheer-btn--burst");
    }, 520);
  }

  function handleNameSubmit(marker, pinId, input) {
    if (!marker || !marker._dreamPin) return;
    const name = input ? input.value.trim() : "";
    if (!name) {
      if (input) input.focus();
      return;
    }

    const pin = marker._dreamPin;
    const shareId = marker._lastCheerShareId;
    const submitBtn = input
      ? input.closest(".dream-popup-name-opt") &&
        input.closest(".dream-popup-name-opt").querySelector(".dream-popup-name-submit")
      : null;

    if (submitBtn) submitBtn.disabled = true;

    function finishHideForm() {
      replaceLastAnonymousName(pin, name);
      marker._lastCheerShareId = null;
      showSuccessPopup(marker, pin, { showNameForm: false });
    }

    if (!shareId) {
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    TDM.updateDreamShareName(shareId, name)
      .then(finishHideForm)
      .catch(function (err) {
        console.error(err);
        if (submitBtn) submitBtn.disabled = false;
        alert("Could not save your name — try again.");
      });
  }

  TDM.wireMapShareClicks = function (map, callbacks) {
    const cb = callbacks || {};
    if (map.__dreamShareClicksWired) return;
    map.__dreamShareClicksWired = true;

    map.getContainer().addEventListener("click", function (ev) {
      const nameBtn = ev.target.closest(".dream-popup-name-submit");
      if (nameBtn) {
        ev.preventDefault();
        const pinId = Number(nameBtn.getAttribute("data-pin-id"));
        const marker = TDM.markersByPinId[pinId];
        const opt = nameBtn.closest(".dream-popup-name-opt");
        const input = opt ? opt.querySelector(".dream-popup-name-input") : null;
        handleNameSubmit(marker, pinId, input);
        return;
      }

      const btn = ev.target.closest(".dream-oneclick-cheer-btn");
      if (!btn || btn.disabled) return;
      ev.preventDefault();

      const pinId = Number(btn.getAttribute("data-pin-id"));
      const marker = TDM.markersByPinId[pinId];
      const prevCount = marker && marker._dreamPin ? TDM.cheerCount(marker._dreamPin) : 0;

      btn.disabled = true;
      triggerCheerBurst(btn);
      applyOptimisticCheer(marker);

      const sc = document.getElementById("share-count");
      if (sc) sc.textContent = String(Number(sc.textContent || 0) + 1);

      TDM.submitDreamShare(pinId, ANON_CHEER_NAME)
        .then(function (res) {
          const row = res.data && res.data[0];
          if (row && row.id != null) {
            if (marker) {
              marker._lastCheerShareId = Number(row.id);
              enableNameSubmitInPopup(marker);
            }
            TDM.markShareEchoDedupShareId(row.id);
          }
          if (typeof cb.onCheerSuccess === "function") {
            cb.onCheerSuccess({
              pinId: pinId,
              name: ANON_CHEER_NAME,
              pin: marker && marker._dreamPin,
            });
          }
        })
        .catch(function (err) {
          console.error(err);
          revertCheer(marker, prevCount);
          if (sc) sc.textContent = String(Math.max(0, Number(sc.textContent || 0) - 1));
          const detail =
            err && (err.message || err.error_description || (err.error && err.error.message));
          alert(
            "Could not save your cheer — try again in a moment." +
              (detail ? "\n\n(" + detail + ")" : "")
          );
        });
    });
  };
})(typeof window !== "undefined" ? window : this);
