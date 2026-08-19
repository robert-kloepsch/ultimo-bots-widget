#!/usr/bin/env node
/**
 * Runtime gate for the widget release artifact.
 *
 * The static gate (scripts/class-gate.js) proves the source obeys the five
 * rules. This one drives the BUILT artifact in a real browser and reproduces
 * the exact scenarios from the 2026-08-07 Webflow review, so "fixed" means
 * observed behaviour and not a promise.
 *
 * Everything is mocked locally — no backend, no network, no production data.
 *
 *   node tests/runtime-gate.js                 # uses release/<version>/
 *   node tests/runtime-gate.js path/to/file.js # or an explicit artifact
 */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PW = path.join(__dirname, '..', '..', 'ultimo-bots-portal', 'node_modules', 'playwright');
const { chromium } = require(PW);

const pkg = require('../package.json');
const ARTIFACT =
  process.argv[2] || path.join(__dirname, '..', 'release', pkg.version, 'ultimo-widget.js');
const BOT = 'TESTBOT';
const API = 'https://portal.ultimo-bots.com';

if (!fs.existsSync(ARTIFACT)) {
  console.error(`artifact not found: ${ARTIFACT}\nrun: npm run build:release`);
  process.exit(1);
}

// ── Mocked backend payloads ───────────────────────────────────────────────
const CONFIG = {
  theme_color: '#5e1bff',
  header_font_color: '#ffffff',
  header_text: 'Test Agent',
  input_placeholder: 'Ask me anything',
  welcome_message: ['Hello there'],
  promoting_text: 'Powered by Ultimo Bots',
  custom_branding_text: '',
  remove_powered_by: false,
  font_family: 'DM Sans',
  widget_size: 60,
  widget_border_radius: 16,
  widget_horizontal_alignment: 20,
  widget_vertical_alignment: 20,
  pulsing: false,
  open_links_in_new_tab: true,
  pop_up_messages: ['Need a hand?'],
  pop_up_delay_seconds: 0,
  predefined_questions: [],
  require_pre_chat: false,
  pre_chat_required_fields: [],
  header_icon_path: null,
  widget_icon_path: null,
  avatar_icon_path: null,
  button_hover_color: '#4a15cc',
};
const LIVE_SETTINGS = {
  show_request_button: true,
  request_button_text: 'Talk to a human',
  agent_display_name: 'Agent',
  agent_avatar_url: null,
  agent_avatar_color: '#5e1bff',
  offline_message: 'No agent available',
};

const sse = (frames) => frames.map((f) => `${f}\n\n`).join('');

// ── Test bookkeeping ──────────────────────────────────────────────────────
const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        ${detail}` : ''}`);
};

// Counts what the runtime leaves behind on objects that outlive it. Installed
// before any page script runs, so it sees every call the widget makes.
const CENSUS_SCRIPT = `
  (() => {
    const c = window.__CENSUS__ = {
      listeners: new Map(),      // key -> outstanding (added - removed) listeners
      timersOpen: new Set(),     // native timer ids created and neither cleared nor fired
      timerFires: 0,
      firesAfterMark: 0,
      marked: false,
      visibility: 'visible',
    };
    const key = (t, type) => (t === window ? 'window' : t === document ? 'document' : 'other') + ':' + type;
    const origAdd = EventTarget.prototype.addEventListener;
    const origRemove = EventTarget.prototype.removeEventListener;
    for (const target of [window, document]) {
      target.addEventListener = function (type, fn, opts) {
        const once = !!(opts && typeof opts === 'object' && opts.once);
        // Only listeners registered from the widget file count; Playwright
        // installs its own window listeners for actionability checks.
        const ours = /ultimo-widget\.js/.test(new Error().stack || '');
        if (ours && !once && type !== 'DOMContentLoaded') {
          const k = key(this, type); c.listeners.set(k, (c.listeners.get(k) || 0) + 1);
        }
        return origAdd.call(this, type, fn, opts);
      };
      target.removeEventListener = function (type, fn, opts) {
        const k = key(this, type);
        if (c.listeners.has(k)) c.listeners.set(k, c.listeners.get(k) - 1);
        return origRemove.call(this, type, fn, opts);
      };
    }
    if (window.visualViewport) {
      const vv = window.visualViewport;
      const oa = vv.addEventListener.bind(vv), orm = vv.removeEventListener.bind(vv);
      vv.addEventListener = (type, fn, opts) => { const k = 'visualViewport:' + type; c.listeners.set(k, (c.listeners.get(k) || 0) + 1); return oa(type, fn, opts); };
      vv.removeEventListener = (type, fn, opts) => { const k = 'visualViewport:' + type; if (c.listeners.has(k)) c.listeners.set(k, c.listeners.get(k) - 1); return orm(type, fn, opts); };
    }
    const oST = window.setTimeout, oSI = window.setInterval, oCT = window.clearTimeout, oCI = window.clearInterval;
    window.setTimeout = function (fn, ms, ...args) {
      let id;
      id = oST(() => { c.timersOpen.delete(id); c.timerFires++; if (c.marked) c.firesAfterMark++; return typeof fn === 'function' ? fn(...args) : undefined; }, ms);
      c.timersOpen.add(id); return id;
    };
    window.setInterval = function (fn, ms, ...args) {
      let id;
      id = oSI(() => { c.timerFires++; if (c.marked) c.firesAfterMark++; return typeof fn === 'function' ? fn(...args) : undefined; }, ms);
      c.timersOpen.add(id); return id;
    };
    window.clearTimeout = function (id) { c.timersOpen.delete(id); return oCT(id); };
    window.clearInterval = function (id) { c.timersOpen.delete(id); return oCI(id); };
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => c.visibility });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => c.visibility === 'hidden' });
  })();
`;

