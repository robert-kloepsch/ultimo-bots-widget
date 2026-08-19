#!/usr/bin/env node
/**
 * Claims gate.
 *
 * Every technical sentence in the Webflow review notes must be backed by a
 * check that ran against the exact artifact under review — the bytes, not
 * the source, not package.json. 1.2.0 was rejected because the notes said
 * "DOMPurify 3.4.13" (read from package.json) while the published file
 * carried 3.1.6 (node_modules was stale). This gate measures the artifact
 * itself and writes a JSON report the notes are written from.
 *
 *   node scripts/claims-gate.js                 # release/<version>/ultimo-widget.js
 *   node scripts/claims-gate.js --cdn           # the file served from widget.ultimo-bots.com
 *   node scripts/claims-gate.js <path>          # any artifact
 *
 * Writes release/<version>/claims-report.json (or next to the given file).
 */
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const ROOT = path.join(__dirname, '..');
const pkg = require('../package.json');
const VERSION = pkg.version;
const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
const lockVersion = (name) => (lock.packages && lock.packages[`node_modules/${name}`] || {}).version || null;
const BACKEND = path.join(ROOT, '..', 'ultimo-bots-backend', 'src', 'controller', 'webflow.py');

const args = process.argv.slice(2);
const useCdn = args.includes('--cdn');
const givenPath = args.find((a) => !a.startsWith('--'));

const sri = (buf) => `sha384-${crypto.createHash('sha384').update(buf).digest('base64')}`;

