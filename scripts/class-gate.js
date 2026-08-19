#!/usr/bin/env node
/**
 * Class gate for the widget runtime.
 *
 * Five consecutive Webflow rejections all had the same shape: the fix was
 * correct but incomplete. header_text was escaped, request_button_text was
 * missed. Asset URLs were validated, streamed product URLs were missed.
 * destroy() was built, the reconnect timer was missed. This gate turns each
 * of those classes into a rule that fails the build on the next instance,
 * so completeness stops depending on anyone remembering.
 *
 * Run: node scripts/class-gate.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

// Defaults to the working source; a path argument lets the gate be pointed at
// an older revision to confirm it actually catches what it claims to catch.
const FILE = process.argv[2] || path.join(__dirname, '..', 'src', 'index.js');
const lines = fs.readFileSync(FILE, 'utf8').split('\n');
const violations = [];

const fail = (cls, line, text, why) =>
  violations.push({ cls, line, text: text.trim().slice(0, 110), why });

// Identifiers whose value is a compile-time constant in this file.
const CONSTANT_RHS = /^(PC_ICON_[A-Z_]+|ICON_[A-Z_]+)$/;

// Fire-and-forget calls that deliberately outlive the caller, plus the paths
// that carry their own AbortController. Each is listed with the marker that
// identifies it, so a new bare fetch never silently inherits the exemption.
// 1.3.0: the three "nothing awaits it" exemptions (disconnect beacon, ack,
// live-mode forward) are gone — the reviewer counted exactly those three as
// requests without a deadline. Only calls that carry their own AbortController
// remain exempt.
const ALLOWED_BARE_FETCH = [
  { marker: 'signal: aborter.signal', why: 'the AI stream carries its own watchdogs' },
  { marker: "'/cart.js'", why: 'commerce path, compiled out of the hosted build' },
  { marker: "'/cart/add.js'", why: 'commerce path, compiled out of the hosted build' },
  { marker: 'signal: ctrl.signal', why: 'fetchWithTimeout itself' },
];

lines.forEach((raw, idx) => {
  const n = idx + 1;
  const line = raw.trim();
  if (line.startsWith('*') || line.startsWith('//')) return;

  if (/insertAdjacentHTML\(/.test(line)) {
    fail('A', n, raw, 'insertAdjacentHTML is banned — build nodes instead');
  }

  // ── Class E: no visitor-facing request without a deadline ───────────────
  if (/(?<!\w)fetch\(/.test(line) && !/fetchWithTimeout/.test(line)) {
    // Look at the whole call, not just the opening line: the deadline may sit
    // on a later line as an AbortController signal.
    const ctx = lines.slice(idx, idx + 12).join('\n');
    const exempt = ALLOWED_BARE_FETCH.some((a) => ctx.includes(a.marker));
    if (!exempt) {
      fail('E', n, raw, 'fetch without a deadline — use fetchWithTimeout or an AbortController');
    }
  }
});

const src = lines.join('\n');
const lineOf = (offset) => src.slice(0, offset).split('\n').length;

// Reads the assigned expression starting at `from`, respecting strings and
// template literals, so a multi-line template counts as one expression.
function readExpression(from) {
  let i = from;
  let depth = 0;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    const prev = src[i - 1];
    if (quote) {
      if (c === quote && prev !== '\\') quote = null;
    } else if (c === "'" || c === '"' || c === '`') {
      quote = c;
    } else if ('([{'.includes(c)) {
      depth++;
    } else if (')]}'.includes(c)) {
      depth--;
    } else if (c === ';' && depth === 0) {
      break;
    }
    i++;
  }
  return src.slice(from, i);
}

const SANITISED = /escapeHtml\(|escapeHtmlStatic\(|sanitizedMarkdown\(|DOMPurify\.sanitize\(/;
const GUARD_CALL = /^(escapeHtml|escapeHtmlStatic|sanitizedMarkdown|safeAssetUrl|safeCssColor|safeHttpUrl|safeNumber)\(|^DOMPurify\.sanitize\(/;
const CONST_NAME = /^[A-Z][A-Z0-9_]*$/;

// `const NAME = <expression>` declarations, so an interpolated identifier can
// be resolved instead of needing a hand-maintained exemption list. A name is
// declared more than once in this file (`href` is both a font URL and a
// product URL), so every declaration is kept with its offset and the lookup
// takes the nearest one ABOVE the use site. Taking the first would have let
// the rejected `card.href = href` pass by borrowing an unrelated guard.
const declarations = new Map();
for (const m of src.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*/g)) {
  if (!declarations.has(m[1])) declarations.set(m[1], []);
  declarations.get(m[1]).push({ at: m.index, expr: readExpression(m.index + m[0].length).trim() });
}
function declarationFor(name, useOffset) {
  const all = declarations.get(name);
  if (!all) return null;
  const above = all.filter((d) => d.at < useOffset);
  if (above.length === 0) return null;
  return above[above.length - 1].expr;
}