async function withPage(fn, { stallConfig = false, failConfig = false, census = false, mobile = false } = {}) {
  const browser = await chromium.launch();
  const context = await browser.newContext(mobile
    ? { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : {});
  const page = await context.newPage();
  if (census) await page.addInitScript(CENSUS_SCRIPT);

  const apiRequests = [];
  const sockets = [];   // every WS the page opens, counted where it is routed:
                        // page.on('websocket') does not fire for routed sockets.
  await page.routeWebSocket(`wss://portal.ultimo-bots.com/api/ws`, (ws) => {
    sockets.push(ws);
    ws.onMessage((raw) => {
      let msg = {};
      try { msg = JSON.parse(raw); } catch { /* ignore */ }
      if (msg.type === 'widget_init') {
        ws.send(JSON.stringify({ type: 'widget_init_ack', session_status: 'active' }));
      }
    });
  });
  page.on('request', (r) => {
    if (r.url().startsWith(API)) apiRequests.push(r.url());
  });

  await page.route(`${API}/api/**`, async (route) => {
    const url = route.request().url();
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

    if (url.includes('/api/widget_configuration/')) {
      if (failConfig) return route.fulfill({ status: 500, body: 'boom' });
      if (stallConfig) {
        // Headers now, body never: the exact case the reviewer described.
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: await new Promise(() => {}),
        });
      }
      return json(CONFIG);
    }
    if (url.includes('/api/live_chat_settings_public/')) return json(LIVE_SETTINGS);
    if (url.includes('/api/live/agent_available/')) return json({ available: true });
    if (url.includes('/api/live/heartbeat')) return json({ session_token: 'tok-1', session_status: 'active' });
    if (url.includes('/api/live/messages/')) return json({ messages: [] });
    if (url.includes('/api/chat_history') || url.includes('/api/chat_sessions')) return json({ messages: [] });
    if (url.includes('/api/chatbot_response')) {
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sse([
          'data: Here is what I found',
          'event: products\ndata: ' + JSON.stringify({
            products: [{
              title: 'Injected product',
              url: 'javascript:window.__PWNED__=1',
              image_url: 'javascript:window.__PWNED_IMG__=1',
              price: 9.99,
              currency: 'EUR',
            }],
          }),
          'event: end\ndata: ',
        ]),
      });
    }
    return json({});
  });

  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/ultimo-widget.js')) {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      return res.end(fs.readFileSync(ARTIFACT));
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!doctype html><html><head><title>widget host</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>
      <h1>Host page</h1>
      <script src="/ultimo-widget.js" data-bot_id="${BOT}"></script>
    </body></html>`);
  });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}/`;

  try {
    return await fn({ page, base, apiRequests, sockets });
  } finally {
    await browser.close();
    server.close();
  }
}

