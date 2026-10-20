# CLAUDE.md — ultimo-bots-widget

The **embeddable chat widget**, the most production-critical code in the workspace. One `<script>` tag
renders a floating bubble + chat window inside a **Shadow DOM** on one host `<div>`, on any customer site.

> Workspace entry point (read first, not repeated here): [`../CLAUDE.md`](../CLAUDE.md).
> Architecture: [`../ultimo-bots-ai-docs/ultimo-bots-widget/OVERVIEW.md`](../ultimo-bots-ai-docs/ultimo-bots-widget/OVERVIEW.md)
> (§1–7 last reviewed 2026-05-20 and partly stale; where it contradicts this file, this file wins — verified 2026-10-20).
> Product: [`11-channel-website-widget.md`](../ultimo-bots-ai-docs/features/11-channel-website-widget.md).

---

## Two live release lines — check which one you are on

| | **`main`** (this checkout) | **`webflow-1.3.0`** (see section at the end) |
|---|---|---|
| Build | `npm run build` → [`webpack.config.js`](webpack.config.js) | `npm run build:release` → `webpack.release.js` |
| Artifact | committed `dist/bundle.js` (unversioned) | `release/<version>/ultimo-widget.js` (gitignored, immutable per version) |
| Served from | GitHub Pages, branch `main`: `https://robert-kloepsch.github.io/ultimo-bots-widget/dist/bundle.js` | repo `ultimo-bots-cdn` → `https://widget.ultimo-bots.com/<version>/ultimo-widget.js`, now **1.3.1** |
| Loaded by | most customer sites: portal embed snippet (`ChannelGuide.js`, `integrationModal.js`), WordPress plugin, Shopify theme loader (`extensions/ultimo-chat/assets/ultimo-loader.js`), MCP embed code (`management.py`), webpage `_app.js`, docs `app/layout.tsx`; Wix via an embedded-script component (`wix.py`; its script URL is configured in the Wix app, not in code) | Webflow app installs: backend registers it with an SRI hash (`register_and_apply_widget` in `ultimo-bots-backend/src/controller/webflow.py`, `WIDGET_VERSION = "1.3.1"`, `WIDGET_INTEGRITY_HASH`) |
| Deploy | **a push to `main` IS the deploy.** No CI, no tests, no rollback beyond revert + push | new CDN directory + backend constants in lockstep |

- The live bundle equals `origin/main:dist/bundle.js` (verified 2026-10-20).
- The branches **diverged at `7bcac4f`** (2026-08-18). Only on `main`: the pre-chat form in the visitor's
  language (`9fbe658`, built in `2c9da35`). Only on `webflow-1.3.0`: the Webflow-review hardening and
  releases 1.2.0–1.3.1. Merging them is a **separate, owner-approved task** — never merge or cherry-pick
  between them on your own.
- Pushing `main` or `ultimo-bots-cdn` is a **production change**: the owner's explicit approval first.
- **Never run `npm run build:release` on `main`.** Main's `package.json` is still `1.0.0` and its
  `webpack.release.js` lacks the commerce gate; it would overwrite the local `release/1.0.0/` with code
  that was never released. Release builds come only from `webflow-1.3.0`.

---

## Stack (`main`)

- **Vanilla JS**, one file [`src/index.js`](src/index.js) (6,337 lines) plus [`src/games/`](src/games/).
- **webpack 5**, `mode: 'production'` ([`webpack.config.js:19`](webpack.config.js)), `clean: true`. Output
  `dist/bundle.js` is minified, ~208 KB (212,780 bytes), no source map.
- **Bundled deps:** `marked 11.1.1` + `dompurify 3.1.6` (lockfile), statically imported, no runtime CDN
  imports. On `main` they are also written to `globalThis.marked` / `globalThis.DOMPurify` (`src/index.js:9–10`).
- **Shadow DOM** (`attachShadow`, `src/index.js:366`) + `:host { all: initial }`; class prefix **`saicf-*`**
  (legacy, keep it); npm name `swiss_bot_widget` (legacy, ignore).
- **Backend URLs hardcoded** to `https://portal.ultimo-bots.com/api/…` and `wss://portal.ultimo-bots.com/api/ws`.

## Build, test, deploy (`main`)

```bash
npm ci            # node_modules may come from webflow-1.3.0 (DOMPurify 3.4.13); ci restores main's lockfile
npm run build     # = webpack → dist/bundle.js, bundle.js.LICENSE.txt, index.html, cloud.png
```

- **Test on the dev box** (the only test environment): from this repo, `bash ../_deploy/sync-to-dev.sh ultimo-bots-widget`
  copies the working tree to the box, points it at the dev API and rebuilds; the bundle is then served at
  `https://srv1765521.hstgr.cloud/widget/bundle.js` (see [`../DEPLOYMENT-dev.md`](../DEPLOYMENT-dev.md)).
  The widget is not on Mutagen.