// An expression is guarded when it is a literal, a constant, the result of one
// of the guard helpers, or a template whose every interpolation is itself
// guarded. Resolution is depth-limited so a cycle cannot hang the gate.
function isGuarded(expr, at, depth = 0) {
  if (depth > 4) return false;
  const e = expr.trim().replace(/^\((.*)\)$/s, '$1').trim();
  if (!e) return false;
  if (GUARD_CALL.test(e) || SANITISED.test(e)) return true;
  if (/^['"]/.test(e)) return true;
  if (CONST_NAME.test(e)) return true;
  if (e.startsWith('`')) {
    return [...e.matchAll(/\$\{([^}]*)\}/g)]
      .map((x) => x[1].trim())
      .every((inner) => isGuarded(inner, at, depth + 1));
  }
  if (/^[A-Za-z_$][\w$]*$/.test(e)) {
    const decl = declarationFor(e, at);
    return decl ? isGuarded(decl, at, depth + 1) : false;
  }
  // Ternaries and concatenations are guarded only if every branch is.
  if (/[?:+]/.test(e)) {
    const parts = e.split(/\?|:|\+/).map((x) => x.trim()).filter(Boolean);
    if (parts.length > 1) return parts.every((p) => isGuarded(p, at, depth + 1));
  }
  return false;
}

// ── Class A: externally controlled text must never become markup ──────────
for (const m of src.matchAll(/\.(innerHTML|outerHTML)\s*=\s*/g)) {
  const start = m.index + m[0].length;
  const expr = readExpression(start);
  const n = lineOf(m.index);
  // A value captured out of the DOM and put straight back is not new input.
  if (/^(original|previous|prev)$/.test(expr.trim())) continue;
  if (!isGuarded(expr, m.index)) {
    const interpolations = [...expr.matchAll(/\$\{([^}]*)\}/g)].map((x) => x[1].trim());
    const culprit = interpolations.find((x) => !isGuarded(x, m.index)) || expr.trim().slice(0, 70);
    fail('A', n, `innerHTML <- ${culprit}`,
      'value reaches markup without escaping, sanitising or a guard helper');
  }
}

