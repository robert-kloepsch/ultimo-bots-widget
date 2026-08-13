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

async function withPage(fn, { stallConfig = false, failConfig = false } = {}) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

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
    res.end(`<!doctype html><html><head><title>widget host</title></head><body>
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
    record('mount: one namespaced instance, launcher rendered',
      ids.length === 1 && ids[0] === BOT && launcher,
      `instances=${JSON.stringify(ids)} launcher=${launcher}`);
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