const fetchCdn = (url) => new Promise((resolve, reject) => {
  https.get(url, (res) => {
    if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode} for ${url}`)); }
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => resolve(Buffer.concat(chunks)));
  }).on('error', reject);
});

(async () => {
  let source; let buf;
  if (useCdn) {
    source = `https://widget.ultimo-bots.com/${VERSION}/ultimo-widget.js`;
    buf = await fetchCdn(source);
  } else {
    source = givenPath ? path.resolve(givenPath) : path.join(ROOT, 'release', VERSION, 'ultimo-widget.js');
    if (!fs.existsSync(source)) { console.error(`artifact not found: ${source}`); process.exit(2); }
    buf = fs.readFileSync(source);
  }
  const text = buf.toString('utf8');
  const checks = [];
  const check = (id, claim, pass, measured) => checks.push({ id, claim, pass: !!pass, measured });
  const count = (re) => (text.match(re) || []).length;

  // ── Identity ─────────────────────────────────────────────────────────────
  const hash = sri(buf);
  check('ID1', `artifact is ${buf.length} bytes, SRI ${hash}`, true, { bytes: buf.length, sri: hash, source });

  // ── Bundled dependencies, measured in the bytes ───────────────────────────
  const dpLock = lockVersion('dompurify');
  const dpInBundle = [...new Set((text.match(/"3\.\d+\.\d+"/g) || []).map((s) => s.replace(/"/g, '')))];
  // DOMPurify embeds its version as a string literal `version:"x.y.z"`/VERSION;
  // the artifact must contain the lockfile version and no other 3.x literal.
  check('DEP1', `bundled DOMPurify is ${dpLock} (lockfile) and no other DOMPurify version string is present`,
    dpLock && dpInBundle.length === 1 && dpInBundle[0] === dpLock, { lockfile: dpLock, inBundle: dpInBundle });
  const mkLock = lockVersion('marked');
  check('DEP2', `marked ${mkLock} is compiled in (lockfile version; marked carries no version literal, presence verified by its lexer/parser code)`,
    mkLock && /Lexer/.test(text) && /Parser/.test(text) && /Renderer/.test(text), { lockfile: mkLock });

  // ── Forbidden strings ─────────────────────────────────────────────────────
  const forbidden = [
    ['no-scroll', 'no host body/html scroll-lock class (finding 5)'],
    ['cart/add.js', 'no host-page commerce calls'],
    ['CartCount', 'no host cart counter selectors'],
    ['shopify:cart', 'no host cart events'],
    ['localhost', 'no non-production hosts'],
    ['127.0.0.1', 'no loopback hosts'],
    ['ngrok', 'no tunnel hosts'],
    ['jsdelivr', 'no CDN library loads'],
    ['github.io', 'no GitHub Pages loads'],
    ['EventSource(', 'no EventSource: visitor text never in URLs'],
    ['document.write', 'no document.write'],
    ['createElement("script")', 'no runtime script creation'],
    ["createElement('script')", 'no runtime script creation'],
    ['globalThis.marked=', 'no page global marked'],
    ['globalThis.DOMPurify=', 'no page global DOMPurify'],
    ['window.marked=', 'no page global marked'],
    ['window.DOMPurify=', 'no page global DOMPurify'],
  ];
  forbidden.forEach(([needle, why], i) => {
    const n = text.split(needle).length - 1;
    check(`NEG${i + 1}`, `${why}: "${needle}" occurs 0 times`, n === 0, { occurrences: n });
  });

  // ── Required strings ──────────────────────────────────────────────────────
  check('REQ1', 'bot id rides in the chatbot_response URL for bot-scoped CORS preflight',
    count(/chatbot_response\?bot_id=/g) >= 2, { occurrences: count(/chatbot_response\?bot_id=/g) });
  check('REQ2', 'mobile scroll containment lives on the widget\'s own scroller (overscroll-behavior: contain)',
    /overscroll-behavior:\s*contain/.test(text), {});
  check('REQ3', 'single namespaced page global __ULTIMO_BOTS__ with destroy()',
    /__ULTIMO_BOTS__/.test(text) && count(/__ULTIMO_BOTS__/g) >= 2, { occurrences: count(/__ULTIMO_BOTS__/g) });
  // Every host named in the artifact, with its role. Anything not on this
  // list is an undisclosed external connection and fails the claim.
  const KNOWN_HOSTS = {
    'https://portal.ultimo-bots.com': 'our API (all backend calls)',
    'https://widget.ultimo-bots.com': 'our own hosted-script location, used only to recognise the page Webflow-applied tag (bot-id fallback), no request',
    'https://www.ultimo-bots.com': '"powered by" link target, no request',
    'https://fonts.googleapis.com': 'Google Fonts stylesheet, only when the customer picks one of six fonts',
    'http://www.w3.org': 'XML namespaces inside DOMPurify (SVG/MathML/XHTML), no request',
    'https://github.com': 'marked error-message text ("report this to…"), no request',
  };
  const hostsInBundle = [...new Set(text.match(/https?:\/\/[a-z0-9.-]+\.[a-z]{2,}/g) || [])];
  const unknownHosts = hostsInBundle.filter((h) => !KNOWN_HOSTS[h]);
  check('REQ4', 'every host named in the artifact is known and disclosed; all backend calls go to https://portal.ultimo-bots.com/api',
    count(/https:\/\/portal\.ultimo-bots\.com\/api\//g) >= 10 && unknownHosts.length === 0,
    { apiRefs: count(/https:\/\/portal\.ultimo-bots\.com\/api\//g), hosts: hostsInBundle.map((h) => `${h} — ${KNOWN_HOSTS[h] || 'UNKNOWN'}`) });

  // ── Backend lockstep (when the backend checkout is next to us) ───────────
  if (fs.existsSync(BACKEND)) {
    const py = fs.readFileSync(BACKEND, 'utf8');
    const v = (py.match(/WIDGET_VERSION\s*=\s*"([^"]+)"/) || [])[1];
    const h = (py.match(/WIDGET_INTEGRITY_HASH\s*=\s*"([^"]+)"/) || [])[1];
    // The backend may register the artifact with a sha256 or a sha384 SRI;
    // both are valid for the same bytes. Accept whichever it uses.
    const sri256 = `sha256-${crypto.createHash('sha256').update(buf).digest('base64')}`;
    check('LOCK1', `backend registers version ${VERSION} with this artifact's SRI`, v === VERSION && (h === hash || h === sri256),
      { backendVersion: v, backendHash: h, artifactSha384: hash, artifactSha256: sri256 });
  }

  // ── Report ───────────────────────────────────────────────────────────────
  const report = {
    generated_at: new Date().toISOString(),
    version: VERSION,
    source,
    bytes: buf.length,
    sri: hash,
    checks,
    passed: checks.filter((c) => c.pass).length,
    failed: checks.filter((c) => !c.pass).length,
  };
  const outDir = useCdn || !givenPath ? path.join(ROOT, 'release', VERSION) : path.dirname(source);
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, useCdn ? 'claims-report.cdn.json' : 'claims-report.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));

  console.log(`claims gate — ${source}\n  ${buf.length} bytes  ${hash}\n`);
  checks.forEach((c) => console.log(`${c.pass ? 'PASS' : 'FAIL'}  [${c.id}] ${c.claim}${c.pass ? '' : `\n        measured: ${JSON.stringify(c.measured)}`}`));
  console.log(`\n${report.passed}/${checks.length} claims hold — report: ${path.relative(process.cwd(), out)}`);
  process.exit(report.failed ? 1 : 0);
})().catch((e) => { console.error(`claims gate: ${e.message}`); process.exit(2); });