// ── Class B: externally controlled URLs must never navigate or load ───────
// The name of the variable proves nothing — `const href = product.url` is
// exactly the shape that shipped and got rejected. Resolve the declaration.
const URL_GUARD = /^(safeHttpUrl|safeAssetUrl)\(/;
function isGuardedUrl(expr, at, depth = 0) {
  if (depth > 4) return false;
  const e = expr.trim().replace(/^\((.*)\)$/s, '$1').trim();
  if (!e) return false;
  if (URL_GUARD.test(e)) return true;
  if (/window\.location\.origin/.test(e)) return true;
  // Origins and paths written literally in this file.
  if (/^['"`](https?:)?\/\//.test(e) || /^`\$\{window\.location\.origin\}/.test(e)) return true;
  // Lookup in the hard-coded font table.
  if (/FONT_SOURCES/.test(e)) return true;
  if (/^[A-Za-z_$][\w$]*$/.test(e)) {
    const decl = declarationFor(e, at);
    return decl ? isGuardedUrl(decl, at, depth + 1) : false;
  }
  return false;
}
// The preconnect list is a literal array of origins iterated with `h`.
const LITERAL_ORIGIN_ITERATORS = new Set(['h']);
for (const m of src.matchAll(/\.(href|src)\s*=\s*/g)) {
  const start = m.index + m[0].length;
  const expr = readExpression(start).trim();
  const n = lineOf(m.index);
  if (LITERAL_ORIGIN_ITERATORS.has(expr)) continue;
  if (!isGuardedUrl(expr, m.index)) {
    fail('B', n, `${m[1]} <- ${expr.slice(0, 70)}`,
      'URL assigned without passing through safeHttpUrl/safeAssetUrl');
  }
}

// ── Class C: teardown must be checked on every long-lived entry point ─────
const MUST_GUARD = ['connectLiveWs', 'scheduleWsReconnect', 'sendHeartbeat', 'pollAgentMessages'];
MUST_GUARD.forEach((fn) => {
  const m = src.match(new RegExp(`(async )?function ${fn}\\([^)]*\\)\\s*\\{([\\s\\S]{0,400})`));
  if (!m) {
    violations.push({ cls: 'C', line: 0, text: fn, why: 'function not found — gate is stale' });
  } else if (!/if \(destroyed\) return;/.test(m[2].split('\n').slice(0, 6).join('\n'))) {
    violations.push({ cls: 'C', line: 0, text: fn, why: 'missing `if (destroyed) return;` in the first lines' });
  }
});
['wsReconnectTimer', 'visitorTypingTimer', 'agentTypingTimer', 'heartbeatInterval', 'agentPollInterval'].forEach((t) => {
  if (!new RegExp(`registerCleanup\\(\\(\\) => \\{[\\s\\S]{0,200}${t}`).test(src)) {
    violations.push({ cls: 'C', line: 0, text: t, why: 'timer is never cleared in a registerCleanup block' });
  }
});
if (!/destroy\(\) \{\s*\n\s*if \(destroyed\) return;/.test(src)) {
  violations.push({ cls: 'C', line: 0, text: 'destroy()', why: 'teardown is not idempotent' });
}
if (!/if \(pending && pending\.status === 'mounting'\)/.test(src)) {
  violations.push({ cls: 'C', line: 0, text: 'mount registry', why: 'a failed initialization is not rolled back' });
}
// Timer census: inside the instance every setTimeout/setInterval must be the
// owned variant (tracked, guarded, cleared on destroy). The only native timers
// allowed are request-abort timers, identified by `.abort()` on the same line.
{
  const instanceStart = src.indexOf('const ownGlobalListener');
  if (instanceStart < 0) {
    violations.push({ cls: 'C', line: 0, text: 'ownGlobalListener', why: 'owned timer/listener helpers missing — gate is stale' });
  } else {
    let off = 0;
    lines.forEach((raw, idx) => {
      const lineStart = off;
      off += raw.length + 1;
      if (lineStart < instanceStart) return;
      const line = raw.trim();
      if (line.startsWith('//') || line.startsWith('*')) return;
      if (/(?<![\w.])set(Timeout|Interval)\(/.test(line) && !/\.abort\(\)/.test(line)) {
        fail('C', idx + 1, raw, 'native timer inside the instance — use ownSetTimeout/ownSetInterval so destroy() clears it');
      }
      if (/(?<![\w.])(window|document|visualVP|visualViewport|navigator|screen)\.addEventListener\(/.test(line)) {
        fail('C', idx + 1, raw, 'listener on a host-lifetime object — register it through ownGlobalListener so destroy() removes it');
      }
      if (/new (ResizeObserver|MutationObserver|IntersectionObserver)\(/.test(line)) {
        const name = (raw.match(/(?:const|let)\s+(\w+)\s*=\s*new/) || [])[1];
        if (name && !src.includes(`registerCleanup(() => ${name}.disconnect())`)) {
          fail('C', idx + 1, raw, `observer "${name}" is never disconnected in a registerCleanup block`);
        }
      }
    });
  }
}

// ── Class F: the host page is never modified ──────────────────────────────
// Webflow: an injected script "must not modify, restyle, reorder, or remove
// existing page content or layout" and lives inside its own container. The
// host's body/html must never be classed, styled or observed for forms, and
// nothing of ours goes into document.head except removable <link> hints.
lines.forEach((raw, idx) => {
  const line = raw.trim();
  if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) return;
  if (/document\.(body|documentElement)\.(classList|style|setAttribute|removeAttribute)/.test(line)) {
    fail('F', idx + 1, raw, 'host body/html must not be classed or styled');
  }
  if (/document\.head\.appendChild\((?!l\)|link\))/.test(line)) {
    fail('F', idx + 1, raw, 'only removable <link> hints may be appended to document.head');
  }
  if (/document\.(querySelector|querySelectorAll|getElementsBy\w+)\((['"`])[^'"`]*(input|form|textarea|password|\[type=)/.test(line)) {
    fail('F', idx + 1, raw, 'host-page form/input lookup — the runtime must not read host forms');
  }
  if (/document\.cookie/.test(line)) {
    fail('F', idx + 1, raw, 'host cookies must not be read or written');
  }
});

// ── Class G: nothing non-production, nothing that rewrites the platform ───
lines.forEach((raw, idx) => {
  const line = raw.trim();
  if (line.startsWith('//') || line.startsWith('*')) return;
  if (/(localhost|127\.0\.0\.1|ngrok|\.local|staging\.|:3000|:5001|:8000)/.test(line)) {
    fail('G', idx + 1, raw, 'non-production host or port in the runtime');
  }
  if (/(?<![\w.])(window|globalThis)\.(fetch|XMLHttpRequest|WebSocket|alert|open|setTimeout|setInterval|console|addEventListener)\s*=[^=]/.test(line)) {
    fail('G', idx + 1, raw, 'native browser function reassigned');
  }
  if (/\.prototype\.\w+\s*=[^=]/.test(line)) {
    fail('G', idx + 1, raw, 'native prototype modified');
  }
  if (/(?<![\w.])(window|globalThis)\.(marked|DOMPurify|Webflow|webflow)\s*=[^=]/.test(line)) {
    fail('G', idx + 1, raw, 'page global written');
  }
});

// ── Class D: every click target must be reachable by keyboard ─────────────
const declared = new Map();
lines.forEach((l, i) => {
  const m = l.match(/(?:const|let)\s+(\w+)\s*=\s*document\.createElement\('(\w+)'\)/);
  if (m) declared.set(m[1], { line: i + 1, tag: m[2] });
});
// Backdrops close on click as a convenience; the dialog itself is operable by
// its own button plus Escape, which the runtime tests assert.
const BACKDROP_OK = new Set(['overlay']);
lines.forEach((l, i) => {
  const m = l.match(/(\w+)\.addEventListener\('click'/);
  if (!m) return;
  const d = declared.get(m[1]);
  if (!d || d.line > i + 1) return;
  if (d.tag === 'button' || d.tag === 'a') return;
  if (BACKDROP_OK.has(m[1])) return;
  fail('D', i + 1, l, `click handler on <${d.tag}> "${m[1]}" declared at line ${d.line} — not focusable`);
});

// ── Report ───────────────────────────────────────────────────────────────
const NAMES = {
  A: 'externally controlled text must never become markup',
  B: 'externally controlled URLs must never navigate or load',
  C: 'nothing runs after teardown',
  D: 'every click target is keyboard operable',
  E: 'no request without a deadline',
  F: 'the host page is never modified',
  G: 'nothing non-production, nothing that rewrites the platform',
};
if (violations.length === 0) {
  console.log('class gate: PASS');
  Object.entries(NAMES).forEach(([k, v]) => console.log(`  ${k}  ${v}`));
  process.exit(0);
}
console.error(`class gate: FAIL — ${violations.length} violation(s)\n`);
violations.forEach((v) => {
  console.error(`  [${v.cls}] ${NAMES[v.cls]}`);
  console.error(`      src/index.js:${v.line}  ${v.text}`);
  console.error(`      ${v.why}\n`);
});
process.exit(1);