const openChat = (page) => page.evaluate(() => {
  document.getElementById('ultimo-bots-container-TESTBOT')
    .shadowRoot.querySelector('.saicf-chat-widget-icon').click();
});
const sendUserMessage = (page, text) => page.evaluate((t) => {
  const sr = document.getElementById('ultimo-bots-container-TESTBOT').shadowRoot;
  const input = sr.querySelector('.saicf-chat-input');
  input.value = t;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  sr.querySelector('.saicf-send-message').click();
}, text);
const chatIsOpen = (page) => page.evaluate(() => {
  const sr = document.getElementById('ultimo-bots-container-TESTBOT').shadowRoot;
  return !!sr.querySelector('.saicf-chat-window.show');
});

const mounted = (page) =>
  page.waitForFunction(
    () => !!(window.__ULTIMO_BOTS__ && window.__ULTIMO_BOTS__.instances
      && Object.values(window.__ULTIMO_BOTS__.instances).some((i) => i.status === 'mounted')),
    null,
    { timeout: 15000 },
  );

// ── 1. The widget mounts and registers exactly one instance ───────────────
async function testMount() {
  await withPage(async ({ page, base }) => {
    await page.goto(base);
    await mounted(page);
    const ids = await page.evaluate(() => Object.keys(window.__ULTIMO_BOTS__.instances));
    const launcher = await page.evaluate(() => {
      const host = document.getElementById(`ultimo-bots-container-TESTBOT`);
      return !!(host && host.shadowRoot && host.shadowRoot.querySelector('.saicf-chat-widget-icon'));
    });
    // Ready signal: the host element carries data-runtime-ready once the
    // configuration is loaded and the launcher is in the tree (the Webflow
    // App Review Preflight harness waits for a light-DOM selector).
    const ready = await page.evaluate(() => {
      const el = document.querySelector('[data-runtime-ready]');
      return !!el && el.id === 'ultimo-bots-container-TESTBOT';
    });
    record('mount: one namespaced instance, launcher rendered, ready marker set',
      ids.length === 1 && ids[0] === BOT && launcher && ready,
      `instances=${JSON.stringify(ids)} launcher=${launcher} ready=${ready}`);
  });
}

// ── 9. A re-injected copy of the runtime (no attributes) still works ───────
// A harness, tag manager or SPA may execute our file a second time from a
// tag that carries no data-bot_id. The bot id then comes from the page's own
// Webflow-applied tag, and the registry guard prevents a second mount.
async function testReinjectedRuntime() {
  await withPage(async ({ page, base }) => {
    await page.goto(base);
    await mounted(page);
    await page.evaluate(() => {
      const s = document.createElement('script');
      s.src = '/ultimo-widget.js';              // same file, NO data-bot_id
      document.head.appendChild(s);
    });
    await page.waitForTimeout(3000);
    const r = await page.evaluate(() => ({
      instances: Object.keys(window.__ULTIMO_BOTS__.instances),
      hosts: document.querySelectorAll('[id^="ultimo-bots-container-"]').length,
      launchers: document.getElementById('ultimo-bots-container-TESTBOT').shadowRoot.querySelectorAll('.saicf-chat-widget-icon').length,
      errors: 0,
    }));
    record('re-injected runtime without attributes: no second mount, one host, one launcher',
      r.instances.length === 1 && r.hosts === 1 && r.launchers === 1,
      JSON.stringify(r));
  });
}

// ── 10. Runtime injected ONLY without attributes resolves the id from the page tag ─
async function testInjectedOnlyResolvesFromPageTag() {
  // Serve a host page whose own tag is inert (type=text/plain so it does not
  // execute) but carries data-bot_id, then inject the runtime without
  // attributes: the fallback must find the bot id on the page tag.
  await withPage(async ({ page, base }) => {
    await page.route('**/inert-host', (route) => route.fulfill({
      status: 200, contentType: 'text/html',
      body: `<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body>
        <h1>Host</h1>
        <script type="text/plain" src="https://widget.ultimo-bots.com/1.3.1/ultimo-widget.js" data-bot_id="TESTBOT"></script>
        <script>const s=document.createElement('script'); s.src='/ultimo-widget.js'; document.head.appendChild(s);</script>
      </body></html>`,
    }));
    await page.goto(base + 'inert-host');
    await mounted(page);
    const ok = await page.evaluate(() => !!document.querySelector('#ultimo-bots-container-TESTBOT[data-runtime-ready]'));
    record('injected runtime (no attributes) takes the bot id from the page own Webflow tag',
      ok, `ready host present=${ok}`);
  });
}

