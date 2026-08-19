#!/usr/bin/env node
/**
 * Live CORS matrix — run against PRODUCTION right after CORS_MODE=enforce,
 * and again before the submission. Read-only: GET + OPTIONS on the public
 * config endpoint and a preflight on the chat endpoint, never a chat message.
 *
 * Input: the backfill report (ultimo-bots-backend/_reports/webflow-bindings-*.json)
 * whose `bindings` array carries {bot_id, site_id, domains}. Optionally a
 * control bot id that is NOT Webflow-bound (a Wix/WordPress bot) to prove
 * those are unchanged.
 *
 *   node tests/live-cors-matrix.js <report.json> [--control <bot_id>] [--api https://portal.ultimo-bots.com]
 *
 * For every bound bot:
 *   GET  config  Origin=<bound domain>      -> 200, ACAO == that origin, no Allow-Credentials
 *   GET  config  Origin=https://evil.example.com -> 403, no ACAO
 *   OPTIONS config preflight from evil      -> no ACAO
 *   OPTIONS chatbot_response?bot_id= from evil -> no ACAO
 *   OPTIONS chatbot_response?bot_id= from bound -> ACAO == bound origin
 * Control bot (unbound): GET from evil -> 200, ACAO == https://evil.example.com, no credentials.
 * Own origins: GET config (any bot) from https://portal.ultimo-bots.com -> ACAO reflected.
 */
'use strict';
const fs = require('node:fs');

const args = process.argv.slice(2);
const reportPath = args.find((a) => !a.startsWith('--'));
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const API = (opt('--api', 'https://portal.ultimo-bots.com')).replace(/\/$/, '');
const CONTROL = opt('--control', null);
const EVIL = 'https://evil.example.com';
const PORTAL = 'https://portal.ultimo-bots.com';

if (!reportPath || !fs.existsSync(reportPath)) {
  console.error('usage: node tests/live-cors-matrix.js <backfill-report.json> [--control <unbound bot id>]');
  process.exit(2);
}
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const bindings = report.bindings || [];
const results = [];
const record = (name, ok, detail) => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n        ${detail}` : ''}`); };

const h = (res, name) => res.headers.get(name);
async function get(url, origin) {
  const res = await fetch(url, { method: 'GET', headers: origin ? { Origin: origin } : {}, redirect: 'manual' });
  return { status: res.status, acao: h(res, 'access-control-allow-origin'), cred: h(res, 'access-control-allow-credentials'), vary: h(res, 'vary') };
}
async function preflight(url, origin) {
  const res = await fetch(url, {
    method: 'OPTIONS',
    headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
  });
  return { status: res.status, acao: h(res, 'access-control-allow-origin'), cred: h(res, 'access-control-allow-credentials') };
}
const originOf = (domain) => `https://${String(domain).replace(/^https?:\/\//, '').replace(/\/.*$/, '')}`;

(async () => {
  console.log(`live CORS matrix — ${API} — ${bindings.length} bound bot(s)\n`);
  for (const b of bindings) {
    const bot = b.bot_id;
    const cfg = `${API}/api/widget_configuration/${encodeURIComponent(bot)}`;
    const chat = `${API}/api/chatbot_response?bot_id=${encodeURIComponent(bot)}`;
    const domains = (b.domains || []).map(originOf);
    if (domains.length === 0) { record(`${bot}: has domains`, false, 'binding carries no domains'); continue; }

    for (const origin of domains) {
      const r = await get(cfg, origin);
      record(`${bot}: config from bound ${origin}`,
        r.status === 200 && r.acao === origin && !r.cred,
        `status=${r.status} acao=${r.acao} cred=${r.cred}`);
    }
    const evil = await get(cfg, EVIL);
    record(`${bot}: config from foreign origin denied without CORS headers`,
      evil.status === 403 && !evil.acao, `status=${evil.status} acao=${evil.acao}`);
    const pfEvil = await preflight(cfg, EVIL);
    record(`${bot}: config preflight from foreign origin carries no ACAO`,
      !pfEvil.acao, `status=${pfEvil.status} acao=${pfEvil.acao}`);
    const pfChatEvil = await preflight(chat, EVIL);
    record(`${bot}: chat preflight (?bot_id=) from foreign origin carries no ACAO`,
      !pfChatEvil.acao, `status=${pfChatEvil.status} acao=${pfChatEvil.acao}`);
    const pfChatOk = await preflight(chat, domains[0]);
    record(`${bot}: chat preflight (?bot_id=) from bound origin reflected, no credentials`,
      pfChatOk.acao === domains[0] && !pfChatOk.cred, `status=${pfChatOk.status} acao=${pfChatOk.acao} cred=${pfChatOk.cred}`);
    const own = await get(cfg, PORTAL);
    record(`${bot}: config from portal origin allowed`,
      own.status === 200 && own.acao === PORTAL, `status=${own.status} acao=${own.acao}`);
  }

  if (CONTROL) {
    const cfg = `${API}/api/widget_configuration/${encodeURIComponent(CONTROL)}`;
    const r = await get(cfg, EVIL);
    record(`control ${CONTROL} (unbound): any origin reflected, no credentials, no wildcard`,
      r.status === 200 && r.acao === EVIL && !r.cred,
      `status=${r.status} acao=${r.acao} cred=${r.cred}`);
    const pf = await preflight(`${API}/api/chatbot_response`, EVIL);
    record(`control: chat preflight without bot id reflected, no credentials`,
      pf.acao === EVIL && !pf.cred, `acao=${pf.acao} cred=${pf.cred}`);
  }

  // Never a wildcard anywhere on the public routes.
  const anyCfg = `${API}/api/widget_configuration/__matrix_probe__`;
  const w = await get(anyCfg, EVIL);
  record('no wildcard: unknown bot from foreign origin reflects origin, never "*", no credentials',
    w.acao !== '*' && !w.cred, `status=${w.status} acao=${w.acao} cred=${w.cred}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