- `dist/index.html` and [`test.html`](test.html) call the **production** API (hardcoded URLs, fixed bot ids);
  `test.html` even loads the live bundle. Use them for layout checks only.
- **Deploy** (after approval): commit `dist/bundle.js` built from the committed source, push `main`. GitHub
  Pages needs minutes to propagate; every customer gets it at once.

---

## Where things are in `src/index.js` (`main` @ `2c9da35`)

| Lines | What |
|---|---|
| 1–20 | imports, globals, `OWN_SCRIPT_BOT_ID` (bot id from our own `<script data-bot_id>`) |
| 22 / 134 / 158 | `FONT_SOURCES`; AI disclosure (EU AI Act Art. 50(1)); pre-chat texts in 8 languages |
| 210–267 | bootstrap (below) |
| 269 | `initializeChatWidget` starts (its body runs to the end of the file): 328–348 host container style (`display: 'block'` at 340), 366 shadow root, 369–385 `body.no-scroll` style in `<head>` |
| ~2376–2470 | config load: `widget_configuration`, `warm_lead_function`, live-chat settings + agent availability |
| 3597–~4730 | **live-agent state machine**: `connectLiveWs` 3674, heartbeat 4427, polling 4499, visibility 4619 |
| 4882 | `sendMessage`; AI answer stream = `EventSource` GET `chatbot_response?user_input=…` (5004) |
| 5197–~6000 | product gallery + Shopify add-to-cart (`pc*`); 6009 activity timeline; 6186/6230 chat history |

Backend contract markers in comments: `W1`–`W17`, `join_ack`, `rejoin races`.

## Bootstrap (`src/index.js:210–267`)

1. Look for `<div id="chat-widget-container" data-user-id="…">`.
2. Webflow hosted-script path: no container, but our own `<script>` carries `data-bot_id` → create the container.
3. Otherwise poll every 200 ms **and** watch `document.body` with a `MutationObserver` (armed on
   `DOMContentLoaded` if the script runs in `<head>`). First hit wins; the observer disconnects.
4. Give up after 60 s with a console error. Test on Wix and Webflow if you change this.

## Product gallery + Shopify add-to-cart

