#!/usr/bin/env node
/**
 * Provenance gate.
 *
 * The 1.1.0 release was built from a branch whose source never reached the
 * repository, and 1.2.0 nearly repeated it: a fix lived in the published
 * artifact while the working tree change was still uncommitted. Both are
 * invisible until someone rebuilds and silently ships older code.
 *
 * This checks the whole chain in one go:
 *
 *   committed source  ->  local build  ->  file on the CDN  ->  backend SRI
 *
 * Any link that does not match is a hard failure.
 *
 *   node scripts/provenance-gate.js
 */
'use strict';

const { execSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const ROOT = path.join(__dirname, '..');
const pkg = require('../package.json');
const VERSION = pkg.version;
const ARTIFACT = path.join(ROOT, 'release', VERSION, 'ultimo-widget.js');
const BACKEND = path.join(ROOT, '..', 'ultimo-bots-backend', 'src', 'controller', 'webflow.py');

const sri = (buf) => `sha384-${crypto.createHash('sha384').update(buf).digest('base64')}`;
const sri256 = (buf) => `sha256-${crypto.createHash('sha256').update(buf).digest('base64')}`;
const problems = [];
const ok = [];

// 1. The working tree must equal the commit — otherwise the thing you just
//    built is not the thing anyone else can reproduce.
const dirty = execSync('git status --porcelain -- src package.json webpack.release.js', {
  cwd: ROOT, encoding: 'utf8',
}).trim();
if (dirty) {
  problems.push(`uncommitted changes that affect the build:\n      ${dirty.split('\n').join('\n      ')}`);
} else {
  ok.push('working tree matches the commit');
}

// 2. The built artifact must exist for the declared version.
if (!fs.existsSync(ARTIFACT)) {
  problems.push(`no artifact at release/${VERSION}/ — run: npm run build:release`);
}
const local = fs.existsSync(ARTIFACT) ? fs.readFileSync(ARTIFACT) : null;
const localSri = local ? sri(local) : null;
if (local) ok.push(`local build ${VERSION} — ${local.length} bytes — ${localSri}`);

// 3. The backend must register exactly this version and hash.
if (fs.existsSync(BACKEND)) {
  const py = fs.readFileSync(BACKEND, 'utf8');
  const v = (py.match(/WIDGET_VERSION\s*=\s*"([^"]+)"/) || [])[1];
  const h = (py.match(/WIDGET_INTEGRITY_HASH\s*=\s*"([^"]+)"/) || [])[1];
  if (v !== VERSION) problems.push(`backend WIDGET_VERSION is ${v}, package.json says ${VERSION}`);
  else if (localSri && h !== localSri && h !== sri256(local)) problems.push(`backend WIDGET_INTEGRITY_HASH does not match the local build\n      backend ${h}\n      build   ${localSri}`);
  else ok.push('backend version and hash match the build');
} else {
  problems.push(`backend not found at ${BACKEND} — cannot verify the registered hash`);
}

// 4. The published file must be byte-identical to the local build.
const fetchCdn = () => new Promise((resolve) => {
  https.get(`https://widget.ultimo-bots.com/${VERSION}/ultimo-widget.js`, (res) => {
    if (res.statusCode !== 200) { res.resume(); return resolve({ error: `HTTP ${res.statusCode}` }); }
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => resolve({ body: Buffer.concat(chunks) }));
  }).on('error', (e) => resolve({ error: e.message }));
});

(async () => {
  const cdn = await fetchCdn();
  if (cdn.error) {
    problems.push(`CDN file for ${VERSION} not reachable: ${cdn.error}`);
  } else if (local && !cdn.body.equals(local)) {
    problems.push(`CDN file differs from the local build\n      cdn   ${cdn.body.length} bytes ${sri(cdn.body)}\n      build ${local.length} bytes ${localSri}`);
  } else if (local) {
    ok.push(`CDN file is byte-identical (${cdn.body.length} bytes)`);
  }

  if (problems.length === 0) {
    console.log('provenance gate: PASS');
    ok.forEach((l) => console.log(`  ${l}`));
    process.exit(0);
  }
  console.error(`provenance gate: FAIL — ${problems.length} problem(s)\n`);
  problems.forEach((p) => console.error(`  - ${p}`));
  if (ok.length) {
    console.error('\n  verified:');
    ok.forEach((l) => console.error(`    ${l}`));
  }
  process.exit(1);
})();