// ── 2. Nothing runs after destroy() — the reviewer's finding 2 ────────────
async function testDestroySilence() {
  await withPage(async ({ page, base, apiRequests, sockets }) => {
    await page.goto(base);
    await mounted(page);

    // Drive a real live session so the WebSocket path is actually armed.
    await openChat(page);
    await page.waitForTimeout(1500);
    await sendUserMessage(page, 'hello');
    await page.waitForTimeout(3000);

    const socketsBefore = sockets.length;
    const wsArmed = socketsBefore > 0;

    await page.evaluate(() => window.__ULTIMO_BOTS__.destroy());
    const requestsAtDestroy = apiRequests.length;

    // The old build scheduled a reconnect from the close handler with a
    // 1s base delay and doubling backoff — 12s covers several attempts.
    await page.waitForTimeout(12000);

    const newRequests = apiRequests.slice(requestsAtDestroy);
    const newSockets = sockets.length - socketsBefore;
    const gone = await page.evaluate(() =>
      !document.getElementById('ultimo-bots-container-TESTBOT')
      && Object.keys(window.__ULTIMO_BOTS__.instances).length === 0);

    record('destroy: no socket reopens, no requests, instance removed',
      wsArmed && newSockets === 0 && newRequests.length === 0 && gone,
      `ws armed before destroy=${wsArmed} | new sockets=${newSockets} | new requests=${newRequests.length}${newRequests.length ? ` (${newRequests[0]})` : ''} | container+registry cleared=${gone}`);
  });
}