- Renders the product cards of the SSE `products` event (vanilla port of the portal's `ProductCarousel.js`).
- Cards from a Shopify-mirrored catalog carry `variants` (backend `products._attach_variants_to_cards`) and get
  a buy button (`pcBuildCard` → `pcOpenVariantSheet` / `pcDirectAdd` → `pcAddToCart`, `POST /cart/add.js`,
  same-origin because the widget runs inline, not in an iframe). No Shopify cart → checkout permalink.
- After an add, `pcSyncThemeCart` repaints the theme's drawer/badge (Dawn, Horizon, generic tiers).
  Details: OVERVIEW §8.1.
- **Widget-only by design**: the hosted chat (`../ultimo-bots-frontend`) keeps a plain "View" link.

## Waiting-room games (`src/games/`)

While a visitor waits for a live agent, the waiting notice offers "Play a Game" (memory, whack). Contract:
`createGameCenter`, `armOffer(noticeEl)`, `teardown()`. The module owns **no** live-chat state, so it is not
mirrored in the frontend. Dev harness: `src/games/harness.html` (header explains how to serve it).

---

## Conventions — do not violate

- **Keep the live-agent logic 1:1 with [`../ultimo-bots-frontend/src/useLiveAgent.js`](../ultimo-bots-frontend/src/useLiveAgent.js).**
  Any WS / heartbeat / polling / session-token change goes into both, same PR. Gallery, games and the
  pre-chat form are not part of that contract.
- **Shadow DOM isolation.** `<head>` only gets the existing preconnect/font `<link>`s and the
  `saicf-global-scroll-style` (`body.no-scroll`) block; `body` only gets our host container.
- **Keep the `saicf-` prefix**; renaming breaks every selector and partner integrations.
- **`marked` / DOMPurify stay bundled** — never reintroduce runtime CDN imports (Webflow Marketplace
  rejected that delivery chain in 2026-07). `ensureMarked()` / `loadDompurify()` are awaited no-ops.
- **`pointer-events: none` on the host**; visible elements opt back in.
- **Never drop `display: 'block'` from the host's inline style** (`src/index.js:340`), and keep it without
  `!important`. The host has no light-DOM children, so it matches `div:empty`; Shopify Dawn's
  `div:empty { display: none }` hid the whole widget, silently (fixed 2026-08-09). Triage: every node measures
  `0x0` while computed styles look normal → look at the host, not the launcher.
- **Full backend URLs only** (the widget runs on customer domains). **`z-index: 2147483647`** stays.
- **Per-bot storage keys** (`{key}-{botId}`).
- **No "chatbot" in default copy.** Debt: default `promotingText` (`src/index.js:2376`) and the
  `bot_not_found` text (4999).

## Storage keys (per bot, on the host page's origin)

| Key | Storage | Purpose |
|---|---|---|
| `sessionId-{botId}` | sessionStorage | conversation id |
| `ultimo_live_session_token-{botId}` | sessionStorage | live-chat session token |
| `chat-history-{botId}` | sessionStorage | rendered transcript snapshot, restored on reload |
| `saicf-popup-seen-{botId}` | sessionStorage | proactive pop-up shown once per session |
| `saicf-prechat-completed-{botId}` | localStorage | pre-chat form completed |

## Known traps

- **Stale `node_modules` changes the bundle.** Building `main` with webflow-1.3.0's `node_modules` bundles
  DOMPurify 3.4.13 instead of 3.1.6 → `npm ci` first.
- **No tests, no source map, no SRI on `main`.** A bad push ships instantly to every non-Webflow customer.
- **`src/widget.css` is dead** (runtime CSS is a template string in `index.js`).
- **`src/home|about|services|contact.html`** are leftover demo pages, unused.
- **Hardcoded backend URLs**: no per-customer staging; the dev box rewrites them with `sed` at sync time.

---

## Webflow release line (branch `webflow-1.3.0`)

Read-only from `main`: `git show webflow-1.3.0:<path>`. That branch's own `CLAUDE.md` still has the old
`../docs/` links and some pre-divergence claims; this section is the checked summary (2026-10-20).

- **What only it has** (none of this is on `main`): DOMPurify 3.4.13, module-scoped libraries (no page
  globals); the `window.__ULTIMO_BOTS__` mount registry with `destroy(botId?)`, rolled back when the config
  load aborts the mount; config strings sanitised (`escapeHtml`, `safeCssColor`, `safeAssetUrl`,
  `safeNumber`); AI stream as `fetch` POST with manual SSE parsing; `X-Live-Session-Token` header instead of
  tokens in URLs; `fetchWithTimeout` + stream watchdogs (25 s first byte, 65 s stall); owned timers/listeners
  (`ownSetTimeout`, `ownSetInterval`, `ownGlobalListener`, `registerCleanup`); no `body.no-scroll` (Webflow
  finding 5); Shopify commerce code compiled out of the release via `__ULTIMO_COMMERCE__` (DefinePlugin);
  1.3.1: source map next to the artifact, `data-runtime-ready` marker, bot-id fallback from the applied tag.
- **Gates** (`scripts/`, `tests/`): `npm run gate` = `gate:static` (defect classes A–G) → `build:release` →
  `gate:runtime` (Chromium via `../ultimo-bots-portal/node_modules/playwright`) → `gate:claims` (measures
  the artifact, writes `release/<v>/claims-report.json`) → `gate:provenance` (clean tree = local build =
  CDN file = backend version + hash). Also `gate:live <url>`, `gate:cors`. Details: OVERVIEW §8.2.
- **Release flow** (each push is production → owner approval): bump `package.json` version (never reuse
  one) → `npm ci` → `gate:static`, `build:release`, `gate:runtime`, `gate:claims` → copy `release/<v>/` to
  `../ultimo-bots-cdn/<v>/`, record the SRI in its README, push → set `WIDGET_VERSION` / `WIDGET_INTEGRITY_HASH`
  in `webflow.py` (1.3.1 uses `sha256-…`) → deploy backend → `gate:provenance` (and so `npm run gate`) green.
- That branch's committed `dist/bundle.js` is still the pre-divergence `7bcac4f` build; never publish it.

## Where to go next

- Architecture: [`../ultimo-bots-ai-docs/ultimo-bots-widget/OVERVIEW.md`](../ultimo-bots-ai-docs/ultimo-bots-widget/OVERVIEW.md)
- Product: [`11-channel-website-widget.md`](../ultimo-bots-ai-docs/features/11-channel-website-widget.md) ·
  live chat: [`17-live-chat.md`](../ultimo-bots-ai-docs/features/17-live-chat.md) ·
  `widget_configuration` payload: [`21-customization-branding.md`](../ultimo-bots-ai-docs/features/21-customization-branding.md)
- React twin (keep in sync): [`../ultimo-bots-frontend/CLAUDE.md`](../ultimo-bots-frontend/CLAUDE.md)
- CDN repo: [`../ultimo-bots-cdn/README.md`](../ultimo-bots-cdn/README.md) · workspace: [`../CLAUDE.md`](../CLAUDE.md)
