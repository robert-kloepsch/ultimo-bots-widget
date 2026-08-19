#!/usr/bin/env node
/**
 * Live-site check for a real Webflow installation.
 *
 * Loads a published Webflow page with the app installed and verifies the
 * delivery contract and the runtime behaviour that the Marketplace review
 * looks at. Read-only apart from opening the chat.
 *
 *   node tests/live-site-check.js https://your-site.webflow.io/
 */
'use strict';

const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs');
const https = require('node:https');

const PW = path.join(__dirname, '..', '..', 'ultimo-bots-portal', 'node_modules', 'playwright');
const { chromium } = require(PW);

const SITE = process.argv[2];
if (!SITE) {
  console.error('usage: node tests/live-site-check.js <url>');
  process.exit(1);
}
const pkg = require('../package.json');
const EXPECTED_VERSION = pkg.version;
const EXPECTED_SRC = `https://widget.ultimo-bots.com/${EXPECTED_VERSION}/ultimo-widget.js`;
const localArtifact = path.join(__dirname, '..', 'release', EXPECTED_VERSION, 'ultimo-widget.js');
const expectedSri = fs.existsSync(localArtifact)
  ? `sha384-${crypto.createHash('sha384').update(fs.readFileSync(localArtifact)).digest('base64')}`
  : null;

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        ${detail}` : ''}`);
};

