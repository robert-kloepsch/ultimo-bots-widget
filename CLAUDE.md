# CLAUDE.md — ultimo-bots-widget

The **embeddable chat widget** — the single most production-critical
piece of code in the workspace. One `<script>` tag drops it into any
website (customer site, Wix install, Webflow custom-code, WordPress
plugin, the docs site dogfooding its own bot). Renders a floating
bubble + chat window inside a **Shadow DOM** on a single host `<div>`.

Production sites load this bundle from
**`https://robert-kloepsch.github.io/ultimo-bots-widget/dist/bundle.js`**
— GitHub Pages serves the committed [`dist/bundle.js`](dist/bundle.js).
**No CI, no version pinning, no rollback.** `git push` to that branch
is the deploy. Plan accordingly.

> **Full architecture: [`../docs/ultimo-bots-widget/OVERVIEW.md`](../docs/ultimo-bots-widget/OVERVIEW.md).**
> Product behaviour: [`../docs/features/11-channel-website-widget.md`](../docs/features/11-channel-website-widget.md).
> Workspace map: [`../CLAUDE.md`](../CLAUDE.md).

---

## Stack

- **Vanilla JavaScript** in one ~6.2k-line file ([`src/index.js`](src/index.js))
- **webpack 5** ([`webpack.config.js`](webpack.config.js)). Entry `src/index.js` → output `dist/bundle.js`
- **Bundle mode: `production`** ([`webpack.config.js:19`](webpack.config.js)) — the committed bundle IS minified (~206 KB). Rebuild locally with `mode: 'development'` when you need to debug one.
- **Bundled deps** — `marked@11.1.1` + `dompurify@3.4.13` are real npm dependencies, statically imported (since 2026-07, Webflow Marketplace requires a self-contained artifact; the old runtime jsdelivr imports are gone)
- **Release build** — `npm run build:release` ([`webpack.release.js`](webpack.release.js)) emits the minified, versioned artifact `release/<version>/ultimo-widget.js` that is published to the `ultimo-bots-cdn` repo (GitHub Pages behind `widget.ultimo-bots.com`) and registered with Webflow via SRI hash. Published versions are IMMUTABLE — bump `package.json` version for a new release and update the backend's `WIDGET_VERSION`/`WIDGET_INTEGRITY_HASH` (`ultimo-bots-backend/src/controller/webflow.py`) in lockstep.
- **Shadow DOM** + `:host { all: initial }` for full isolation
- **Class prefix: `saicf-*`** — legacy, keep it
- **Backend URLs hardcoded** to `https://portal.ultimo-bots.com/api/` and `wss://portal.ultimo-bots.com/api/ws`

The npm name `swiss_bot_widget` is legacy — ignore.

---

## Run locally

No `start`/`build` scripts. Build by hand:

```bash
npm install
npx webpack          # writes dist/bundle.js + dist/index.html
```

[`test.html`](test.html) loads the GitHub-Pages-hosted production
bundle. For local testing, open [`dist/index.html`](dist/index.html)
after `npx webpack`.

**Deploy = commit `dist/bundle.js` + push.** GitHub Pages caches
aggressively; propagation can take minutes.

---

## Layout

```
src/
├── index.js                    # ★ the entire widget — 6250 LOC
├── widget.css                  # informational — runtime CSS is inlined into index.js
├── index.html                  # webpack template (built into dist/)
├── home/about/services/contact.html   # legacy demo pages — unused
└── cloud.png
dist/
├── bundle.js                   # ★ ~206 KB minified — production widget (committed to git)
└── index.html
```

One file is the entire product. Two areas dominate:

- **Top** (~1–1500): bootstrap, Shadow DOM, theming, pre-chat form, AI messages
- **Middle to bottom** (~2500–3500): live-agent state machine — WS, heartbeat, polling, session-token. **Must stay 1:1 in sync with [`../ultimo-bots-frontend/src/useLiveAgent.js`](../ultimo-bots-frontend/src/useLiveAgent.js).**

