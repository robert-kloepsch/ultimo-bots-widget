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

- **Vanilla JavaScript** in one ~4.1k-line file ([`src/index.js`](src/index.js))
- **webpack 5** ([`webpack.config.js`](webpack.config.js)). Entry `src/index.js` → output `dist/bundle.js`
- **Bundle mode: `development`** — committed `dist/bundle.js` is NOT minified (~165 KB). Known issue.
- **Runtime CDN deps** — `marked@11.1.1` + `dompurify@3.1.6` from jsdelivr at runtime, NOT bundled
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
├── index.js                    # ★ the entire widget — 4125 LOC
├── widget.css                  # informational — runtime CSS is inlined into index.js
├── index.html                  # webpack template (built into dist/)
├── home/about/services/contact.html   # legacy demo pages — unused
└── cloud.png
dist/
├── bundle.js                   # ★ 165 KB — production widget (committed to git)
└── index.html
```

One file is the entire product. Two areas dominate:

- **Top** (~1–1500): bootstrap, Shadow DOM, theming, pre-chat form, AI messages
- **Middle to bottom** (~2500–3500): live-agent state machine — WS, heartbeat, polling, session-token. **Must stay 1:1 in sync with [`../ultimo-bots-frontend/src/useLiveAgent.js`](../ultimo-bots-frontend/src/useLiveAgent.js).**

Search for `W2` / `W6` / `P1`–`P7` / `join_ack` / `rejoin races`
comments — backend contracts.

---

## Conventions — do not violate

- **Keep `useLiveAgent.js` in sync.** Any change to the WS / heartbeat / polling / session-token logic here must be mirrored in [`../ultimo-bots-frontend/src/useLiveAgent.js`](../ultimo-bots-frontend/src/useLiveAgent.js). Same PR.
- **Don't break Shadow DOM isolation.** Don't put styles in `document.head` (except the existing `body.no-scroll` snippet) or append elements to `document.body` directly.
- **Keep the `saicf-` class prefix.** Renaming breaks every selector and any partner integration targeting the widget.
- **Don't bundle `marked` / `DOMPurify`.** Intentionally CDN-loaded.
- **Don't `await` CDN scripts before first render.** `sanitizedMarkdown()` handles "not loaded yet" explicitly. Never block on a third-party CDN.
- **`pointer-events: none` on the host container** + visible elements opt back in. Lets customers click through the invisible bounding box.
- **Hardcoded backend URLs** — don't add relative URLs (widget runs on customer domains).
- **`z-index: 2147483647`** is intentional (max signed int32). Don't reduce.
- **Per-bot key prefixes** for any new storage key (`{key}-{botId}`).
- **No "chatbot" in default copy.** Default `promotingText` at [`src/index.js:1483`](src/index.js) still uses it — flagged debt.

---

## Bootstrap pattern

The widget can drop into a host page before DOM ready, before the host
bundler injects the container, or inside a Wix/Webflow async-injecting
runtime. [`src/index.js:113–152`](src/index.js):

1. Look for `<div id="chat-widget-container" data-user-id="...">`
2. If absent: poll every 200ms AND attach a `MutationObserver` to `document.body`
3. Whichever finds it first wins; observer disconnects on success
4. Hard cap 60s, then log + give up

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

- **Webpack in `mode: 'development'`** — unminified prod bundle. Easy fix; visible to every customer.
- **No CI, no source maps, no SRI, no rollback.** Bad commit ships instantly on push.
- **`src/widget.css` is dead** — runtime CSS lives in a string template inside `index.js`. Edits there have no effect.
- **`home.html` / `about.html` / `services.html` / `contact.html`** — leftover demo assets, safe to delete.
- **Hardcoded backend URLs** — no way to point a single customer at a staging backend without a full rebuild + deploy.
- **No tests.** Smoke-test page only.

---

## Where to go next

- **Architecture (full):** [`../docs/ultimo-bots-widget/OVERVIEW.md`](../docs/ultimo-bots-widget/OVERVIEW.md)
- **Product behaviour:** [`../docs/features/11-channel-website-widget.md`](../docs/features/11-channel-website-widget.md)
- **React twin (must-stay-in-sync):** [`../ultimo-bots-frontend/`](../ultimo-bots-frontend/)
- **Live-chat handoff:** [`../docs/features/17-live-chat.md`](../docs/features/17-live-chat.md)
- **`widget_configuration` payload:** [`../docs/features/21-customization-branding.md`](../docs/features/21-customization-branding.md)
- **Workspace map:** [`../CLAUDE.md`](../CLAUDE.md)