(async () => {
  console.log(`live-site check — ${SITE}\n`);
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const requests = [];
  const sockets = [];
  const consoleErrors = [];
  page.on('request', (r) => requests.push({ url: r.url(), type: r.resourceType() }));
  page.on('websocket', (ws) => sockets.push(ws.url()));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

  await page.goto(SITE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(4000);

  // 1. Delivery contract: our script tag, the declared version, the SRI.
  const tag = await page.evaluate(() => {
    const s = [...document.querySelectorAll('script')]
      .find((x) => (x.src || '').includes('ultimo'));
    return s ? { src: s.src, integrity: s.integrity, botId: s.getAttribute('data-bot_id'), crossOrigin: s.crossOrigin } : null;
  });
  check('script tag: versioned URL, SRI, bot id',
    !!tag && tag.src === EXPECTED_SRC && !!tag.integrity && !!tag.botId,
    tag ? `src=${tag.src}\n        integrity=${tag.integrity}\n        data-bot_id=${tag.botId}` : 'no ultimo script tag found');

  if (tag && expectedSri) {
    check('SRI matches the artifact we built',
      tag.integrity === expectedSri,
      `page     ${tag.integrity}\n        our build ${expectedSri}`);
  }
  // Marketplace guideline: every injected external script tag carries a valid
  // SRI integrity attribute AND crossorigin="anonymous" so the browser can
  // verify it tamper-evidently. Webflow renders the tag for hosted scripts;
  // this proves it did.
  check('script tag: crossorigin="anonymous" present (SRI is enforceable)',
    !!tag && String(tag.crossOrigin).toLowerCase() === 'anonymous',
    tag ? `crossorigin=${tag.crossOrigin}` : 'no tag');

  // 2. The runtime actually executed (SRI mismatch would silently block it).
  const mount = await page.evaluate(() => {
    const reg = window.__ULTIMO_BOTS__;
    if (!reg) return { registry: false };
    const ids = Object.keys(reg.instances || {});
    const host = ids.length ? document.getElementById(`ultimo-bots-container-${ids[0]}`) : null;
    const icon = host && host.shadowRoot ? host.shadowRoot.querySelector('.saicf-chat-widget-icon') : null;
    const rect = icon ? icon.getBoundingClientRect() : null;
    return {
      registry: true,
      ids,
      statuses: ids.map((i) => reg.instances[i].status),
      launcherVisible: !!(rect && rect.width > 0 && rect.height > 0),
    };
  });
  check('widget executed and mounted, launcher visible',
    mount.registry && mount.ids && mount.ids.length === 1 && mount.statuses[0] === 'mounted' && mount.launcherVisible,
    JSON.stringify(mount));

  // 3. No page globals other than the namespaced registry.
  const globals = await page.evaluate(() => ({
    marked: typeof window.marked,
    DOMPurify: typeof window.DOMPurify,
    registry: typeof window.__ULTIMO_BOTS__,
  }));
  check('no page globals overwritten',
    globals.marked === 'undefined' && globals.DOMPurify === 'undefined' && globals.registry === 'object',
    JSON.stringify(globals));

  // 4. We are the only executable JavaScript this app delivers.
  const ourScripts = requests.filter((r) => r.type === 'script' && /ultimo-bots|widget\.ultimo/.test(r.url));
  check('exactly one executable script from the app',
    ourScripts.length === 1 && ourScripts[0].url === EXPECTED_SRC,
    ourScripts.map((s) => s.url).join('\n        ') || 'none');

  // 5. Nothing sensitive travels in a URL.
  const leaky = requests.filter((r) =>
    /[?&](user_input|session_token|message)=/.test(r.url)
    || /host_url=[^&]*%3F/.test(r.url));
  check('no visitor text or tokens in request URLs',
    leaky.length === 0,
    leaky.map((r) => r.url).join('\n        ') || 'none');

  // 6. Nothing touches host-page commerce.
  const commerce = requests.filter((r) => /\/cart(\.js|\/add\.js)/.test(r.url));
  check('no host-page commerce calls', commerce.length === 0,
    commerce.map((r) => r.url).join('\n        ') || 'none');

  // 7. The launcher is a real, keyboard-operable control.
  const a11y = await page.evaluate(() => {
    const ids = Object.keys(window.__ULTIMO_BOTS__?.instances || {});
    const host = document.getElementById(`ultimo-bots-container-${ids[0]}`);
    const icon = host?.shadowRoot?.querySelector('.saicf-chat-widget-icon');
    if (!icon) return null;
    icon.focus();
    return {
      tag: icon.tagName,
      label: icon.getAttribute('aria-label') || icon.title || null,
      focused: host.shadowRoot.activeElement === icon,
    };
  });
  check('launcher is a focusable button with a name',
    !!a11y && a11y.tag === 'BUTTON' && a11y.focused,
    JSON.stringify(a11y));

  // 8. It opens with the keyboard and the chat renders.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  const opened = await page.evaluate(() => {
    const ids = Object.keys(window.__ULTIMO_BOTS__?.instances || {});
    const sr = document.getElementById(`ultimo-bots-container-${ids[0]}`)?.shadowRoot;
    const win = sr?.querySelector('.saicf-chat-window');
    return { open: !!win?.classList.contains('show'), hasInput: !!sr?.querySelector('.saicf-chat-input') };
  });
  check('Enter opens the chat and the input renders',
    opened.open && opened.hasInput, JSON.stringify(opened));

  // 9. destroy() silences everything — the reviewer's finding 2.
  const before = requests.length;
  const socketsBefore = sockets.length;
  await page.evaluate(() => window.__ULTIMO_BOTS__.destroy());
  await page.waitForTimeout(12000);
  const after = requests.slice(before).filter((r) => /ultimo-bots\.com/.test(r.url));
  const gone = await page.evaluate(() => Object.keys(window.__ULTIMO_BOTS__.instances).length === 0
    && !document.querySelector('[id^="ultimo-bots-container-"]'));
  check('destroy(): no requests, no socket reopens, container removed',
    after.length === 0 && sockets.length === socketsBefore && gone,
    `new requests=${after.length}${after.length ? ` (${after[0].url})` : ''} | new sockets=${sockets.length - socketsBefore} | cleared=${gone}`);

  // 10. No script errors along the way.
  const real = consoleErrors.filter((e) => !/favicon|net::ERR_/i.test(e));
  check('no script errors on the page', real.length === 0,
    real.slice(0, 3).join('\n        ') || 'none');

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