Search for `W2` / `W6` / `P1`–`P7` / `join_ack` / `rejoin races`
comments — backend contracts.

---

## Product gallery + Shopify add-to-cart

The in-chat product gallery (`ub-pc-*`, a vanilla port of the portal's
`ProductCarousel.js`) renders the structured cards the backend attaches to a
reply (SSE `products` event). Cards from a **Shopify-mirrored catalog** also
carry a `variants` array (`[{id, title, options, available, price}]`, numeric
ids) — the backend hydrates it only for `source='shopify'` (see
`products._attach_variants_to_cards`), so on every other platform the gallery is
unchanged.

Those cards get a **buy button** (`pcBuildCard`): multiple variants → "Select
options" opens a bottom sheet (`pcOpenVariantSheet`) with one `<select>` per
option, live price/availability, and add-to-cart; a single variant → "Add to
cart" adds directly (`pcDirectAdd`). Add-to-cart is `POST /cart/add.js`
(`pcAddToCart`) — the **storefront AJAX Cart API**, which works because the
widget runs inline in the Shadow DOM on the host page (NOT an iframe), so it is
same-origin on a Shopify storefront and fills the shopper's real cart. Fallbacks:
a Shopify cart that rejects the add (sold out) shows the message; a page with no
Shopify cart (widget embedded elsewhere) opens the checkout **permalink**
(`origin/cart/{variantId}:1`). The sheet is appended to `chatWindow`, never
`document.body` (Shadow-DOM isolation).

After a successful add the widget also syncs the **theme's cart UI** (drawer +
header badge — theme-rendered HTML that only the theme's own add flow would
repaint), three tiers in `pcSyncThemeCart`: (1) Dawn-family — request the
`<cart-drawer>` element's own section ids in the `/cart/add.js` call and hand
the returned HTML to `renderContents()` (drawer repaints and opens, identical
to the theme's native add UX); (2) Horizon-family (Shopify's post-2025
defaults, no `<cart-drawer>`) — dispatch a hand-rolled
`shopify:cart:lines-update` STANDARD storefront event (`action:'add'` +
`lines` + a `promise` resolving `{cart:null, detail:{itemCount}}` from
`/cart.js`; failure rejects as AbortError so listeners stay quiet): the badge
repaints, the cart items component re-fetches its own section, the drawer
auto-opens (`pcDispatchStandardCartEvent`, contract read from Shopify/horizon
+ cdn.shopify.com/storefront/standard-events.js); (3) generic — a `/cart.js`
read updates common badge elements (`pcUpdateCartBadges`). An unknown theme
keeps the old behaviour — server cart correct, UI catches up on navigation.

**Deliberately widget-only:** the hosted chat page
([`../ultimo-bots-frontend/`](../ultimo-bots-frontend/), which reuses the portal's
`ProductCarousel.js`) has NO storefront cart, so it keeps the plain "View" link.
This is an intentional single-surface feature, not a sync gap — the 1:1 rule
below is about the shared live-agent state machine, not every gallery affordance.

## Conventions — do not violate

