/**
 * Forwards new-donor events from the thermometer WebSocket to the embedded map iframe.
 */
(function (global) {
  "use strict";

  function getMapIframe() {
    return (
      document.getElementById("dream-map-embed") ||
      document.querySelector(".left-embedded-map iframe")
    );
  }

  global.TrekThermometerBridge = {
    postDonationSpotlight: function (donor) {
      const iframe = getMapIframe();
      if (!iframe || !iframe.contentWindow) return;
      const name = ((donor && donor.name) || "").trim() || "Anonymous";
      const amount = Number(donor && donor.amount) || 0;
      const currency = (donor && donor.currency) || "usd";
      try {
        iframe.contentWindow.postMessage(
          {
            type: "DONATION_SPOTLIGHT",
            name: name,
            amount: amount,
            currency: currency,
          },
          global.location.origin
        );
      } catch (e) {
        console.warn("ThermometerBridge:", e);
      }
    },
  };
})(typeof window !== "undefined" ? window : this);
