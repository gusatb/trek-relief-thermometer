# Trek Relief Live Event UI — Implementation Plan

This document describes the architecture and phased rollout for the TV dashboard (`/thermometer` + `/map/embed`) and the interactive attendee map (`/map`). **Region milestone animations are deferred.**

## Stack

- **Vanilla HTML / JS** (not React)
- **Leaflet 1.9** + **Carto** basemaps (Voyager light on `/map`, Dark Matter on TV embed)
- **Supabase** — `map_pins`, `map_pin_shares`, Realtime
- **Zeffy → WebSocket** — donations on thermometer only; bridged to embed via `postMessage`
- **QRCode.js** (CDN) — TV embed QR to `/map`

## Module layout

```
web/js/dream_map/
  config.js              — URLs, Supabase, tiles, TREK_GET_INVOLVED_URL
  util.js                — Supabase client, HTML escape, resize helper
  map-core.js            — createMap, embed pan, dark/light tiles
  cheers.js              — load/attach shares, submit cheer
  pins.js                — markers, loadAllPins, spotlight ring
  realtime.js            — Supabase INSERT subscriptions
  tv-qr-panel.js         — QR + cheer total on embed
  tv-spotlight.js        — toast queue, donation postMessage
  tv-embed.js            — initEmbedded
  mobile-onboarding.js   — welcome dialog
  mobile-dream-sheet.js  — FAB + pin form
  mobile-cheer-ui.js     — popup + optimistic cheer
  mobile-success.js      — success + Get involved CTA
  interactive.js         — initFullPage
web/js/dream_map_shared.js   — public DreamMap API
web/js/thermometer-bridge.js — WS → iframe donation toasts
```

## Real-time sync

| Event | Source | TV embed | `/map` |
|-------|--------|----------|--------|
| New dream | Supabase `map_pins` INSERT | Toast + flyTo | Realtime pin |
| New cheer | Supabase `map_pin_shares` INSERT | Toast + ring | Optimistic + popup |
| Donation | Zeffy WS → thermometer | `postMessage` toast | — |

**Cheer counts:** always `Number(share_count) || 0`; never show `—` on interactive map.

## Configuration

Edit `web/js/dream_map/config.js`:

- `TREK_GET_INVOLVED_URL` — placeholder until Trek Relief “Getting Involved” link is final
- `PUBLIC_MAP_BASE_URL` — set to production URL for QR on droplet (e.g. `https://your-domain.com`)

## Supabase prerequisite

Run `web/supabase/map_pin_shares.sql` and enable Realtime on `map_pin_shares`.

## Phases (implemented)

1. **Foundation** — modules, `IMPLEMENTATION_PLAN.md`, static `/js` + `/css` serving
2. **TV** — dark map, QR pane (replaces dream/place table), cheer total
3. **Mobile map** — welcome modal, FAB, bottom sheet form
4. **Cheer + CTA** — prominent Cheer button, burst animation, success modal
5. **Spotlight** — TV toasts, pin highlight, donation bridge from thermometer
6. **Polish** — `prefers-reduced-motion`, safe-area FAB, event checklist below

## Event-day checklist

- [ ] `map_pin_shares` table exists; test cheer on `/map`
- [ ] Set `PUBLIC_MAP_BASE_URL` for QR if not using browser host
- [ ] Replace `TREK_GET_INVOLVED_URL` with live “Getting Involved” link
- [ ] Open `/thermometer` on TV; scan QR to `/map` on phone
- [ ] Confirm dream pin → TV toast + flyTo within ~2s
- [ ] Confirm donation → right-column celebration + map donation toast
- [ ] Realtime enabled for `map_pins` and `map_pin_shares`

## Future work

- Region milestone animations (cheer/donation thresholds per country)
- Cheer rate limiting (RLS / edge function)
- PWA for `/map`