- **Keep `useLiveAgent.js` in sync.** Any change to the WS / heartbeat / polling / session-token logic here must be mirrored in [`../ultimo-bots-frontend/src/useLiveAgent.js`](../ultimo-bots-frontend/src/useLiveAgent.js). Same PR. (The Shopify buy button touches NONE of that — it is not mirrored, by design.)
- **Don't break Shadow DOM isolation, and never touch the host page.** Nothing of ours goes into `document.head` except removable `<link>` hints (preconnect, optional Google font), nothing is appended to `document.body` except our own host container, and the host's `body`/`html` are never classed or styled. The old `body.no-scroll` mobile lock was a Webflow rejection (finding 5, 2026-08-17): scroll containment now lives on our own scroller (`overscroll-behavior: contain` + a touch guard inside the shadow tree). `gate:static` class F enforces this.
- **Keep the `saicf-` class prefix.** Renaming breaks every selector and any partner integration targeting the widget.
- **`marked` / `DOMPurify` are bundled — never reintroduce runtime CDN imports.** The Webflow Marketplace rejected the runtime-loading delivery chain (2026-07); the artifact must stay self-contained. (`ensureMarked()`/`loadDompurify()` remain as awaited no-ops.)
- **Never write page globals.** `marked` / `DOMPurify` stay module-scoped. The ONLY global is the namespaced `window.__ULTIMO_BOTS__` mount registry (instances + `destroy(botId?)`).
- **Every server-controlled config string is sanitised before it reaches HTML.** Use `escapeHtml` (text/attributes), `safeCssColor`, `safeAssetUrl`, `safeNumber` — never interpolate a `widgetConfig.*` / `liveSettings.*` value into a template raw. A 2026-08 review proved config fields were an execution channel that SRI does not cover.
- **No visitor text or session tokens in URLs.** The AI stream is `fetch` + POST body with manual SSE parsing (not `EventSource`, which cannot POST or set headers); live-session tokens go in the `X-Live-Session-Token` header; `host_url` / `page_url` carry origin + pathname only.
- **Every network call is bounded.** Init requests use `fetchWithTimeout`; the stream has a first-byte (25s) and stall (65s) watchdog; interval-driven calls have in-flight guards.
- **Host-page commerce code is gated behind `__ULTIMO_COMMERCE__`** (webpack DefinePlugin: `true` for `dist/bundle.js`, `false` for the hosted release). The hosted artifact must contain no `cart/add.js`, `CartCount` or `shopify:cart` strings.
- **Interactive controls are real `<button>`s** with accessible names; anything long-lived registers a cleanup via `registerCleanup`.
- **Timers and host-lifetime listeners go through the owned helpers.** Inside the instance use `ownSetTimeout` / `ownSetInterval` (tracked, skipped after destroy, cleared by `destroy()`) and `ownGlobalListener(target, type, fn)` for anything on `window` / `document` / `visualViewport` (removed by `destroy()`). Observers register a `disconnect()` cleanup. The only native timers allowed are request-abort timers. The 1.2.0 rejection (finding 1) was exactly a `visibilitychange` listener and heartbeat timers surviving teardown. `gate:static` class C and the runtime gate's teardown census enforce this.
- **`pointer-events: none` on the host container** + visible elements opt back in. Lets customers click through the invisible bounding box.
- **Never drop `display: 'block'` from the host container's inline style** ([`src/index.js:291`](src/index.js)). The host has NO light-DOM children, so it matches `:empty` — and Shopify's Dawn ships `div:empty { display: none }` in `base.css`, which hid the entire widget on every Dawn store. An inline declaration outranks any normal author rule, which is the whole fix. Keep it **without** `!important` so a site that hides the widget on purpose still wins. See Known traps.
- **Hardcoded backend URLs** — don't add relative URLs (widget runs on customer domains).
- **`z-index: 2147483647`** is intentional (max signed int32). Don't reduce.
- **Per-bot key prefixes** for any new storage key (`{key}-{botId}`).
- **No "chatbot" in default copy.** Default `promotingText` at [`src/index.js:1483`](src/index.js) still uses it — flagged debt.

---

## Bootstrap pattern

The widget can drop into a host page before DOM ready, before the host
bundler injects the container, or inside a Wix/Webflow async-injecting
runtime. [`src/index.js:173–232`](src/index.js):

1. Look for `<div id="chat-widget-container" data-user-id="...">`
2. **Webflow hosted-script path:** if no container exists but our own `<script>` tag (captured via `document.currentScript` at eval time) carries `data-bot_id`, the bootstrap creates the container itself — this is how the SRI-pinned Webflow artifact boots without any loader
3. If absent: poll every 200ms AND attach a `MutationObserver` to `document.body` (armed on DOMContentLoaded when the script runs in `<head>` before `<body>` exists)
4. Whichever finds it first wins; observer disconnects on success
5. Hard cap 60s, then log + give up