// ── 3. A failed init rolls back and a later execution recovers ────────────
async function testFailedInitRecovers() {
  await withPage(async ({ page, base }) => {
    await page.goto(base);
    // Init throws (config 500). The registry entry must not survive.
    await page.waitForTimeout(4000);
    const stuck = await page.evaluate(() => Object.keys(window.__ULTIMO_BOTS__?.instances || {}));

    // Now let the config succeed and run the script again, as a second
    // execution on the page would.
    await page.unroute(`${API}/api/**`);
    await page.route(`${API}/api/**`, (route) => {
      const url = route.request().url();
      const body = url.includes('/api/widget_configuration/') ? CONFIG
        : url.includes('/api/live_chat_settings_public/') ? LIVE_SETTINGS
        : url.includes('/api/live/agent_available/') ? { available: true }
        : {};
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.evaluate(() => {
      const s = document.createElement('script');
      s.src = '/ultimo-widget.js';
      s.setAttribute('data-bot_id', 'TESTBOT');
      document.body.appendChild(s);
    });
    let recovered = false;
    try { await mounted(page); recovered = true; } catch { /* stays false */ }

    record('failed init: registry rolled back, second execution recovers',
      stuck.length === 0 && recovered,
      `registry after failure=${JSON.stringify(stuck)} | recovered=${recovered}`);
  }, { failConfig: true });
}

// ── 4. Headers-then-stalled body must not hang init ───────────────────────
async function testBodyStall() {
  await withPage(async ({ page, base }) => {
    const t0 = Date.now();
    await page.goto(base);
    // fetchWithTimeout's default deadline is 10s; give it room and check the
    // page never ends up with a half-registered instance.
    await page.waitForTimeout(17000);
    const registry = await page.evaluate(() => Object.entries(window.__ULTIMO_BOTS__?.instances || {})
      .map(([k, v]) => [k, v.status]));
    const responsive = await page.evaluate(() => document.title);
    record('body stall: deadline fires, nothing left half-mounted',
      registry.length === 0 && responsive === 'widget host',
      `after ${Math.round((Date.now() - t0) / 1000)}s registry=${JSON.stringify(registry)}`);
  }, { stallConfig: true });
}

// ── 5. A javascript: product URL must never become navigable ──────────────
async function testProductUrlNeutralised() {
  await withPage(async ({ page, base }) => {
    await page.goto(base);
    await mounted(page);
    await openChat(page);
    await page.waitForTimeout(1500);
    await sendUserMessage(page, 'show me products');
    await page.waitForTimeout(4000);

    const card = await page.evaluate(() => {
      const sr = document.getElementById('ultimo-bots-container-TESTBOT').shadowRoot;
      const el = sr.querySelector('.ub-pc-card');
      if (!el) return null;
      const img = el.querySelector('img');
      return { tag: el.tagName, href: el.getAttribute('href'), imgSrc: img ? img.getAttribute('src') : null };
    });
    // Clicking must not execute anything either.
    await page.evaluate(() => {
      const sr = document.getElementById('ultimo-bots-container-TESTBOT').shadowRoot;
      sr.querySelector('.ub-pc-card')?.click();
    });
    await page.waitForTimeout(500);
    const pwned = await page.evaluate(() => !!(window.__PWNED__ || window.__PWNED_IMG__));

    const safe = card !== null && card.tag !== 'A' && !card.href && !card.imgSrc && !pwned;
    record('product URL: javascript: neutralised, card not navigable',
      safe,
      card ? `tag=${card.tag} href=${JSON.stringify(card.href)} img=${JSON.stringify(card.imgSrc)} executed=${pwned}` : 'no product card rendered');
  });
}

// ── 6. A live-agent pop-up must be keyboard reachable and operable ────────
async function testAgentPopupKeyboard() {
  await withPage(async ({ page, base, sockets }) => {
    await page.goto(base);
    await mounted(page);

    // Open the chat and send one message: that starts the live session and
    // opens the WebSocket the agent message will arrive on.
    await openChat(page);
    await page.waitForTimeout(1500);
    await sendUserMessage(page, 'hi');
    await page.waitForTimeout(3000);
    if (sockets.length === 0) {
      return record('agent pop-up: keyboard reachable and operable', false,
        'no WebSocket was opened, could not deliver an agent message');
    }

    // Close the chat, then let a live agent write. This is exactly the state
    // the reviewer described: a message arriving while the chat is closed.
    await page.evaluate(() => {
      document.getElementById('ultimo-bots-container-TESTBOT')
        .shadowRoot.querySelector('.saicf-close-btn').click();
    });
    await page.waitForTimeout(1000);
    await sockets[sockets.length - 1].send(JSON.stringify({
      type: 'live_agent_message', id: 1, content: 'An agent is here to help you',
    }));
    await page.waitForTimeout(1500);

    const pop = await page.evaluate(() => {
      const sr = document.getElementById('ultimo-bots-container-TESTBOT').shadowRoot;
      const el = sr.querySelector('.saicf-agent-pop-up');
      if (!el) return null;
      return {
        tag: el.tagName,
        label: el.getAttribute('aria-label'),
        focusable: el.tagName === 'BUTTON' || el.tabIndex >= 0,
      };
    });
    if (!pop) {
      return record('agent pop-up: keyboard reachable and operable', false,
        'no agent pop-up appeared after the agent message');
    }

    // Focus it and activate with the keyboard only, no mouse anywhere.
    const focused = await page.evaluate(() => {
      const sr = document.getElementById('ultimo-bots-container-TESTBOT').shadowRoot;
      const el = sr.querySelector('.saicf-agent-pop-up');
      el.focus();
      return sr.activeElement === el;
    });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    const opened = await chatIsOpen(page);

    record('agent pop-up: keyboard reachable and operable',
      pop.tag === 'BUTTON' && pop.focusable && focused && opened,
      `${JSON.stringify(pop)} | focusable=${focused} | Enter opened chat=${opened}`);
  });
}

// ── 7. Teardown census: nothing of ours survives destroy() ────────────────
// The reviewer's finding 1 on 1.2.0 was not a reopened socket (that was
// fixed) but what a later event could still wake: listeners left on
// document/window and timers that were never cleared. This test counts
// them, then pokes the survivors the way a tab switch would.
async function testTeardownCensus() {
  await withPage(async ({ page, base, apiRequests, sockets }) => {
    await page.goto(base);
    await mounted(page);
    await openChat(page);
    await page.waitForTimeout(1500);
    await sendUserMessage(page, 'hello');
    await page.waitForTimeout(3000);
    const wsArmed = sockets.length > 0;

    // A tab switch while alive, so the visibility paths are exercised first.
    await page.evaluate(() => { window.__CENSUS__.visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(500);
    await page.evaluate(() => { window.__CENSUS__.visibility = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(1500);

    await page.evaluate(() => window.__ULTIMO_BOTS__.destroy());
    await page.waitForTimeout(1500);
    const after = await page.evaluate(() => {
      const c = window.__CENSUS__;
      c.marked = true;
      return {
        listeners: [...c.listeners.entries()].filter(([, n]) => n > 0).map(([k, n]) => `${k}=${n}`),
        timersOpen: c.timersOpen.size,
      };
    });
    const reqAtDestroy = apiRequests.length;
    const socksAtDestroy = sockets.length;

    // Poke: hide and show the tab twice after teardown, then wait out any
    // heartbeat/poll cadence (15 s) plus a reconnect backoff.
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => { window.__CENSUS__.visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); });
      await page.waitForTimeout(300);
      await page.evaluate(() => { window.__CENSUS__.visibility = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(20000);
    const fires = await page.evaluate(() => window.__CENSUS__.firesAfterMark);
    const newReq = apiRequests.length - reqAtDestroy;
    const newSocks = sockets.length - socksAtDestroy;

    record('teardown census: no listeners, no timers, nothing wakes on tab switch',
      wsArmed && after.listeners.length === 0 && after.timersOpen === 0 && fires === 0 && newReq === 0 && newSocks === 0,
      `ws armed=${wsArmed} | surviving listeners=${JSON.stringify(after.listeners)} | open timers=${after.timersOpen} | timer fires after destroy=${fires} | requests=${newReq} | sockets=${newSocks}`);
  }, { census: true });
}

// ── 8. Mobile: the host page is never restyled ─────────────────────────────
// Finding 5 on 1.2.0: opening the widget at a phone width put position:fixed,
// overflow:hidden, inset:0, width:100% onto the customer's body and html.
async function testMobileHostIsolation() {
  await withPage(async ({ page, base }) => {
    await page.goto(base);
    await mounted(page);
    // Give the host page real height so scroll position is observable.
    await page.evaluate(() => {
      const filler = document.createElement('div');
      filler.style.height = '3000px';
      document.body.appendChild(filler);
      window.scrollTo(0, 400);
    });
    await page.waitForTimeout(300);
    const snap = () => page.evaluate(() => {
      const pick = (el) => {
        const cs = getComputedStyle(el);
        return [cs.position, cs.overflow, cs.overflowY, cs.width, cs.top, cs.left, cs.touchAction, el.className, el.getAttribute('style')].join('|');
      };
      return {
        body: pick(document.body),
        html: pick(document.documentElement),
        headOurs: [...document.head.querySelectorAll('[id^="saicf"], style')].length,
        scrollY: window.scrollY,
      };
    });
    const before = await snap();
    await openChat(page);
    await page.waitForTimeout(1200);
    const open = await snap();
    const chatVisible = await chatIsOpen(page);
    await page.evaluate(() => {
      document.getElementById('ultimo-bots-container-TESTBOT').shadowRoot.querySelector('.saicf-close-btn').click();
    });
    await page.waitForTimeout(800);
    const closed = await snap();
    const same = (a, b) => a.body === b.body && a.html === b.html && a.headOurs === b.headOurs && a.scrollY === b.scrollY;
    record('mobile: body/html untouched while the chat is open and after close',
      chatVisible && same(before, open) && same(before, closed),
      `chat opened=${chatVisible} | body(before)=${before.body.slice(0, 70)} | body(open)=${open.body.slice(0, 70)} | head styles before/open=${before.headOurs}/${open.headOurs} | scrollY before/open/closed=${before.scrollY}/${open.scrollY}/${closed.scrollY}`);
  }, { mobile: true });
}

// ── Run ───────────────────────────────────────────────────────────────────
(async () => {
  console.log(`runtime gate — artifact: ${path.relative(process.cwd(), ARTIFACT)}\n`);
  const suite = [
    testMount,
    testDestroySilence,
    testFailedInitRecovers,
    testBodyStall,
    testProductUrlNeutralised,
    testAgentPopupKeyboard,
    testTeardownCensus,
    testMobileHostIsolation,
    testReinjectedRuntime,
    testInjectedOnlyResolvesFromPageTag,
  ];
  for (const t of suite) {
    try {
      await t();
    } catch (err) {
      record(t.name, false, `threw: ${err.message.split('\n')[0]}`);
    }
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