Test against Wix and Webflow if you change this.

---

## Storage keys (per-bot scoped)

| Key | Storage | Purpose |
|---|---|---|
| `sessionId-{botId}` | sessionStorage | Conversation id |
| `ultimo_live_session_token-{botId}` | sessionStorage | Live-chat session token |
| `saicf-popup-seen-{botId}` | sessionStorage | Suppress proactive pop-up once per session |
| `saicf-prechat-completed-{botId}` | localStorage | Pre-chat form completion |

---

## Known traps

- **The host `<div>` looks EMPTY to the host page's CSS.** Everything lives in the Shadow DOM, and `:empty` only sees the light DOM — so `#chat-widget-container` matches `div:empty`. Shopify's Dawn (`base.css`, `a:empty, ul:empty, div:empty, … { display: none }`) therefore hid the whole widget on every Dawn store: it still booted, fetched its config and built the Shadow DOM, so there was **no error anywhere** and every node simply measured `0x0`. Fixed 2026-08-09 by the inline `display: 'block'` at [`src/index.js:291`](src/index.js). Triage recipe: `getBoundingClientRect()` returning `[0,0,0,0]` while `getComputedStyle` reports normal values means "not in the rendering tree", i.e. look at the host, not at the launcher. The same fix is in the release tree's source but **not published** — see below.
- **Two branches, two artifacts — check which one you are building.** `main` feeds `dist/bundle.js` (Wix, WordPress, docs). The hosted Webflow artifact is built from the release branch and published to `ultimo-bots-cdn`. In 2026-08 the hardening branch was cut from a stale base and never merged back, so `main` and the shipped Webflow runtime diverged for ten days without any error surfacing. `npm run gate:provenance` now checks the whole chain: clean working tree → local build → the file served from the CDN → the version and SRI registered in `webflow.py`.
- **No CI, no source maps, no SRI, no rollback.** Bad commit ships instantly on push.
- **`src/widget.css` is dead** — runtime CSS lives in a string template inside `index.js`. Edits there have no effect.
- **`home.html` / `about.html` / `services.html` / `contact.html`** — leftover demo assets, safe to delete.
- **Hardcoded backend URLs** — no way to point a single customer at a staging backend without a full rebuild + deploy.
- **Four gates, run them before any release.** `npm run gate` chains all of them. `gate:static` enforces seven defect classes on the source (A markup, B URLs, C teardown incl. timer/listener census, D keyboard, E deadlines, F host page untouched, G no non-production hosts / native overrides), `gate:runtime` drives the built artifact in Chromium against a mocked backend (incl. teardown census with tab-switch pokes and mobile host isolation at 375px), `gate:claims` measures the artifact bytes (bundled DOMPurify/marked versions from the lockfile, forbidden strings, disclosed hosts, backend lockstep) and writes `release/<v>/claims-report.json` — the review notes are written from that report, never from source or package.json, `gate:provenance` verifies source, build, CDN and backend agree. `gate:live <url>` checks a published Webflow page (incl. `crossorigin="anonymous"` on the tag). Every gate is validated in both directions: green on 1.3.0, red on the rejected 1.2.0/1.1.0 artifacts.

---

## Where to go next

- **Architecture (full):** [`../docs/ultimo-bots-widget/OVERVIEW.md`](../docs/ultimo-bots-widget/OVERVIEW.md)
- **Product behaviour:** [`../docs/features/11-channel-website-widget.md`](../docs/features/11-channel-website-widget.md)
- **React twin (must-stay-in-sync):** [`../ultimo-bots-frontend/`](../ultimo-bots-frontend/)
- **Live-chat handoff:** [`../docs/features/17-live-chat.md`](../docs/features/17-live-chat.md)
- **`widget_configuration` payload:** [`../docs/features/21-customization-branding.md`](../docs/features/21-customization-branding.md)
- **Workspace map:** [`../CLAUDE.md`](../CLAUDE.md)
