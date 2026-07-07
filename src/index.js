const FONT_SOURCES = {
  'inter, sans-serif':
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap',
  'roboto, sans-serif':
    'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
  'open sans, sans-serif':
    'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap',
  'poppins, sans-serif':
    'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap',
  'montserrat, sans-serif':
    'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600&display=swap',
  'lato, sans-serif':
    'https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap',
  'nunito, sans-serif':
    'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600&display=swap',
  'source sans 3, sans-serif':
    'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600&display=swap',
  'playfair display, serif':
    'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&display=swap',
  'manrope, sans-serif':
    'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap',
  'raleway, sans-serif':
    'https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600&display=swap',
  'dm sans, sans-serif':
    'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap',
  'work sans, sans-serif':
    'https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600&display=swap',
  'karla, sans-serif':
    'https://fonts.googleapis.com/css2?family=Karla:wght@400;600&display=swap',
  'nunito sans, sans-serif':
    'https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;600&display=swap',
  'pt sans, sans-serif':
    'https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap',
  'oswald, sans-serif':
    'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600&display=swap',
  'space grotesk, sans-serif':
    'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&display=swap',
  'merriweather, serif':
    'https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap',
  'libre baskerville, serif':
    'https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&display=swap',
};

function normalizeFontKey(fontFamily = '') {
  return fontFamily
    .toLowerCase()
    .replace(/["']/g, '')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

function ensureFontLoaded(fontFamily) {
  if (!fontFamily) return;
  const key = normalizeFontKey(fontFamily);
  const href = FONT_SOURCES[key];
  if (!href) return;
  if (document.querySelector(`link[data-ultimo-font="${key}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.setAttribute('data-ultimo-font', key);
  document.head.appendChild(link);
}

// ── Colour helpers ────────────────────────────────────────────────────
// Used to derive the "Talk to a human" pill colours from the user's
// configured theme_color + header_font_color so the CTA matches the
// header instead of being a hardcoded faded purple.
function _hexToRgb(hex) {
  const m = String(hex || '').replace('#', '').trim();
  const v = m.length === 3 ? m.split('').map((c) => c + c).join('') : m.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(v)) return null;
  const n = parseInt(v, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function _rgbToHex({ r, g, b }) {
  const h = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}
function _relLum({ r, g, b }) {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function _contrast(a, b) {
  const la = _relLum(a);
  const lb = _relLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function _mix(a, b, t) {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}
function deriveLiveCtaColors(themeColorHex, headerFontColorHex) {
  const theme = _hexToRgb(themeColorHex) || { r: 86, g: 22, b: 234 };
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };
  // The CTA must always read as part of the same brand surface as the
  // header — so the background is the configured theme colour and the
  // foreground is the configured header font colour, no WCAG override.
  const fg = _hexToRgb(headerFontColorHex) || white;
  return {
    bg: _rgbToHex(theme),
    fg: _rgbToHex(fg),
    hoverBg: _rgbToHex(_mix(theme, black, 0.12)),
    activeBg: _rgbToHex(_mix(theme, black, 0.2)),
    border: _rgbToHex(_mix(theme, black, 0.08)),
  };
}

(function bootstrap() {
  const POLL_INTERVAL = 200;
  const MAX_WAIT = 60000;
  let waited = 0;

  let started = false;

  function startIfReady() {
    if (started) return true;
    const container = document.getElementById('chat-widget-container');
    if (container && container.getAttribute('data-user-id')) {
      started = true;
      initializeChatWidget();
      return true;
    }
    return false;
  }

  const observer = new MutationObserver(() => {
    if (startIfReady()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  function tryStart() {
    if (startIfReady()) return;
    if (waited < MAX_WAIT) {
      waited += POLL_INTERVAL;
      setTimeout(tryStart, POLL_INTERVAL);
    } else {
      console.error(`Chat widget bootstrap: container not found after ${MAX_WAIT / 1000}s`);
      observer.disconnect();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryStart);
  } else {
    tryStart();
  }
})();

async function initializeChatWidget() {
  ['https://portal.ultimo-bots.com', 'https://cdn.jsdelivr.net']
    .forEach(h => {
      if (!document.querySelector(`link[rel="preconnect"][href="${h}"]`)) {
        const l = document.createElement('link');
        l.rel = 'preconnect'; l.href = h; l.crossOrigin = ''; document.head.appendChild(l);
      }
    });
  let markedReady = typeof marked !== 'undefined';
  let markedLoadPromise = null;
  let _linkTarget = '_self';

  function applyMarkedLinkRenderer() {
    if (typeof marked !== 'undefined' && marked.use) {
      marked.use({
        renderer: {
          link(...args) {
            let href, title, text;
            if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
              // marked v12+ passes a single token object
              ({ href, title, text } = args[0]);
            } else {
              // marked v11 passes positional args
              [href, title, text] = args;
            }
            const displayText = text || title || 'Link';
            const titleAttr = title ? ` title="${title}"` : '';
            const rel = _linkTarget === '_blank' ? ' rel="noopener noreferrer"' : '';
            return `<a href="${href}" target="${_linkTarget}"${rel}${titleAttr}>${displayText}</a>`;
          }
        }
      });
    }
  }

  async function ensureMarked() {
    if (markedReady) return;
    if (markedLoadPromise) return markedLoadPromise;

    markedLoadPromise = (async () => {
      try {
        const mod = await import(/* webpackIgnore: true */
          'https://cdn.jsdelivr.net/npm/marked@11.1.1/lib/marked.esm.js');

        mod.marked.setOptions({ gfm: true, breaks: true, headerIds: false });
        globalThis.marked = mod.marked;
        markedReady = true;
        applyMarkedLinkRenderer();
      } catch (err) {
        // Allow a retry on next call if the CDN failed transiently.
        markedLoadPromise = null;
        console.error('Failed to load marked:', err);
      }
    })();

    return markedLoadPromise;
  }

  // Kick off marked loading as early as possible so bot messages always
  // render as markdown, regardless of which code path triggers the first render.
  ensureMarked();

  // ── DOMPurify lazy-loader (mirrors the marked loader). Loaded from the
  // same jsdelivr host that already serves `marked`; sanitises all HTML we
  // ever assign via innerHTML from user/agent/bot-message content. ──
  let dompurifyReady = typeof DOMPurify !== 'undefined';
  let dompurifyLoadPromise = null;
  async function loadDompurify() {
    if (dompurifyReady) return;
    if (dompurifyLoadPromise) return dompurifyLoadPromise;
    dompurifyLoadPromise = (async () => {
      try {
        const mod = await import(/* webpackIgnore: true */
          'https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.es.mjs');
        globalThis.DOMPurify = mod.default || mod.DOMPurify;
        dompurifyReady = true;
      } catch (err) {
        dompurifyLoadPromise = null;
        console.error('Failed to load DOMPurify:', err);
      }
    })();
    return dompurifyLoadPromise;
  }
  // Kick off DOMPurify loading alongside marked so the first bubble render
  // has a sanitiser available.
  loadDompurify();

  // Helper: markdown-parse + sanitise. Safe to call even before marked/
  // DOMPurify have finished loading — we fall back to escaped plain text.
  function sanitizedMarkdown(text) {
    const html = (typeof marked !== 'undefined') ? marked.parse(text) : String(text || '');
    if (typeof DOMPurify !== 'undefined') {
      return DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'rel'] });
    }
    // Fallback: escape everything if DOMPurify hasn't loaded yet.
    return html
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  const container = document.getElementById('chat-widget-container');
  if (!container) { console.error('Chat widget container not found'); return; }

  if (container.parentElement !== document.body) document.body.appendChild(container);

  Object.assign(container.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '0',
    height: '0',
    zIndex: '2147483647',
    pointerEvents: 'none',
  });

  const botId = container.getAttribute('data-user-id');
  if (!botId) { console.error('User ID not found (data-user-id is missing)'); return; }

  const POPUP_KEY = `saicf-popup-seen-${botId}`;
  let   popUpSeen = sessionStorage.getItem(POPUP_KEY) === '1';

  function markPopUpSeen() {
    if (!popUpSeen) {
      popUpSeen = true;
      sessionStorage.setItem(POPUP_KEY, '1');
    }
  }

  if (!container.isConnected) {
    document.body.appendChild(container);
  }
  const shadowRoot = container.shadowRoot || container.attachShadow({ mode: 'open' });

  shadowRoot.host.setAttribute('lang', 'en');

  if (!document.getElementById('saicf-global-scroll-style')) {
    const globalScrollStyle = document.createElement('style');
    globalScrollStyle.id = 'saicf-global-scroll-style';
    globalScrollStyle.textContent = `
      body.no-scroll,
      html.no-scroll {
        overflow: hidden !important;
        position: fixed !important;
        inset: 0 !important;
        width: 100% !important;
        touch-action: none !important;
        overscroll-behavior: none !important;
      }
    `;
    document.head.appendChild(globalScrollStyle);
  }

  const styleTag = document.createElement('style');
  styleTag.textContent = `
    /**********************************************************
     * Embedded widget.css (now isolated to this Shadow DOM)
     **********************************************************/

    /* ───────── FULL ISOLATION: kill any inherited styles ───────── */
    :host {
      all: initial;
      box-sizing: border-box;
      font-family: var(--saicf-font-family, "DM Sans", sans-serif);
      z-index: 2147483647 !important;
      position: fixed !important;   /* 👈 add this */
      top: 0; left: 0; width: 0; height: 0;
      pointer-events: none;
    }

    .saicf-chat-window,
    .saicf-chat-widget-icon,
    .saicf-pop-up-container { pointer-events: auto; }

    /* keep border‑box for everything inside */
    :host *, :host *::before, :host *::after {
      box-sizing: inherit;
    }

    :host, .saicf-chat-window, .saicf-chat-window * {
      font-family: var(--saicf-font-family, "DM Sans", sans-serif) !important;
    }

    :host {
      --widget-size: 80px; /* fallback – will be overwritten by JS */
    }

    .saicf-chat-window p {
      line-height: 1.3 !important;
      font-size: 15px !important;
    }
    .saicf-chat-widget-icon {
      position: fixed;
      bottom: 20px;
      right: 20px;
      color: white;
      border-radius: 50%;
      width: 100px;
      height: 100px;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      font-size: 36px;
      z-index: 999998 !important;
    }
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.1); }
      100% { transform: scale(1); }
    }
    .pulsing {
      animation: pulse 2s infinite;
    }
    /* Launcher faces: the normal face and the close chevron are stacked
       and cross-rotate when .saicf-icon-open is toggled (desktop only —
       on mobile the launcher is hidden while the chat is open). */
    .saicf-icon-face {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100%;
      transition: transform 0.3s ease, opacity 0.3s ease;
    }
    .saicf-icon-close {
      position: absolute;
      inset: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      opacity: 0;
      transform: rotate(-90deg);
      pointer-events: none;
      transition: transform 0.3s ease, opacity 0.3s ease;
    }
    .saicf-chat-widget-icon.saicf-icon-open {
      animation: none; /* pause .pulsing while showing the close face */
    }
    .saicf-chat-widget-icon.saicf-icon-open .saicf-icon-face {
      opacity: 0;
      transform: rotate(90deg);
    }
    .saicf-chat-widget-icon.saicf-icon-open .saicf-icon-close {
      opacity: 1;
      transform: rotate(0deg);
    }
    .saicf-chat-title {
      font-size: 15px;
      font-weight: 700;
    }
    .saicf-chat-window {
      position: fixed;
      bottom: 12px;
      right: 12px;
      width: 430px;
      height: 620px;
      background-color: transparent;
      border: none;
      border-radius: 16px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      display: flex !important;
      flex-direction: column;
      z-index: 2147483647 !important;
      /* Desktop: fade in, in place above the launcher — no slide.
         (Mobile has its own fullscreen slide-up in the max-width media
         query, with !important.) 0.3s fits inside closeChat()'s 300ms
         display:none timeout so the fade-out isn't cut off. */
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    .saicf-chat-window.show {
      opacity: 1;
    }
    .hidden {
      display: none !important;
    }
    .saicf-chat-header {
      color: white;
      padding: 10px 15px;
      border-radius: 16px 16px 0px 0px;
      display: flex;
      flex-direction: column;
    }
    .saicf-chat-header-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .saicf-logo-message-container {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .saicf-agent-bar {
      display: none;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 8px 14px;
      padding-top: 0px;
      background-color: rgba(0, 0, 0, 0.08);
      color: inherit;
      font-size: 12px;
      line-height: 1.3;
      text-align: center;
      margin-top: -8px;
    }
    .saicf-agent-bar.is-visible {
      display: flex;
    }
    .saicf-agent-bar-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: #22c55e;
      box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6);
      animation: saicfAgentBarPulse 2s ease-out infinite;
      flex-shrink: 0;
      align-self: center;
      position: relative;
      top: -1px;
    }
    @keyframes saicfAgentBarPulse {
      0%   { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.55); }
      70%  { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
      100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
    }
    .saicf-agent-bar-text {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      opacity: 0.95;
    }
    .saicf-agent-bar-name {
      font-weight: 600;
    }
    .saicf-close-btn {
      background: none;
      border: none;
      color: rgb(218, 43, 43);
      margin: 0;
      padding: 0;
      outline: none;
      cursor: pointer;
    }
    .saicf-close-chat-widget-icon {
      cursor: pointer;
      transition: opacity 0.4s ease, transform 0.4s ease;
    }
    .saicf-close-chat-widget-icon .fa-xmark,
    .saicf-close-chat-widget-icon svg {
      font-size: 1.6rem;   /* or whatever looks right */
    }
    .saicf-close-chat-widget-icon:hover {
      transform: scale(1.05);
    }
    .saicf-chat-body-wrapper {
      position: relative;
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
    .saicf-chat-body {
      flex: 1;
      padding: 8px;
      padding-top: 0;
      overflow-y: auto;
      overflow-anchor: none;
      display: flex;
      flex-direction: column;
      background-color: white;
      position: relative;
    }
    .saicf-scroll-to-bottom-btn {
      position: absolute;
      bottom: 8px;
      left: 50%;
      transform: translateX(-50%);
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 1px solid #e0e0e0;
      background: #fff;
      color: #555;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
      z-index: 10;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s ease, background-color 0.2s;
      padding: 0;
      margin: 0;
      outline: none;
    }
    .saicf-scroll-to-bottom-btn.visible {
      opacity: 1;
      pointer-events: auto;
    }
    .saicf-scroll-to-bottom-btn:hover {
      background-color: #f5f5f5;
    }
    .saicf-chat-footer {
      display: flex;
      flex-direction: column;
      // padding: 10px;
      background-color: white;
      gap: 8px;
    }
    .saicf-powered-by {
      display: flex;
      justify-content: center;
    }
    .saicf-powered-by-text {
      font-size: 10px;
      color: rgb(146, 146, 146);
      cursor: pointer;
      text-decoration: underline;
    }
    .saicf-powered-by-text.saicf-powered-by-text--custom {
      cursor: default;
      text-decoration: none;
    }
    .saicf-input-send-container {
      display: flex;
      border-top: 1px solid #f1f1f1;
      padding: 10px;
      background-color: #fafafa;
      align-items: flex-end;
    }
    .saicf-chat-footer textarea {
      flex: 1 !important;
      padding: 10px !important;
      border: 1px solid #ccc !important;
      border-radius: 8px !important;
      outline: none !important;
      font-size: 16px !important;
      font-family: inherit !important;
      resize: none !important;
      line-height: 24px !important;
      max-height: 140px !important;
      overflow-y: hidden !important;
      box-sizing: border-box !important;
    }
    .saicf-chat-footer textarea.has-overflow {
      overflow-y: auto !important;
    }
    /* Scoped to the send-message button (input row) so it doesn't leak
       onto other buttons inside the footer (e.g. the inline live-agent
       CTA above the predefined-question chips). */
    .saicf-input-send-container button {
      display: flex;
      align-items: center;
      margin-left: 6px;
      padding-left: 15px;
      padding-right: 15px;
      color: white;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      transition: background-color 0.4s ease, transform 0.2s ease;
      height: 44px;
      min-height: 44px;
      align-self: flex-end;
    }
    .saicf-input-send-container button:hover {
      background-color: #0595d3;
      transform: translateY(-1.5px);
    }
    .saicf-message-row {
      display: flex;
      align-items: flex-start;
      gap: 0px;
      margin: 6px 0;
    }
    .saicf-message-row.user {
      flex-direction: column;
      align-items: flex-end;
      justify-content: flex-end;
    }
    .saicf-message-row.user .saicf-widget-message {
      margin-left: auto;
    }
    .saicf-message-avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background-size: cover;
      background-position: center;
      background-color: rgba(0,0,0,0.05);
      border: 1px solid rgba(0,0,0,0.08);
      flex-shrink: 0;
      margin-top: 7px;
    }

    .saicf-widget-message {
      max-width: 80%;
      margin: 5px 0;
      padding: 5px;
      border-radius: 10px;
      display: inline-block;
    }
    .saicf-message-row.bot .saicf-widget-message {
      max-width: calc(100% - 48px);
    }
    .saicf-message-row.agent .saicf-widget-message {
      max-width: calc(100% - 48px);
    }
    .saicf-message-row.agent .saicf-message-avatar {
      background-color: transparent;
      border: none;
    }
    .widget-user-message {
      align-self: flex-end !important;
      color: white !important;
      border-radius: 8px !important;
      padding: 8px !important;
      font-size: 15px !important;
      position: relative;
    }
    .saicf-msg-tick {
      display: block;
      align-self: flex-end;
      font-size: 10px;
      line-height: 1;
      opacity: 0.75;
      margin-top: 2px;
      margin-right: 2px;
      color: #9ca3af;
      letter-spacing: -1px;
    }
    .saicf-msg-tick.read {
      color: #0ea5e9;
      opacity: 1;
    }
    .widget-bot-message {
      align-self: flex-start !important;
      background-color: #ffffff !important;
      color: rgb(43, 43, 43) !important;
      border-radius: 8px;
      font-size: 15px !important;
    }
    /* Headings inside bot bubbles: same size as paragraph */
    .widget-bot-message h1,
    .widget-bot-message h2,
    .widget-bot-message h3,
    .widget-bot-message h4,
    .widget-bot-message h5,
    .widget-bot-message h6 {
      font-size: 1em !important;
      line-height: inherit !important;
      margin: 0 0 .9em !important;
    }
    .widget-bot-message strong {
      color: rgb(57, 57, 57);
    }
    .widget-bot-message ul li:not(:last-child) {
      margin-bottom: 6px;
    }
    .widget-user-message > :first-child,
    .widget-bot-message > :first-child {
      margin-top: 0;
    }
    .widget-user-message > :last-child,
    .widget-bot-message > :last-child {
      margin-bottom: 0;
    }
    /* Agent messages – same style as bot */
    .widget-agent-message {
      align-self: flex-start !important;
      background-color: #ffffff !important;
      color: rgb(43, 43, 43) !important;
      border-radius: 8px;
      font-size: 15px !important;
    }
    .widget-agent-message h1,
    .widget-agent-message h2,
    .widget-agent-message h3,
    .widget-agent-message h4,
    .widget-agent-message h5,
    .widget-agent-message h6 {
      font-size: 1em !important;
      line-height: inherit !important;
      margin: 0 0 .9em !important;
    }
    .widget-agent-message strong {
      color: rgb(57, 57, 57);
    }
    .widget-agent-message ul li:not(:last-child) {
      margin-bottom: 6px;
    }
    .widget-agent-message > :first-child {
      margin-top: 0;
    }
    .widget-agent-message > :last-child {
      margin-bottom: 0;
    }
    /* System notice (agent joined / left) */
    @keyframes saicf-notice-in {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes saicf-pulse-dot {
      0%, 80%, 100% { opacity: .25; transform: scale(.7); }
      40% { opacity: 1; transform: scale(1.1); }
    }
    .saicf-system-notice {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin: 8px 0;
      animation: saicf-notice-in .35s ease-out;
    }
    .saicf-system-notice-text {
      background: #f0f0f0;
      color: #666;
      font-size: 12px;
      padding: 4px 12px;
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-align: center;
    }
    .saicf-waiting-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #888;
      display: inline-block;
      animation: saicf-pulse-dot 1.2s ease-in-out infinite;
    }
    .saicf-waiting-dot:nth-child(2) { animation-delay: .2s; }
    .saicf-waiting-dot:nth-child(3) { animation-delay: .4s; }
    .saicf-cancel-request {
      background: none;
      border: 1px solid #999;
      color: #666;
      font-size: 11px;
      padding: 3px 12px;
      border-radius: 10px;
      cursor: pointer;
      margin-top: 6px;
      transition: background .2s, color .2s;
    }
    .saicf-cancel-request:hover {
      background: #e0e0e0;
      color: #333;
    }
    .saicf-confirm-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,.35);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      animation: saicf-notice-in .2s ease-out;
    }
    .saicf-confirm-box {
      background: #fff;
      border-radius: 14px;
      padding: 20px 24px;
      max-width: 280px;
      width: 85%;
      box-shadow: 0 8px 32px rgba(0,0,0,.2);
      text-align: center;
    }
    .saicf-confirm-box p {
      margin: 0 0 16px;
      font-size: 14px;
      color: #333;
      line-height: 1.4;
    }
    .saicf-confirm-actions {
      display: flex;
      gap: 10px;
      justify-content: center;
    }
    .saicf-confirm-actions button {
      flex: 1;
      padding: 8px 0;
      border-radius: 8px;
      border: none;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background .15s;
    }
    .saicf-confirm-cancel {
      background: #f0f0f0;
      color: #555;
    }
    .saicf-confirm-cancel:hover { background: #e0e0e0; }
    .saicf-confirm-ok {
      background: #e53935;
      color: #fff;
    }
    .saicf-confirm-ok:hover { background: #c62828; }
    /* Headings inside user bubbles: same size as paragraph */
    .widget-user-message h1,
    .widget-user-message h2,
    .widget-user-message h3,
    .widget-user-message h4,
    .widget-user-message h5,
    .widget-user-message h6 {
      font-size: 1em !important;
      line-height: inherit !important;
      margin: 0 0 .9em !important;
    }
    .saicf-widget-send-icon {
      font-size: 18px;
      font-style: normal;
    }
    .saicf-loading-row {
      display: flex;
      justify-content: flex-start;
      margin: 6px 0;
    }
    .saicf-loading-dots {
      display: flex;
      justify-content: left;
      align-items: center;
      height: 40px;
      margin-top: 10px;
      margin-bottom: 5px;
    }
    .saicf-loading-dots div {
      width: 8px;
      height: 8px;
      margin: 0 4px;
      border-radius: 50%;
      animation: loading 0.6s infinite alternate;
    }
    @keyframes loading {
      to {
        opacity: 0.3;
        transform: translateY(-8px);
      }
    }
    .saicf-loading-dots div:nth-child(2) {
      animation-delay: 0.2s;
    }
    .saicf-loading-dots div:nth-child(3) {
      animation-delay: 0.4s;
    }
    .saicf-chat-widget-icon.align-left {
      left: 25px !important;
      right: auto !important;
    }
    .saicf-chat-widget-icon.elevated {
      bottom: 70px !important;
    }
    .saicf-chat-window.align-left {
      left: 20px !important;
      right: auto !important;
    }
    .saicf-chat-window.elevated {
      bottom: 12px !important;
    }
    .saicf-widget-message table {
      border-collapse: separate;
      border-spacing: 0px;
      margin-top: 15px;
      margin-bottom: 15px;
      width: 100%;
      overflow: auto;
    }
    .saicf-widget-message th, .saicf-widget-message td {
      border: 1px solid rgba(0, 0, 0, 0.08);
      padding: .35rem .50rem;
      text-align: left;
      font-size: 14px;
    }
    .saicf-widget-message th {
      color: #000000;
      background-color: rgba(0, 0, 0, 0.06);
      border-right: 0;
      padding: .5rem .50rem;
      border-bottom: none;
    }
    .saicf-widget-message th:last-child {
      border-right: 1px solid rgba(0, 0, 0, 0.08);
    }
    .saicf-widget-message td {
      border-bottom: 0px solid rgba(0, 0, 0, 0.08);
      border-right: 0px solid rgba(0, 0, 0, 0.08);
    }
    .saicf-widget-message td:last-child {
      border-right: 1px solid rgba(0, 0, 0, 0.08);
    }
    .saicf-widget-message tr:first-child th:first-child {
      border-top-left-radius: 8px;
    }
    .saicf-widget-message tr:first-child th:last-child {
      border-top-right-radius: 8px;
    }
    .saicf-widget-message tr:last-child td:first-child {
      border-bottom-left-radius: 8px;
    }
    .saicf-widget-message tr:last-child td:last-child {
      border-bottom-right-radius: 8px;
    }
    .saicf-widget-message tr:last-child td {
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }

    /**********************************************************
     * Pop-up message styles
     **********************************************************/
    .saicf-pop-up-container {
      position: fixed;
      right: 20px;
      bottom: calc(30px + var(--widget-size));
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 999999;
    }
    .saicf-pop-up-container.hidden {
      pointer-events: none;
    }
    .saicf-pop-up-container.align-left {
      left: 25px !important;
      right: auto !important;
    }

    .saicf-pop-up-container.elevated {
      bottom: calc(80px + var(--widget-size));   /* 55 px (icon) + 10 px gap */
    }

    .saicf-pop-up-message {
      background:rgb(250, 250, 250);
      padding: 8px 12px;
      border-radius: 12px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
      font-size: 16px;
      color: #000000;
      max-width: 320px;
      line-height: 1.3;
      border: 1px solid rgb(232, 232, 232);
      cursor: pointer;
    }
    .saicf-pop-up-close{
      background:none;
      border:none;
      outline:none;
      font-weight:500;
      color:rgb(163,163,163);
      align-self:flex-end;
      cursor:pointer;
      margin-bottom:0;
      transition: opacity 0.3s ease, transform 0.3s ease;
    }

    .saicf-pop-up-close:hover{
      transform: scale(1.05);
    }

    .saicf-pop-up-close{
      opacity:0;
      pointer-events:none;
    }
    .saicf-pop-up-close.show{
      opacity:1;
      pointer-events:auto;
    }

    .saicf-pop-up-message{
      opacity:0;
      transform:translateY(6px);
      transition:opacity .4s ease, transform .4s ease;
    }
    .saicf-pop-up-message.show{
      opacity:1;
      transform:translateY(0);
    }

    /* ───────── Unread-agent badge on the minimized chat icon ───────── */
    .saicf-unread-badge{
      position:absolute;
      top:-2px;
      right:-2px;
      min-width:22px;
      height:22px;
      padding:0 6px;
      border-radius:11px;
      background:#e53935;
      color:#fff;
      font-size:12px;
      font-weight:700;
      display:flex;
      align-items:center;
      justify-content:center;
      box-shadow:0 2px 4px rgba(0,0,0,.25);
      pointer-events:none;
      line-height:1;
      border:2px solid #fff;
      box-sizing:border-box;
      z-index:1;
    }
    .saicf-unread-badge.hidden{display:none;}

    /* ───────── predefined-question chips ───────── */
    .saicf-predefined-container{
      display:flex;
      flex-wrap:wrap-reverse;
      justify-content: flex-end;
      gap:8px;
      padding:0 10px;
      background: white;
    }

    .saicf-predefined-container::-webkit-scrollbar{display:none;}

    .saicf-predefined-question{
      flex:0 0 auto;
      border: 1px solid #e8e8e8ff;
      background: transparent;
      color:#333;
      border-radius:20px;
      padding:6px 12px;
      font-size:14px;
      white-space:nowrap;
      cursor:pointer;
      transition:background-color .25s,transform .2s;
    }
    .saicf-predefined-question:hover{
      background: #f1f1f1ff;
      transform:translateY(-1px);
    }

    /* ——— busy/disabled visuals ——— */
    .saicf-send-message[disabled] {
      opacity: .5 !important;
      cursor: not-allowed !important;
    }
    .saicf-chat-footer textarea:disabled {
      background: #f5f5f5 !important;
      cursor: not-allowed !important;
    }
    .saicf-predefined-question.is-disabled {
      opacity: .5 !important;
      pointer-events: none !important;
    }

    /* ───────── Inline "Talk to a human" CTA above the predefined chips.
       Mirrors the menu-item action so visitors don't need to discover the
       three-dots menu. Visibility is bound to live-chat settings + agent
       availability. ───────── */
    .saicf-live-cta-row {
      display: flex;
      justify-content: center;
      padding: 6px 10px 2px;
      background: white;
    }
    .saicf-live-cta-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 500;
      /* Brand-purple, intentionally NOT theme-coloured — mirrors the portal
         test chat exactly so previews stay consistent. */
      color: #5616ea;
      background: #f5f1ff;
      border: 1px solid #e0d4ff;
      border-radius: 999px;
      cursor: pointer;
      margin-bottom: -4px;
      font-family: inherit;
      transition: background-color .15s ease, transform .1s ease, border-color .15s ease;
    }
    .saicf-live-cta-btn svg {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
    }
    .saicf-live-cta-btn:hover:not(.is-disabled) {
      background: #ebe1ff;
      border-color: #d2c0ff;
      transform: translateY(-1px);
    }
    .saicf-live-cta-btn:active:not(.is-disabled) {
      transform: translateY(0);
    }
    .saicf-live-cta-btn.is-disabled {
      opacity: .65;
      cursor: not-allowed;
    }

    /* ───────── Header actions: close "X" + three-dots menu ───────── */
    .saicf-header-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      position: relative; /* anchor menu below */
    }

    .saicf-ellipsis-btn {
      background: none;
      border: none;
      color: inherit;
      padding: 4px;
      margin: 0;
      cursor: pointer;
      border-radius: 6px;
      transition: background-color .2s ease, transform .2s ease;
      font-size: 20px;
    }
    .saicf-ellipsis-btn:hover { transform: scale(1.05); }
    .saicf-ellipsis-btn svg { width: 1.4em; height: 1.4em; display: block; }

    .saicf-menu {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      min-width: 200px;
      background: #fff;
      color: #1f2937;
      border: 1px solid rgba(0,0,0,.08);
      box-shadow: 0 8px 24px rgba(0,0,0,.15);
      border-radius: 10px;
      padding: 6px;
      z-index: 2147483647; /* above header */
      opacity: 0;
      pointer-events: none;
      transform: translateY(-6px);
      transition: opacity .15s ease, transform .15s ease;
    }
    .saicf-menu.is-open {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }

    .saicf-menu-item {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border: 0;
      background: transparent;
      font: inherit;
      color: inherit;
      border-radius: 8px;
      cursor: pointer;
      text-align: left;
    }
    .saicf-menu-item:hover { background: #f3f4f6; }
    .saicf-menu-item.is-disabled {
      opacity: 0.5;
      pointer-events: none;
    }

    .saicf-menu-item svg { width: 16px; height: 16px; flex-shrink: 0; display: block; }
    .saicf-menu-item { white-space: nowrap; }

    @media (min-width: 769px) {
      /* Desktop: the chat window opens ABOVE the launcher icon (which
         stays visible and flips to a close chevron). bottom = icon
         offset (20px) + icon size + 12px gap; height leaves 12px of
         headroom at the top of the viewport. */
      .saicf-chat-window {
        right: 20px;
        bottom: calc(32px + var(--widget-size));
        width: min(430px, calc(100svw - 24px));
        height: min(620px, calc(100svh - 44px - var(--widget-size)));
        max-height: calc(100svh - 44px - var(--widget-size));
      }
      .saicf-chat-window.align-left {
        left: 25px !important;
      }
      /* Elevated launcher sits at bottom: 70px — keep the window above it. */
      .saicf-chat-window.elevated {
        bottom: calc(82px + var(--widget-size)) !important;
        height: min(620px, calc(100svh - 94px - var(--widget-size)));
        max-height: calc(100svh - 94px - var(--widget-size));
      }
    }

    @media (max-width: 768px) {
      /* Hide the dim overlay; the window itself covers the screen */
      .saicf-chat-overlay {
        display: none !important;
      }

      /* Fullscreen chat window (slides up when .show is added).
         --saicf-kb is the iOS on-screen keyboard overlap (set from
         visualViewport in JS): it lifts the footer/input above the
         keyboard while the window itself keeps covering the FULL layout
         viewport. Do not shrink the window's height instead — that
         leaves the strip behind the keyboard/URL bar uncovered and the
         host page shows through. */
      .saicf-chat-window {
        position: fixed !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        padding-bottom: var(--saicf-kb, 0px) !important;
        border-radius: 0 !important;
        background: #ffffff !important;
        opacity: 0 !important;
        /* Fade in like desktop — no slide-up. This rule's display:flex
           !important outranks .hidden (later in the sheet), so the
           fullscreen window is ALWAYS rendered on mobile; without the
           old off-screen translateY it would invisibly cover the page
           and swallow the tap on the launcher. visibility +
           pointer-events keep it inert until .show; the delayed
           visibility flip lets the 0.3s fade-out finish. */
        visibility: hidden !important;
        pointer-events: none !important;
        transition: opacity 0.3s ease, visibility 0s linear 0.3s !important;
        display: flex !important;
        flex-direction: column !important;
      }

      /* When opened */
      .saicf-chat-window.show {
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        transition: opacity 0.3s ease !important;
      }

      /* Internal pieces tuned for fullscreen */
      .saicf-chat-window .saicf-chat-header {
        border-radius: 0 !important;
      }

      .saicf-chat-header {
        padding: 12px 10px;
        margin-bottom: 5px;
      }
      .saicf-chat-window .saicf-chat-body {
        flex: 1 1 auto !important;
        min-height: 0 !important;
        overflow-y: auto !important;
        -webkit-overflow-scrolling: touch !important;
      }

      /* Keep your existing mobile sizing for other bits */
      .saicf-close-chat-widget-icon {
        font-size: 22px;
      }
      .saicf-chat-title {
        font-size: 18px;
      }
      .widget-user-message,
      .widget-bot-message {
        font-size: 17px;
      }
      .saicf-chat-widget-icon {
        width: 70px;
        height: 70px;
      }
      .saicf-pop-up-container {
        right: 20px;
        bottom: calc(30px + var(--widget-size));
      }
      .saicf-pop-up-container.align-left {
        left: 20px !important;
        right: auto !important;
      }
      .saicf-pop-up-message {
        padding: 7px 10px;
        font-size: 14px;
      }
      .saicf-chat-window.align-left {
        left: 0 !important;
        right: 0 !important;
      }
    }

    /* ───────── Loading Spinner ───────── */
    .saicf-config-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
      background: #fff;
      min-height: 0;
      border-radius: 0 0 16px 16px;
    }

    .saicf-config-spinner {
      width: 32px;
      height: 32px;
      color: #5616ea;
      animation: saicf-spin 1s linear infinite;
    }

    @keyframes saicf-spin {
      to { transform: rotate(360deg); }
    }

    /* ───────── Pre-chat Form ───────── */
    .saicf-pre-chat-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 30px 24px;
      flex: 1 1 0%;
      width: 100%;
      min-height: 0;
      text-align: center;
      background: #fff;
      overflow-y: auto;
      border-radius: 0 0 16px 16px;
    }

    .saicf-pre-chat-header {
      margin-bottom: 24px;
      flex-shrink: 0;
    }

    .saicf-pre-chat-icon {
      width: 48px;
      height: 48px;
      margin-bottom: 12px;
      color: #5616ea;
    }

    .saicf-pre-chat-header h3 {
      font-size: 20px;
      font-weight: 600;
      color: #333;
      margin: 0 0 6px 0;
    }

    .saicf-pre-chat-header p {
      font-size: 14px;
      color: #666;
      margin: 0;
    }

    .saicf-pre-chat-fields {
      width: 100%;
      max-width: 320px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-bottom: 20px;
    }

    .saicf-pre-chat-field {
      display: flex;
      flex-direction: column;
      text-align: left;
    }

    .saicf-pre-chat-field label {
      font-size: 13px;
      font-weight: 600;
      color: #444;
      margin-bottom: 5px;
      text-transform: capitalize;
    }

    .saicf-pre-chat-field input {
      padding: 11px 12px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 15px;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
      outline: none;
      font-family: inherit;
    }

    .saicf-pre-chat-field input:focus {
      border-color: currentColor;
    }

    .saicf-pre-chat-field input:disabled {
      background-color: #f5f5f5;
      cursor: not-allowed;
    }

    .saicf-pre-chat-field input::placeholder {
      color: #999;
    }

    .saicf-pre-chat-submit {
      background-color: #5616ea;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 12px 28px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.2s ease, transform 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-width: 140px;
      font-family: inherit;
    }

    .saicf-pre-chat-submit:hover:not(:disabled) {
      background-color: #4512c4;
      transform: translateY(-1px);
    }

    .saicf-pre-chat-submit:disabled {
      background-color: #ccc;
      cursor: not-allowed;
      transform: none;
    }

    .saicf-pre-chat-submit .saicf-btn-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: saicf-spin 0.8s linear infinite;
    }

    /* Powered-by on the pre-chat screen — same markup/classes as the
       chat-footer version; margin-top:auto pins it to the bottom of the
       form column (scrolls with the form if the fields overflow). */
    .saicf-pre-chat-container .saicf-powered-by {
      margin-top: auto;
      padding-top: 16px;
      flex-shrink: 0;
    }

    @media (max-width: 768px) {
      .saicf-pre-chat-container {
        padding: 24px 20px;
      }

      .saicf-pre-chat-icon {
        width: 40px;
        height: 40px;
      }

      .saicf-pre-chat-header h3 {
        font-size: 18px;
      }

      .saicf-pre-chat-fields {
        max-width: 100%;
      }
    }


    /* ───────── Agent typing indicator ───────── */
    .saicf-agent-typing-row {
      display: flex;
      align-items: flex-start;
      margin: 6px 0;
    }
    .saicf-agent-typing-bubble {
      display: flex;
      align-items: center;
      gap: 4px;
      background-color: #f0f0f0;
      border-radius: 16px;
      border-bottom-left-radius: 4px;
      padding: 10px 14px;
    }
    .saicf-agent-typing-bubble .saicf-typing-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background-color: #999;
      animation: saicfTypingBounce 1.2s ease-in-out infinite;
    }
    .saicf-agent-typing-bubble .saicf-typing-dot:nth-child(2) {
      animation-delay: 0.2s;
    }
    .saicf-agent-typing-bubble .saicf-typing-dot:nth-child(3) {
      animation-delay: 0.4s;
    }
    @keyframes saicfTypingBounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-5px); opacity: 1; }
    }

    /**********************************************************
     * In-chat product gallery — mirrors the portal
     * ProductCarousel (chatModal.js). Structured product cards
     * the agent attaches to a reply (delivered on the products
     * SSE event), rendered as a horizontally-scrollable strip
     * under the bot reply. Arrow-hover + the "View" CTA pick up
     * the bot's theme_color (see the dynamic style block below).
     **********************************************************/

    /* The bot row is a flex row (avatar + bubble). The gallery
       breaks to its own full-width line beneath the reply. */
    .saicf-message-row.bot { flex-wrap: wrap; }

    .ub-pc-inline {
      flex-basis: 100%;
      width: 100%;
      box-sizing: border-box;
      margin-top: 2px;
    }
    /* Indent the strip past the bot avatar so it lines up with the bubble. */
    .ub-pc-inline.ub-pc-inline--indent { padding-left: 24px; }

    .ub-pc {
      position: relative;
      width: 100%;
    }

    .ub-pc-track {
      display: flex;
      gap: 12px;
      overflow-x: auto;
      scroll-snap-type: x proximity;
      padding: 6px 2px 10px;          /* room so hover-lift + shadow aren't clipped */
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;          /* Firefox */
    }
    .ub-pc-track::-webkit-scrollbar { display: none; }  /* WebKit */

    /* ── Card ── */
    .ub-pc-card {
      flex: 0 0 auto;
      width: 190px;
      scroll-snap-align: start;
      display: flex;
      flex-direction: column;
      background: #ffffff;
      border: 1px solid #ececf1;
      border-radius: 16px;
      overflow: hidden;
      text-decoration: none;
      color: inherit;
      box-shadow: 0 1px 2px rgba(20, 20, 40, 0.04);
      will-change: transform;
      -webkit-backface-visibility: hidden;
      backface-visibility: hidden;
      transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1),
                  box-shadow 0.3s ease,
                  border-color 0.3s ease;
    }
    .ub-pc-card-link { cursor: pointer; }
    .ub-pc-card-link:hover {
      transform: translateY(-4px);
      border-color: #cfcfd6;
    }

    /* ── Image ── */
    .ub-pc-img {
      position: relative;
      width: 100%;
      aspect-ratio: 4 / 3;          /* fixed -> no layout shift while images load */
      background: linear-gradient(135deg, #f5f3ff 0%, #f0f0f5 100%);
      overflow: hidden;
    }
    .ub-pc-img img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transform: translateZ(0);
      will-change: transform;
      -webkit-backface-visibility: hidden;
      backface-visibility: hidden;
      transition: transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .ub-pc-card-link:hover .ub-pc-img img { transform: scale(1.06) translateZ(0); }

    .ub-pc-img-fallback {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #b9b4d6;
    }

    .ub-pc-badge {
      position: absolute;
      top: 8px;
      left: 8px;
      padding: 3px 8px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: #2c2c3a;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(6px);
      border-radius: 999px;
      box-shadow: 0 1px 3px rgba(20, 20, 40, 0.12);
      text-transform: capitalize;
    }

    /* ── Body ── */
    .ub-pc-body {
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding: 11px 12px 12px;
      flex: 1;
    }

    .ub-pc-brand {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #8a86a0;
    }

    .ub-pc-title {
      font-size: 14px;
      font-weight: 600;
      line-height: 1.3;
      color: #1a1a2e;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .ub-pc-specs {
      font-size: 11.5px;
      line-height: 1.35;
      color: #6f6b82;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-transform: capitalize;
    }

    .ub-pc-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-top: auto;
      padding-top: 9px;
    }

    .ub-pc-price {
      font-size: 15px;
      font-weight: 700;
      color: #15151f;
      white-space: nowrap;
    }

    /* CTA colour is overridden with theme_color in the dynamic block. */
    .ub-pc-cta {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11.5px;
      font-weight: 600;
      color: #3a3550;
      white-space: nowrap;
    }
    .ub-pc-cta-ic { display: inline-flex; }
    .ub-pc-card-link:hover .ub-pc-cta { text-decoration: underline; }

    /* ── Scroll arrows ── */
    .ub-pc-arrow {
      position: absolute;
      top: calc(50% - 12px);          /* roughly centred on the image, not the text */
      transform: translateY(-50%);
      width: 34px;
      height: 34px;
      border-radius: 999px;
      border: 1px solid #ececf1;
      background: #ffffff;
      color: #3a3550;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      padding: 0;
      z-index: 3;
      box-shadow: 0 4px 14px rgba(20, 20, 40, 0.16);
      transition: opacity 0.2s ease, transform 0.15s ease, background 0.15s ease, color 0.15s ease;
    }
    /* Arrow hover colour is overridden with theme_color in the dynamic block. */
    .ub-pc-arrow:hover { background: #3a3550; color: #fff; border-color: #3a3550; }
    .ub-pc-arrow:active { transform: translateY(-50%) scale(0.92); }
    .ub-pc-arrow-l { left: -6px; }
    .ub-pc-arrow-r { right: -6px; }

    .ub-pc-arrow-off {
      opacity: 0;
      pointer-events: none;
    }

    @media (max-width: 768px) {
      .ub-pc-card { width: 158px; }
      /* On touch devices the arrows just get in the way — swipe instead. */
      .ub-pc-arrow { display: none; }
    }
  `;
  shadowRoot.appendChild(styleTag);

  const widgetRoot = document.createElement('div');
  widgetRoot.id = 'widget-root';
  shadowRoot.appendChild(widgetRoot);

  if (typeof marked !== 'undefined') {
    marked.setOptions({
      gfm: true,
      breaks: true,
      headerIds: false,
    });
  }

  let widgetConfig;
  let promotingText = 'This website is powered by smart AI chatbots from Ultimo Bots.';
  let preChatFields = [];
  let requirePreChat = false;
  const PRE_CHAT_KEY = `saicf-prechat-completed-${botId}`;
  let preChatCompleted = localStorage.getItem(PRE_CHAT_KEY) === '1';
  const startTime = Date.now();

  try {
    const hostPageUrl = encodeURIComponent(window.location.href);

    const res = await fetch(
      `https://portal.ultimo-bots.com/api/widget_configuration/${botId}?host_url=${hostPageUrl}`,
      { cache: 'no-store' }
    );

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    } 
    widgetConfig = await res.json();
    promotingText = widgetConfig.promoting_text ?? promotingText;

    // Link target behavior
    if (widgetConfig.open_links_in_new_tab === true) {
      _linkTarget = '_blank';
    }
    applyMarkedLinkRenderer();

    // Check for pre-chat requirement
    requirePreChat = widgetConfig.require_pre_chat === true;
    let requiredFieldIds = [];
    try {
      requiredFieldIds = typeof widgetConfig.pre_chat_required_fields === 'string'
        ? JSON.parse(widgetConfig.pre_chat_required_fields)
        : widgetConfig.pre_chat_required_fields || [];
    } catch {
      requiredFieldIds = [];
    }

    if (requirePreChat && requiredFieldIds.length > 0) {
      // Fetch warm lead parameters to get field details
      try {
        const warmLeadRes = await fetch(
          `https://portal.ultimo-bots.com/api/warm_lead_function/${botId}`,
          { cache: 'no-store' }
        );
        if (warmLeadRes.ok) {
          const warmLeadData = await warmLeadRes.json();
          const allParams = warmLeadData.bot_function_parameters || [];

          // Filter to only the required fields
          preChatFields = allParams.filter(p => requiredFieldIds.includes(p.id));

          if (preChatFields.length === 0) {
            requirePreChat = false;
          }
        } else {
          requirePreChat = false;
        }
      } catch (err) {
        console.error('Error fetching warm lead parameters:', err);
        requirePreChat = false;
      }
    } else {
      requirePreChat = false;
    }
  } catch (err) {
    console.error('Widget config load failed – widget aborted', err);
    return;
  }

  // Fetch live chat settings (non-blocking — widget works without it)
  let liveSettings = { show_request_button: false, request_button_text: '' };
  let agentAvailable = false;
  try {
    const [liveRes, availRes] = await Promise.all([
      fetch(`https://portal.ultimo-bots.com/api/live_chat_settings_public/${botId}`, { cache: 'no-store' }),
      fetch(`https://portal.ultimo-bots.com/api/live/agent_available/${botId}`, { cache: 'no-store' }),
    ]);
    if (liveRes.ok) {
      liveSettings = await liveRes.json();
    }
    if (availRes.ok) {
      const availData = await availRes.json();
      agentAvailable = availData.available === true;
    }
  } catch (err) {
    console.error('Live chat settings load failed:', err);
  }

  const removePoweredBy     = widgetConfig.remove_powered_by       ?? false;
  const customBrandingText  = (widgetConfig.custom_branding_text || '').trim();
  const customBrandingTextHtml = customBrandingText
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const themeColor          = widgetConfig.theme_color             || '#0082ba';
  const hoverColor          = widgetConfig.button_hover_color      || '#0595d3';
  const headerFontColor     = widgetConfig.header_font_color       || '#ffffff';

  // ── Derive "Talk to a human" CTA colours from the theme + header font.
  // Filled pill that mirrors the header so it always feels on-brand and
  // never looks "faded". If the user's header_font_color happens to be
  // unreadable on theme_color (WCAG AA < 4.5), fall back to whichever of
  // white/black wins, so the label is always legible.
  const liveCtaColors = deriveLiveCtaColors(themeColor, headerFontColor);
  const welcomeMessages     = widgetConfig.welcome_message
            ? Array.isArray(widgetConfig.welcome_message)
              ? widgetConfig.welcome_message
              : [widgetConfig.welcome_message]
            : [""];
  const widgetHeaderText    = widgetConfig.header_text             || 'Chat with us!';
  const widgetBorderRadius  = widgetConfig.widget_border_radius    ?? 50;
  const widgetSize          = widgetConfig.widget_size             ?? 75;
  const logo                = widgetConfig.header_icon_path        || null;
  const icon                = widgetConfig.widget_icon_path        || null;
  const popUpDelaySeconds   = widgetConfig.pop_up_delay_seconds    ?? 2;
  const popUpMessages       = widgetConfig.pop_up_messages         ?? false;
  const inputPlaceholder    = widgetConfig.input_placeholder       || 'Type your message...';
  const avatar              = widgetConfig.avatar_icon_path        || null;

  // Agent avatar from live chat settings (preset SVG or custom image URL)
  const agentAvatar = (function buildAgentAvatar() {
    const url = liveSettings.agent_avatar_url || '';
    const color = liveSettings.agent_avatar_color || '#5616ea';
    if (!url) return null;
    const PRESET_SVGS = {
      'preset:person': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="${color}"/><g transform="translate(14,12) scale(0.08)"><path fill="#fff" d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304H178.3z"/></g></svg>`,
      'preset:headset': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="${color}"/><g transform="translate(12,12) scale(0.078125)"><path fill="#fff" d="M256 48C141.1 48 48 141.1 48 256v40c0 13.3-10.7 24-24 24s-24-10.7-24-24V256C0 114.6 114.6 0 256 0S512 114.6 512 256V400.1c0 48.6-39.4 88-88.1 88L313.6 488c-8.3 14.3-23.8 24-41.6 24H240c-26.5 0-48-21.5-48-48s21.5-48 48-48h32c17.8 0 33.3 9.7 41.6 24l110.4 .1c22.1 0 40-17.9 40-40V256c0-114.9-93.1-208-208-208zM144 208h16c17.7 0 32 14.3 32 32V352c0 17.7-14.3 32-32 32H144c-35.3 0-64-28.7-64-64V272c0-35.3 28.7-64 64-64zm224 0c35.3 0 64 28.7 64 64v48c0 35.3-28.7 64-64 64H352c-17.7 0-32-14.3-32-32V240c0-17.7 14.3-32 32-32h16z"/></g></svg>`,
      'preset:smile': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="${color}"/><g transform="translate(12,12) scale(0.078125)"><path fill="#fff" d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM164.1 325.5C182 346.2 212.6 368 256 368s74-21.8 91.9-42.5c5.8-6.7 15.9-7.4 22.6-1.6s7.4 15.9 1.6 22.6C349.8 372.1 311.1 400 256 400s-93.8-27.9-116.1-53.5c-5.8-6.7-5.1-16.8 1.6-22.6s16.8-5.1 22.6 1.6zM144.4 208a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zm192-32a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"/></g></svg>`,
    };
    if (PRESET_SVGS[url]) {
      return 'data:image/svg+xml,' + encodeURIComponent(PRESET_SVGS[url]);
    }
    return url;
  })();
  const fontFamily          = (widgetConfig.font_family && String(widgetConfig.font_family).trim())
    || '"DM Sans", sans-serif';

  ensureFontLoaded(fontFamily);
  shadowRoot.host.style.setProperty('--saicf-font-family', fontFamily);

  let isPulsing = false;
  if (typeof widgetConfig.pulsing === 'boolean') {
    isPulsing = widgetConfig.pulsing;
  } else if (typeof widgetConfig.pulsing === 'string') {
    isPulsing = widgetConfig.pulsing.toLowerCase() === 'true';
  }

  const horizontalAlignment = widgetConfig.widget_horizontal_alignment || 'right';
  const verticalAlignment   = widgetConfig.widget_vertical_alignment   || 'bottom';

  const chatWidgetIcon = document.createElement('div');
  chatWidgetIcon.className = 'saicf-chat-widget-icon';
  if (isPulsing) {
    chatWidgetIcon.classList.add('pulsing');
  }
  if (!icon) {
    chatWidgetIcon.style.backgroundColor = themeColor;
    chatWidgetIcon.style.paddingBottom = '1px';
  }
  if (widgetBorderRadius != null) {
    chatWidgetIcon.style.borderRadius = `${widgetBorderRadius}%`;
  }
  if (widgetSize != null) {
    chatWidgetIcon.style.height = `${widgetSize}px`;
    chatWidgetIcon.style.width = `${widgetSize}px`;

    container.style.setProperty('--widget-size', `${widgetSize}px`);
  }
  if (icon) {
    chatWidgetIcon.innerHTML = `
      <div class="saicf-icon-face">
        <img
          src="${icon}"
          alt="Widget Icon"
          style="max-width: 100%; max-height: 100%; border-radius: ${widgetBorderRadius}%;">
      </div>
    `;
  } else {
    chatWidgetIcon.innerHTML = `
<div class="saicf-icon-face">
<div style="display:flex; justify-content:center; align-items:center; background-color: transparent; padding-top: 3px">
  <svg xmlns="http://www.w3.org/2000/svg" width="65%" viewBox="0 0 24 24" fill="currentColor" class="size-6">
    <path fill-rule="evenodd" d="M12 2.25c-2.429 0-4.817.178-7.152.521C2.87 3.061 1.5 4.795 1.5 6.741v6.018c0 1.946 1.37 3.68 3.348 3.97.877.129 1.761.234 2.652.316V21a.75.75 0 0 0 1.28.53l4.184-4.183a.39.39 0 0 1 .266-.112c2.006-.05 3.982-.22 5.922-.506 1.978-.29 3.348-2.023 3.348-3.97V6.741c0-1.947-1.37-3.68-3.348-3.97A49.145 49.145 0 0 0 12 2.25ZM8.25 8.625a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25Zm2.625 1.125a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875-1.125a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25Z" clip-rule="evenodd" />
  </svg>
</div>
</div>
`;
  }
  // Close-state face (desktop only): while the chat window is open the
  // launcher stays visible below it, rotates to this chevron and acts
  // as the close button (see .saicf-icon-open).
  const iconCloseFace = document.createElement('div');
  iconCloseFace.className = 'saicf-icon-close';
  iconCloseFace.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="${headerFontColor}" style="width: 42%; height: 42%;">
      <path d="M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z"/>
    </svg>
  `;
  chatWidgetIcon.appendChild(iconCloseFace);
  // Unread-agent-message badge overlay on the minimized icon. Appended AFTER
  // the icon's innerHTML is set so it isn't overwritten.
  const unreadBadge = document.createElement('div');
  unreadBadge.className = 'saicf-unread-badge hidden';
  unreadBadge.textContent = '0';
  chatWidgetIcon.appendChild(unreadBadge);

  const chatOverlay = document.createElement('div');
  chatOverlay.className = 'saicf-chat-overlay hidden';

  const chatWindow = document.createElement('div');
  chatWindow.className = 'saicf-chat-window hidden';

  const logoHTML = logo
    ? `<img src="${logo}" alt="Chat Logo"
         style="height:30px;width:30px;border-radius:50%;object-fit:cover;"/>`
    : '';
  const headerHTML = `
    <div class="saicf-chat-header" style="background-color:${themeColor};">
      <div class="saicf-chat-header-title">
        <div class="saicf-logo-message-container">
          ${logoHTML}
          <span class="saicf-chat-title" style="color:${headerFontColor};">${widgetHeaderText}</span>
        </div>

        <div class="saicf-header-actions" aria-label="Chat actions">
          <!-- three dots -->
          <button class="saicf-ellipsis-btn" aria-label="More actions" title="More">
            <svg viewBox="0 0 448 512" fill="${headerFontColor}">
              <path d="M120 256a56 56 0 1 1-112 0 56 56 0 1 1 112 0zm160 0a56 56 0 1 1-112 0 56 56 0 1 1 112 0zm160 0a56 56 0 1 1-112 0 56 56 0 1 1 112 0z"/>
            </svg>
          </button>

          <!-- close X (unchanged) -->
          <button class="saicf-close-btn saicf-close-chat-widget-icon" aria-label="Close chat" style="color:${headerFontColor};">
            <svg viewBox="0 0 384 512" style="height:32px;width:32px;fill:currentColor;">
              <path d="M310.6 361.4 233.3 284l77.3-77.3c12.5-12.5 12.5-32.8 0-45.3-12.5-12.5-32.8-12.5-45.3 0L188 238.7 110.7 161.4c-12.5-12.5-32.8-12.5-45.3 0-12.5 12.5-12.5 32.8 0 45.3l77.3 77.3-77.3 77.3c-12.5 12.5-12.5 32.8 0 45.3 12.5 12.5 32.8 12.5 45.3 0L188 327.3l77.3 77.3c12.5 12.5 32.8 12.5 45.3 0 12.5-12.5 12.5-32.8 0-45.3z"/>
            </svg>
          </button>

          <!-- dropdown menu -->
          <div class="saicf-menu" role="menu" hidden>
            <button class="saicf-menu-item saicf-menu-item--clear" role="menuitem">
              <svg viewBox="0 0 448 512" fill="currentColor">
                <path d="M135.2 17.7c2.9-10.7 12.7-17.7 23.8-17.7h129.9c11.1 0 20.9 7.1 23.8 17.7L328 32H432c8.8 0 16 7.2 16 16s-7.2 16-16 16H416 32 16C7.2 64 0 56.8 0 48S7.2 32 16 32H120l15.2-14.3zM64 96H384l-21.2 355.9c-1.5 25.1-22.3 44.1-47.4 44.1H132.6c-25.1 0-45.9-19-47.4-44.1L64 96z"/>
              </svg>
              Clear chat
            </button>
            ${liveSettings.show_request_button && agentAvailable ? `
            <button class="saicf-menu-item saicf-menu-item--agent" role="menuitem">
              <svg viewBox="0 0 512 512" fill="currentColor">
                <path d="M256 48C141.1 48 48 141.1 48 256c0 39.6 11.1 76.5 30.3 108L48 464l100-30.3c31.5 19.2 68.4 30.3 108 30.3 114.9 0 208-93.1 208-208S370.9 48 256 48z"/>
              </svg>
              ${liveSettings.request_button_text || 'Talk to a human'}
            </button>` : ''}
          </div>
        </div>
      </div>
    </div>
    <div class="saicf-agent-bar" style="background-color:${themeColor};color:${headerFontColor};" hidden>
      <span class="saicf-agent-bar-dot" aria-hidden="true"></span>
      <span class="saicf-agent-bar-text">
        <span class="saicf-agent-bar-name"></span>
        <span class="saicf-agent-bar-status"> is connected</span>
      </span>
    </div>
  `;
  const poweredByHTML = removePoweredBy
    ? (customBrandingText
      ? `
        <div class="saicf-powered-by">
          <span class="saicf-powered-by-text saicf-powered-by-text--custom">${customBrandingTextHtml}</span>
        </div>
      `
      : '')
    : `
        <div class="saicf-powered-by">
          <a class="saicf-powered-by-text"
            href="https://www.ultimo-bots.com"
            target="_blank"
            rel="noopener"
            title="${promotingText}">
            Powered by Ultimo Bots
          </a>
        </div>
      `;

  chatWindow.innerHTML = `
    ${headerHTML}
    <div class="saicf-config-loading">
      <svg class="saicf-config-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
        <path d="M304 48a48 48 0 1 0 -96 0 48 48 0 1 0 96 0zm0 416a48 48 0 1 0 -96 0 48 48 0 1 0 96 0zM48 304a48 48 0 1 0 0-96 48 48 0 1 0 0 96zm464-48a48 48 0 1 0 -96 0 48 48 0 1 0 96 0zM142.9 437A48 48 0 1 0 75 369.1 48 48 0 1 0 142.9 437zm0-294.2A48 48 0 1 0 75 75a48 48 0 1 0 67.9 67.9zM369.1 437A48 48 0 1 0 437 369.1 48 48 0 1 0 369.1 437z"/>
      </svg>
    </div>
    <div class="saicf-pre-chat-container hidden">
      <div class="saicf-pre-chat-header">
        <svg class="saicf-pre-chat-icon" style="color:${themeColor};" viewBox="0 0 640 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M208 352c114.9 0 208-78.8 208-176S322.9 0 208 0S0 78.8 0 176c0 38.6 14.7 74.3 39.6 103.4c-3.5 9.4-8.7 17.7-14.2 24.7c-4.8 6.2-9.7 11-13.3 14.3c-1.8 1.6-3.3 2.9-4.3 3.7c-.5 .4-.9 .7-1.1 .8l-.2 .2 0 0 0 0C1 327.2-1.4 334.4 .8 340.9S9.1 352 16 352c21.8 0 43.8-5.6 62.1-12.5c9.2-3.5 17.8-7.4 25.3-11.4C134.1 343.3 169.8 352 208 352zM448 176c0 112.3-99.1 196.9-216.5 207C255.8 457.4 336.4 512 432 512c38.2 0 73.9-8.7 104.7-23.9c7.5 4 16 7.9 25.2 11.4c18.3 6.9 40.3 12.5 62.1 12.5c6.9 0 13.1-4.5 15.2-11.1c2.1-6.6-.2-13.8-5.8-17.9l0 0 0 0-.2-.2c-.2-.2-.6-.4-1.1-.8c-1-.8-2.5-2-4.3-3.7c-3.6-3.3-8.5-8.1-13.3-14.3c-5.5-7-10.7-15.4-14.2-24.7c24.9-29 39.6-64.7 39.6-103.4c0-92.8-84.9-168.9-192.6-175.5c.4 5.1 .6 10.3 .6 15.5z"/>
        </svg>
        <h3>Before we start chatting</h3>
        <p>Please provide your details to continue</p>
      </div>
      <div class="saicf-pre-chat-fields"></div>
      <button class="saicf-pre-chat-submit" disabled>Start Chat</button>
      ${poweredByHTML}
    </div>
    <div class="saicf-chat-body hidden"></div>
    <div class="saicf-chat-footer hidden">
      ${liveSettings.show_request_button && agentAvailable ? `
      <div class="saicf-live-cta-row">
        <button class="saicf-live-cta-btn" type="button">
          <svg viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
            <path d="M256 48C141.1 48 48 141.1 48 256v40c0 13.3-10.7 24-24 24s-24-10.7-24-24V256C0 114.6 114.6 0 256 0S512 114.6 512 256V400.1c0 48.6-39.4 88-88.1 88L313.6 488c-8.3 14.3-23.8 24-41.6 24H240c-26.5 0-48-21.5-48-48s21.5-48 48-48h32c17.8 0 33.3 9.7 41.6 24l110.4 .1c22.1 0 40-17.9 40-40V256c0-114.9-93.1-208-208-208zM144 208h16c17.7 0 32 14.3 32 32V352c0 17.7-14.3 32-32 32H144c-35.3 0-64-28.7-64-64V272c0-35.3 28.7-64 64-64zm224 0c35.3 0 64 28.7 64 64v48c0 35.3-28.7 64-64 64H352c-17.7 0-32-14.3-32-32V240c0-17.7 14.3-32 32-32h16z"/>
          </svg>
          <span class="saicf-live-cta-btn-label">${liveSettings.request_button_text || 'Talk to a human'}</span>
        </button>
      </div>` : ''}
      <div class="saicf-predefined-container hidden"></div>
      ${poweredByHTML}
      <div class="saicf-input-send-container">
        <textarea class="saicf-chat-input" placeholder="${inputPlaceholder}" rows="1"></textarea>
        <button class="saicf-send-message" style="background-color:${themeColor};" aria-label="Send message">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" style="width: 16px; height: 16px; fill: ${headerFontColor};">
            <path d="M214.6 41.4c-12.5-12.5-32.8-12.5-45.3 0L7 203.6c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L160 140.3V464c0 17.7 14.3 32 32 32s32-14.3 32-32V140.3l107.6 108.7c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L214.6 41.4z"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  const popUpContainer = document.createElement('div');

  (function zoomWidgetForWixMobile () {
    if (window.screen.width > 600) return;

    const vp = document.querySelector('meta[name="viewport"][id="wixMobileViewport"]');
    if (!vp) return;

    const m = /width\s*=\s*(\d+)/i.exec(vp.content || '');
    if (!m) return;

    const forcedWidth = +m[1];

    const physical    = window.screen.width;
    if (physical <= forcedWidth) return;

    const zoomFactor  = forcedWidth / physical;

    container.style.zoom = zoomFactor;
    container.style.setProperty('-moz-transform', `scale(${zoomFactor})`);
    container.style.setProperty('-moz-transform-origin', 'top left');
  })();

  popUpContainer.className = 'saicf-pop-up-container hidden';

  const popUpCloseBtn = document.createElement('button');
  popUpCloseBtn.className = 'saicf-pop-up-close';
  popUpCloseBtn.setAttribute('aria-label', 'Close pop-up message');
  popUpCloseBtn.innerHTML = `
    <svg viewBox="0 0 384 512" style="height:1.5em; width:1.5em; fill:currentColor; margin-bottom: 2px;">
      <path d="M310.6 361.4 233.3 284l77.3-77.3c12.5-12.5 12.5-32.8 0-45.3-12.5-12.5-32.8-12.5-45.3 0L188 238.7 110.7 161.4c-12.5-12.5-32.8-12.5-45.3 0-12.5 12.5-12.5 32.8 0 45.3l77.3 77.3-77.3 77.3c-12.5 12.5-12.5 32.8 0 45.3 12.5 12.5 32.8 12.5 45.3 0L188 327.3l77.3 77.3c12.5 12.5 32.8 12.5 45.3 0 12.5-12.5 12.5-32.8 0-45.3z"/>
    </svg>
  `;
  popUpCloseBtn.style.backgroundColor = themeColor;
  popUpCloseBtn.style.color = headerFontColor;
  popUpCloseBtn.style.borderRadius = '50%';
  popUpCloseBtn.style.padding = '0px';
  popUpCloseBtn.style.width = '24px';
  popUpCloseBtn.style.height = '24px';
  popUpCloseBtn.style.display = 'flex';
  popUpCloseBtn.style.alignItems = 'center';
  popUpCloseBtn.style.justifyContent = 'center';
  popUpContainer.appendChild(popUpCloseBtn);

  welcomeMessages.forEach(msg => {
    const msgEl = document.createElement('div');
    msgEl.className = 'saicf-pop-up-message';
    msgEl.innerHTML = msg.replace(/\n/g, '<br>');
    popUpContainer.appendChild(msgEl);

    msgEl.addEventListener('click', () => {
      // Only show welcome messages if pre-chat is completed or not required
      if (!requirePreChat || preChatCompleted) {
        ensureMarked().then(() => {
          if (chatBody.querySelectorAll('.saicf-message-row').length === 0) {
            welcomeMessages.forEach(msg => appendMessage(msg, 'bot', { skipSave: true }));
          }
        });
      }
      chatWindow.classList.remove('hidden');
      forceReflow(chatWindow);
      chatWindow.classList.add('show');
      chatOverlay.classList.remove('hidden');

      if (window.matchMedia('(max-width: 768px)').matches) {
        // Mobile: fullscreen window, launcher hidden underneath.
        chatWidgetIcon.classList.add('hidden');
        document.body.classList.add('no-scroll');
      } else {
        // Desktop: window opens above the launcher, which flips to a
        // close chevron and acts as the close button.
        chatWidgetIcon.classList.add('saicf-icon-open');
      }

      widgetOpenedOnce = true;
      markPopUpSeen();
      hidePopUp();
    });
  });

  widgetRoot.appendChild(chatWidgetIcon);
  widgetRoot.appendChild(chatOverlay);
  widgetRoot.appendChild(chatWindow);
  widgetRoot.appendChild(popUpContainer);

  if (horizontalAlignment === 'left') {
    chatWidgetIcon.classList.add('align-left');
    chatWindow.classList.add('align-left');
    popUpContainer.classList.add('align-left');
  }
  if (verticalAlignment === 'elevated') {
    chatWidgetIcon.classList.add('elevated');
    chatWindow.classList.add('elevated');
    popUpContainer.classList.add('elevated');
  }

  const dynamicStyleEl = document.createElement('style');
  dynamicStyleEl.textContent = `
    /* While open, the launcher shows the chevron on the theme colour —
       matters for custom image icons, which have no background of
       their own (the image fades out in the open state). */
    .saicf-chat-widget-icon.saicf-icon-open {
      background-color: ${themeColor};
    }
    .saicf-input-send-container button:hover {
      background-color: ${hoverColor} !important;
    }
    .widget-user-message {
      background-color: ${themeColor} !important;
    }
    .saicf-loading-dots div {
      background-color: ${themeColor} !important;
    }
    .saicf-config-spinner {
      color: ${themeColor};
    }
    .saicf-pre-chat-submit {
      background-color: ${themeColor} !important;
    }
    .saicf-pre-chat-submit:hover:not(:disabled) {
      background-color: ${hoverColor} !important;
    }
    .saicf-pre-chat-icon {
      fill: ${themeColor};
    }
    .saicf-pre-chat-field input:focus {
      border-color: ${themeColor};
      box-shadow: 0 0 0 3px ${themeColor}22;
    }
    /* "Talk to a human" CTA — derived from theme + header font so the
       button reads as part of the same brand surface as the header. */
    .saicf-live-cta-btn {
      color: ${liveCtaColors.fg} !important;
      background: ${liveCtaColors.bg} !important;
      border-color: ${liveCtaColors.border} !important;
    }
    .saicf-live-cta-btn:hover:not(.is-disabled) {
      background: ${liveCtaColors.hoverBg} !important;
      border-color: ${liveCtaColors.hoverBg} !important;
    }
    .saicf-live-cta-btn:active:not(.is-disabled) {
      background: ${liveCtaColors.activeBg} !important;
      border-color: ${liveCtaColors.activeBg} !important;
    }
    /* Product gallery: the "View" CTA text and the scroll-arrow hover state
       pick up the bot's configured theme colour. */
    .ub-pc-cta {
      color: ${themeColor};
    }
    .ub-pc-arrow:hover {
      background: ${themeColor};
      color: #fff;
      border-color: ${themeColor};
    }
  `;
  shadowRoot.appendChild(dynamicStyleEl);

  const closeChatBtn   = chatWindow.querySelector('.saicf-close-btn');
  const chatBody       = chatWindow.querySelector('.saicf-chat-body');
  const chatFooter     = chatWindow.querySelector('.saicf-chat-footer');

  // Wrap chatBody for scroll-down button positioning
  const chatBodyWrapper = document.createElement('div');
  chatBodyWrapper.className = 'saicf-chat-body-wrapper';
  chatBody.parentElement.insertBefore(chatBodyWrapper, chatBody);
  chatBodyWrapper.appendChild(chatBody);

  // Create spacer + sentinel elements for scroll positioning
  const bottomSpacerEl = document.createElement('div');
  bottomSpacerEl.style.flexShrink = '0';
  chatBody.appendChild(bottomSpacerEl);

  const messagesEndEl = document.createElement('div');
  chatBody.appendChild(messagesEndEl);

  // Create scroll-down button
  const scrollDownBtn = document.createElement('button');
  scrollDownBtn.className = 'saicf-scroll-to-bottom-btn';
  scrollDownBtn.setAttribute('aria-label', 'Scroll to latest');
  scrollDownBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="14" height="14"><path d="M169.4 470.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 370.8V64c0-17.7-14.3-32-32-32s-32 14.3-32 32v306.7L54.6 265.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z" fill="currentColor"/></svg>';
  scrollDownBtn.addEventListener('click', () => {
    // In live agent mode, just scroll to bottom — no spacer logic
    if (liveSessionStatus === 'agent_joined' || liveSessionStatus === 'agent_requested') {
      scrollToBottom();
      scrollDownBtn.classList.remove('visible');
      return;
    }
    // Recalculate spacer, then smooth-scroll to the anchor position.
    userScrolledAway = false;
    programmaticScroll = true;
    recalcSpacer();
    const allUserMsgs = chatBody.querySelectorAll('.saicf-message-row.user');
    const lastUserMsg = allUserMsgs[allUserMsgs.length - 1];
    if (spacerActive && lastUserMsg) {
      smoothScrollTarget = lastUserMsg.offsetTop - TOP_MARGIN;
    } else {
      smoothScrollTarget = chatBody.scrollHeight - chatBody.clientHeight;
    }
    chatBody.scrollTo({ top: smoothScrollTarget, behavior: 'smooth' });
    scrollDownBtn.classList.remove('visible');
  });
  chatBodyWrapper.appendChild(scrollDownBtn);
  const chatInput      = chatWindow.querySelector('.saicf-chat-footer textarea');
  const sendMessageBtn = chatWindow.querySelector('.saicf-send-message');
  const ellipsisBtn    = chatWindow.querySelector('.saicf-ellipsis-btn');
  const actionsWrap    = chatWindow.querySelector('.saicf-header-actions');
  const menu           = chatWindow.querySelector('.saicf-menu');
  const clearBtn       = chatWindow.querySelector('.saicf-menu-item--clear');
  const configLoading  = chatWindow.querySelector('.saicf-config-loading');
  const preChatContainer = chatWindow.querySelector('.saicf-pre-chat-container');
  const preChatFieldsContainer = chatWindow.querySelector('.saicf-pre-chat-fields');
  const preChatSubmitBtn = chatWindow.querySelector('.saicf-pre-chat-submit');

  // Pre-chat form state
  const preChatFormValues = {};

  // Function to render pre-chat form fields
  function renderPreChatFields() {
    preChatFieldsContainer.innerHTML = '';

    preChatFields.forEach(field => {
      const fieldWrapper = document.createElement('div');
      fieldWrapper.className = 'saicf-pre-chat-field';

      const label = document.createElement('label');
      label.textContent = field.user_display || field.name;
      label.setAttribute('for', `prechat-field-${field.id}`);

      const input = document.createElement('input');
      input.type = field.name.toLowerCase().includes('email') ? 'email' : 'text';
      input.id = `prechat-field-${field.id}`;
      input.placeholder = `Enter your ${(field.user_display || field.name).toLowerCase()}`;
      input.required = true;

      preChatFormValues[field.id] = '';

      input.addEventListener('input', (e) => {
        preChatFormValues[field.id] = e.target.value;
        validatePreChatForm();
      });

      fieldWrapper.appendChild(label);
      fieldWrapper.appendChild(input);
      preChatFieldsContainer.appendChild(fieldWrapper);
    });
  }

  // Function to validate pre-chat form
  function validatePreChatForm() {
    const allFilled = preChatFields.every(field => {
      const value = preChatFormValues[field.id];
      return value && value.trim() !== '';
    });
    preChatSubmitBtn.disabled = !allFilled;
  }

  // Function to submit pre-chat form
  async function submitPreChatForm() {
    preChatSubmitBtn.disabled = true;
    preChatSubmitBtn.textContent = 'Submitting...';

    try {
      // Build params object matching chatModal.js format: {fieldName: value}
      const params = {};
      preChatFields.forEach(field => {
        params[field.name] = preChatFormValues[field.id];
      });

      const response = await fetch('https://portal.ultimo-bots.com/api/leads/pre_chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_id: botId,
          session_id: sessionId,
          params: params
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit pre-chat form');
      }

      preChatCompleted = true;
      localStorage.setItem(PRE_CHAT_KEY, '1');

      // Treat pre-chat submission as the start of a chat: kick off the
      // heartbeat so the backend creates the live session row and fires the
      // standard `new_chat` notification (toast + email) to the bot owner.
      // Without this, no notification would ever fire for visitors who fill
      // out the pre-chat form and then leave before sending a message.
      if (!liveHeartbeatStarted) {
        liveHeartbeatStarted = true;
        try { await sendHeartbeat(); } catch { /* non-fatal */ }
        startHeartbeat();
      }

      // Transition to chat view
      preChatContainer.classList.add('hidden');
      chatBodyWrapper.classList.remove('hidden');
      chatBody.classList.remove('hidden');
      chatFooter.classList.remove('hidden');

      // Load chat history or show welcome messages
      if (chatBody.querySelectorAll('.saicf-message-row').length === 0) {
        await loadChatHistory();
        if (chatBody.querySelectorAll('.saicf-message-row').length === 0) {
          await ensureMarked();
          welcomeMessages.forEach(msg => appendMessage(msg, 'bot', { skipSave: true }));
        }
      }
    } catch (err) {
      console.error('Error submitting pre-chat form:', err);
      preChatSubmitBtn.textContent = 'Start Chat';
      preChatSubmitBtn.disabled = false;
    }
  }

  // Pre-chat submit handler
  preChatSubmitBtn.addEventListener('click', () => {
    submitPreChatForm();
  });

  // Hide loading spinner and show appropriate view (with 200ms minimum)
  function initializeWidgetView() {
    const elapsed = Date.now() - startTime;
    const minDelay = 200;
    const remainingDelay = Math.max(0, minDelay - elapsed);

    setTimeout(() => {
      configLoading.classList.add('hidden');

      if (requirePreChat && !preChatCompleted) {
        renderPreChatFields();
        chatBodyWrapper.classList.add('hidden');
        preChatContainer.classList.remove('hidden');
      } else {
        chatBody.classList.remove('hidden');
        chatFooter.classList.remove('hidden');
      }
    }, remainingDelay);
  }

  // Initialize the widget view
  initializeWidgetView();

function toggleMenu(open) {
  const willOpen = typeof open === 'boolean' ? open : !menu.classList.contains('is-open');
  menu.classList.toggle('is-open', willOpen);
  if (willOpen) {
    menu.removeAttribute('aria-hidden');
    menu.removeAttribute('hidden');
  } else {
    menu.setAttribute('aria-hidden', 'true');
    menu.setAttribute('hidden', '');
  }
}


  shadowRoot.addEventListener('click', (e) => {
    if (!menu.classList.contains('is-open')) return;
    if (actionsWrap.contains(e.target)) return;
    toggleMenu(false);
  });

  shadowRoot.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) toggleMenu(false);
  });

  ellipsisBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  function doClearChat() {
    // W17: Teardown live chat state for old session
    stopHeartbeat();
    stopAgentPolling();
    hideAgentTyping();
    if (liveWs) { try { liveWs.close(); } catch(e) {} liveWs = null; }
    wsConnected = false;
    wsConnecting = false;
    liveSessionStatus = 'active';
    lastAgentMessageId = 0; // W5
    agentRequestPending = false;
    joinAckSent = false;
    hideAgentBar();
    if (visitorTypingTimer) { clearTimeout(visitorTypingTimer); visitorTypingTimer = null; }
    visitorIsTyping = false;

    // Reset the agent button text back to default
    if (requestAgentBtn) {
      const svgMarkup = requestAgentBtn.querySelector('svg')?.outerHTML || '';
      requestAgentBtn.innerHTML = svgMarkup + ` ${liveSettings.request_button_text || 'Talk to a human'}`;
      requestAgentBtn.classList.remove('is-disabled');
    }
    // Remove any waiting notice with cancel button
    const waitingCancel = chatBody.querySelector('.saicf-cancel-request');
    if (waitingCancel) waitingCancel.closest('.saicf-system-notice')?.remove();

    // End old session in backend so it disappears from the portal.
    // We deliberately use fetch({ keepalive, credentials: 'omit' }) instead
    // of navigator.sendBeacon — sendBeacon always sends cookies, and the
    // backend's CORS responds with Access-Control-Allow-Origin: *, which
    // browsers reject for credentialed requests.
    if (liveHeartbeatStarted) {
      try {
        const tok = getStoredSessionToken();
        const payload = { session_id: sessionId, bot_id: botId };
        if (tok) payload.session_token = tok;
        fetch('https://portal.ultimo-bots.com/api/live/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'omit',
          keepalive: true,
        }).catch(() => { /* non-fatal */ });
      } catch { /* non-fatal */ }
    }

    // The old session is gone — drop its token too so we don't accidentally
    // replay it against the new session_id we're about to mint.
    setStoredSessionToken(null);
    wsAuthenticated = false;

    sessionId = generateSessionId();
    sessionStorage.setItem(`sessionId-${botId}`, sessionId);
    sessionStorage.removeItem(`chat-history-${botId}`);

    // W17: Don't restart heartbeat for new session — wait for first message
    liveHeartbeatStarted = false;

    chatBody.innerHTML = '';

    // Re-add spacer elements after clearing
    chatBody.appendChild(bottomSpacerEl);
    chatBody.appendChild(messagesEndEl);
    bottomSpacerEl.style.height = '0px';
    spacerActive = false;
    programmaticScroll = false;
    pendingUserScroll = false;

    const loadingRow = chatBody.querySelector('.saicf-loading-row');
    if (loadingRow) {
      loadingRow.remove();
    } else {
      const legacyDots = chatBody.querySelector('.saicf-loading-dots');
      if (legacyDots) legacyDots.remove();
    }
    resetStreamingBotMessage();

    if (Array.isArray(welcomeMessages) && welcomeMessages.length) {
      welcomeMessages.forEach(msg => appendMessage(msg, 'bot', { skipSave: true }));
    }

    chatInput.focus();
  }

  clearBtn.addEventListener('click', (e) => {
    e.preventDefault();
    toggleMenu(false);

    // Show inline confirm if agent is connected or requested
    if (liveSessionStatus === 'agent_joined' || liveSessionStatus === 'agent_requested') {
      const overlay = document.createElement('div');
      overlay.className = 'saicf-confirm-overlay';
      overlay.innerHTML = `
        <div class="saicf-confirm-box">
          <p>This will disconnect the live agent. Clear chat?</p>
          <div class="saicf-confirm-actions">
            <button class="saicf-confirm-cancel">Cancel</button>
            <button class="saicf-confirm-ok">Clear</button>
          </div>
        </div>
      `;
      overlay.querySelector('.saicf-confirm-cancel').addEventListener('click', () => overlay.remove());
      overlay.querySelector('.saicf-confirm-ok').addEventListener('click', () => {
        overlay.remove();
        doClearChat();
      });
      chatWindow.appendChild(overlay);
      return;
    }

    doClearChat();
  });

  const _origCloseChat = closeChat;
  closeChat = function () {
    toggleMenu(false);
    resetStreamingBotMessage();
    _origCloseChat();
  };

  let isBusy = false;
  let pendingUserScroll = false;
  let spacerActive = false;
  let programmaticScroll = false;
  let isStreamingState = false;
  let userScrolledAway = false;
  let ignoreScrollEvents = false;
  let smoothScrollTarget = null; // store target so completion check is exact
  const TOP_MARGIN = 6;
  const isMobile = window.matchMedia('(max-width: 768px)').matches;

  // Recalculate spacer so user message stays at top.
  // Key insight: lastUserMsg.offsetTop is CONSTANT during streaming
  // (only content below it changes). So the target scrollTop is always
  // lastUserMsg.offsetTop - TOP_MARGIN. Setting scrollTop to a value
  // it already holds is a no-op (no event, no jitter).
  function recalcSpacer() {
    // In live agent mode, spacer is always disabled — scroll-to-bottom only
    if (liveSessionStatus === 'agent_joined' || liveSessionStatus === 'agent_requested') {
      bottomSpacerEl.style.height = '0px';
      spacerActive = false;
      return 0;
    }
    if (!bottomSpacerEl || !chatBody) return 0;
    const allUserMsgs = chatBody.querySelectorAll('.saicf-message-row.user');
    const lastUserMsg = allUserMsgs[allUserMsgs.length - 1];
    if (!lastUserMsg) return 0;

    const containerH = chatBody.clientHeight;
    const msgOffsetTop = lastUserMsg.offsetTop;  // constant during streaming
    const naturalContentH = bottomSpacerEl.offsetTop;
    const contentBelowUserMsg = naturalContentH - msgOffsetTop;
    const neededSpacer = Math.max(0, containerH - contentBelowUserMsg - TOP_MARGIN);
    bottomSpacerEl.style.height = neededSpacer + 'px';
    spacerActive = neededSpacer > 0;

    // Anchor scroll so user msg stays at TOP_MARGIN from viewport top.
    // msgOffsetTop is constant during streaming, so when already correct
    // chatBody.scrollTop === target and the assignment is a true no-op.
    // Skip when: user scrolled away, or desktop smooth scroll in progress.
    if (spacerActive && !userScrolledAway && !programmaticScroll) {
      const target = msgOffsetTop - TOP_MARGIN;
      if (Math.abs(chatBody.scrollTop - target) > 1) {
        ignoreScrollEvents = true;
        chatBody.scrollTop = target;
        requestAnimationFrame(() => { ignoreScrollEvents = false; });
      }
    }

    return neededSpacer;
  }

  // Position user message at top after sending.
  function doPositioning() {
    // In live agent mode, just scroll to bottom — no spacer pinning
    if (liveSessionStatus === 'agent_joined' || liveSessionStatus === 'agent_requested') {
      pendingUserScroll = false;
      scrollToBottom();
      return;
    }
    if (!chatBody || !pendingUserScroll) return;
    pendingUserScroll = false;

    // Reset spacer for fresh measurement
    bottomSpacerEl.style.height = '0px';
    spacerActive = false;

    // Size the spacer. Set programmaticScroll FIRST so recalcSpacer
    // skips its instant anchor — we want a smooth scroll instead.
    programmaticScroll = true;
    recalcSpacer();

    if (spacerActive) {
      // Scroll to the exact anchor value (msgOffsetTop - TOP_MARGIN),
      // not scrollHeight - clientHeight, so there's zero discrepancy
      // when the smooth scroll completes.
      const allUserMsgs = chatBody.querySelectorAll('.saicf-message-row.user');
      const lastUserMsg = allUserMsgs[allUserMsgs.length - 1];
      smoothScrollTarget = lastUserMsg ? lastUserMsg.offsetTop - TOP_MARGIN : 0;
      chatBody.scrollTo({ top: smoothScrollTarget, behavior: 'smooth' });
    } else {
      programmaticScroll = false;
    }
  }

  // Track scroll-down button visibility
  function updateScrollDownVisibility() {
    if (!chatBody) return;
    // Hide during smooth scroll animation
    if (programmaticScroll) {
      scrollDownBtn.classList.remove('visible');
      return;
    }
    const { scrollTop, scrollHeight, clientHeight } = chatBody;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    const shouldShow = !isAtBottom && scrollHeight > clientHeight;
    scrollDownBtn.classList.toggle('visible', shouldShow);
  }

  // Scroll event handler
  chatBody.addEventListener('scroll', function () {
    if (ignoreScrollEvents) return;
    if (programmaticScroll) {
      // Detect smooth scroll completion: arrived at target or at bottom
      const atTarget = smoothScrollTarget !== null && Math.abs(chatBody.scrollTop - smoothScrollTarget) < 2;
      const atBottom = chatBody.scrollHeight - chatBody.scrollTop - chatBody.clientHeight < 2;
      if (atTarget || atBottom) {
        programmaticScroll = false;
        smoothScrollTarget = null;
      }
      return;
    }
    updateScrollDownVisibility();
  });

  // Detect user-initiated scrolls via touch events (mobile) or
  // wheel/mousedown (desktop). This is reliable on iOS where scroll
  // events from programmatic scrollTop, keyboard dismiss, and resize
  // are indistinguishable from user scrolls.
  if (isMobile) {
    let userTouching = false;
    chatBody.addEventListener('touchstart', () => { userTouching = true; }, { passive: true });
    chatBody.addEventListener('touchend', () => {
      // Defer so the final scroll events from the touch are processed
      setTimeout(() => { userTouching = false; }, 100);
    }, { passive: true });
    chatBody.addEventListener('scroll', function () {
      if (userTouching && isStreamingState && !userScrolledAway) {
        userScrolledAway = true;
        updateScrollDownVisibility();
      }
    }, { passive: true });
  } else {
    // Desktop: wheel and mousedown are reliable indicators
    chatBody.addEventListener('wheel', function () {
      if (isStreamingState && !userScrolledAway) {
        userScrolledAway = true;
        updateScrollDownVisibility();
      }
    }, { passive: true });
    chatBody.addEventListener('mousedown', function () {
      if (isStreamingState && !userScrolledAway) {
        userScrolledAway = true;
        updateScrollDownVisibility();
      }
    });
  }

  // Watch for container resizes (e.g. mobile keyboard dismiss changes
  // clientHeight). Re-size the spacer so the user message stays pinned.
  let lastBodyHeight = chatBody.clientHeight;
  const bodyResizeObserver = new ResizeObserver(() => {
    const newH = chatBody.clientHeight;
    if (newH === lastBodyHeight) return;
    lastBodyHeight = newH;
    if (spacerActive) {
      recalcSpacer();
    }
  });
  bodyResizeObserver.observe(chatBody);

  // ── iOS on-screen keyboard fit ───────────────────────────────────
  // iPhone Safari does NOT shrink the layout viewport when the keyboard
  // opens — only the *visual* viewport shrinks. The fullscreen mobile
  // chat window (position:fixed; height:100%) therefore keeps extending
  // behind the keyboard, hiding the footer/input. Safari's native
  // "scroll focused field into view" also mis-computes on the FIRST tap
  // (it runs before the keyboard has settled), which is why a second
  // tap used to bring the input back.
  // Fix: measure the keyboard overlap from visualViewport and lift the
  // window's content above it via --saicf-kb (padding-bottom in the
  // mobile media query). The window itself stays fullscreen so its
  // white background keeps covering the strip behind the keyboard/URL
  // bar — shrinking the window instead let the host page show through.
  const visualVP = window.visualViewport;
  function applyViewportFit() {
    if (!visualVP || !window.matchMedia('(max-width: 768px)').matches) return;
    // Keyboard overlap = layout viewport height minus the visible part.
    const kb = Math.max(0, window.innerHeight - visualVP.height - visualVP.offsetTop);
    chatWindow.style.setProperty('--saicf-kb', kb + 'px');
  }
  function clearViewportFit() {
    chatWindow.style.removeProperty('--saicf-kb');
  }
  if (visualVP) {
    const onViewportChange = () => {
      if (!chatWindow.classList.contains('show')) return;
      applyViewportFit();
      // The window just shrank/grew with the keyboard — keep the newest
      // message visible while the visitor is typing.
      const active = widgetRoot.getRootNode().activeElement;
      if (active === chatInput) requestAnimationFrame(() => scrollToBottom());
    };
    visualVP.addEventListener('resize', onViewportChange);
    visualVP.addEventListener('scroll', onViewportChange);

    // First-tap safety net: iOS occasionally settles the keyboard
    // without a (timely) resize event. Re-fit shortly after focus so
    // the very first tap into the input never leaves it hidden.
    chatInput.addEventListener('focus', () => {
      [300, 800].forEach(ms => setTimeout(onViewportChange, ms));
    });
  }

  // Handle scroll positioning for incoming live content (agent messages,
  // system notices). Simple scroll-to-bottom like standard chat apps.
  function handleIncomingLiveContent() {
    scrollToBottom();
  }

  function getPredefinedChips() {
    return Array.from(chatWindow.querySelectorAll('.saicf-predefined-question'));
  }

  function setBusy(b) {
    isBusy = b;

    chatInput.disabled = b;
    sendMessageBtn.disabled = b;
    chatInput.setAttribute('aria-disabled', String(b));
    sendMessageBtn.setAttribute('aria-disabled', String(b));

    getPredefinedChips().forEach(chip => {
      chip.classList.toggle('is-disabled', b);
      chip.tabIndex = b ? -1 : 0;
      chip.setAttribute('aria-disabled', String(b));
    });
  }

  const predefinedContainer = chatWindow.querySelector('.saicf-predefined-container');

  let predefinedQuestions = widgetConfig.predefined_questions ?? [];
  try {
    if (typeof predefinedQuestions === 'string') {
      predefinedQuestions = JSON.parse(predefinedQuestions);
    }
  } catch {}

  const hasRealQuestions =
    Array.isArray(predefinedQuestions) &&
    (predefinedQuestions.length > 1 ||
    (predefinedQuestions.length === 1 && predefinedQuestions[0].trim() !== ''));

  if (hasRealQuestions) {
    predefinedContainer.classList.remove('hidden');

    predefinedQuestions.forEach(q => {
      if (!q) return;
      const chip        = document.createElement('div');
      chip.className    = 'saicf-predefined-question';
      chip.textContent  = q;

      chip.addEventListener('click', () => {
        if (isBusy) return;
        chatInput.value = q;
        sendMessage();
      });

      predefinedContainer.appendChild(chip);
    });
  }

  let sessionId = sessionStorage.getItem(`sessionId-${botId}`) || generateSessionId();
  sessionStorage.setItem(`sessionId-${botId}`, sessionId);
  let widgetOpenedOnce = popUpSeen;
  let streamingBotRow = null;
  let streamingBotBubble = null;

  // ── Live chat state ──
  let heartbeatInterval = null;
  let agentPollInterval = null;
  let lastAgentMessageId = 0;
  let liveSessionStatus = 'active'; // active | agent_requested | agent_joined
  let agentRequestPending = false;
  let liveHeartbeatStarted = false; // tracks whether heartbeat has been started for this session
  // W2: tracks whether the live WS has completed its widget_init handshake.
  // When true, safety-net polling can slow way down because events arrive
  // over the WS channel.
  let wsAuthenticated = false;

  // ── Live chat: session_token storage (W6) ──
  // The backend mints a session_token on first heartbeat response and
  // expects it back on every subsequent HTTP call that mutates or reads
  // session state. Stored per-tab so multiple tabs don't clobber each
  // other's tokens.
  const LIVE_TOKEN_STORAGE_KEY = `ultimo_live_session_token-${botId}`;
  function getStoredSessionToken() {
    try { return sessionStorage.getItem(LIVE_TOKEN_STORAGE_KEY) || null; }
    catch { return null; }
  }
  function setStoredSessionToken(t) {
    try {
      if (t) sessionStorage.setItem(LIVE_TOKEN_STORAGE_KEY, t);
      else sessionStorage.removeItem(LIVE_TOKEN_STORAGE_KEY);
    } catch {}
  }
  // Drop all live state so the next user action re-bootstraps with a fresh
  // session_id + token. Called on 401 from any token-protected endpoint.
  function resetLiveSessionForAuthFailure() {
    setStoredSessionToken(null);
    stopHeartbeat();
    stopAgentPolling();
    liveHeartbeatStarted = false;
    liveSessionStatus = 'active';
    lastAgentMessageId = 0;
    agentRequestPending = false;
    joinAckSent = false;
    wsAuthenticated = false;
    if (liveWs) { try { liveWs.close(); } catch {} liveWs = null; }
    wsConnected = false;
    wsConnecting = false;
    hideAgentBar();
    // Rotate the session id so the next heartbeat registers cleanly.
    sessionId = generateSessionId();
    try { sessionStorage.setItem(`sessionId-${botId}`, sessionId); } catch {}
  }
  // Per-session agent display name. Set by `live_agent_joined` / `widget_init_ack`
  // events when the portal agent picked a custom name in JoinConversationModal.
  // Falls back to the bot-level `liveSettings.agent_display_name` when null.
  let currentAgentDisplayName = null;

  function effectiveAgentDisplayName(fallback) {
    return currentAgentDisplayName || liveSettings.agent_display_name || fallback || 'Agent';
  }

  // ── WebSocket state ──
  let liveWs = null;
  let wsConnected = false;
  let wsConnecting = false;
  let wsReconnectDelay = 1000;
  let wsReconnectTimer = null;
  let visitorTypingTimer = null;
  let visitorIsTyping = false;
  let agentTypingRow = null; // the typing indicator DOM element
  let agentTypingTimer = null; // safety timeout to auto-hide stuck typing dots
  // Handshake: track join_ack emission so we only send it once per join
  let joinAckSent = false;

  // ── WebSocket: connect ──
  function connectLiveWs() {
    if (wsConnecting) return;
    if (liveWs && (liveWs.readyState === WebSocket.OPEN || liveWs.readyState === WebSocket.CONNECTING)) return;
    if (wsReconnectTimer) { clearTimeout(wsReconnectTimer); wsReconnectTimer = null; }

    wsConnecting = true;
    try {
      liveWs = new WebSocket('wss://portal.ultimo-bots.com/api/ws');
    } catch (err) {
      wsConnecting = false;
      console.error('WS constructor error:', err);
      scheduleWsReconnect();
      return;
    }

    liveWs.addEventListener('open', () => {
      wsConnecting = false;
      wsConnected = true;
      wsReconnectDelay = 1000; // reset backoff on successful connect
      liveWs.send(JSON.stringify({
        type: 'widget_init',
        session_id: sessionId,
        bot_id: botId,
        session_token: getStoredSessionToken(),
      }));
      // Switch polling to slower interval now that WS is live
      restartAgentPollingWithCurrentInterval();
    });

    liveWs.addEventListener('message', (ev) => {
      let event;
      try { event = JSON.parse(ev.data); } catch { return; }

      switch (event.type) {
        case 'widget_init_ack': {
          // W2: WS handshake is now complete. Demote safety-net polling
          // cadence and let pollAgentMessages pick up the slower interval.
          wsAuthenticated = true;
          restartAgentPollingWithCurrentInterval();
          // Handshake: backend confirms our widget WS is registered and echoes
          // the current session status. If the backend says an agent is
          // currently joined we ALWAYS re-ack — this covers rejoin races
          // where we never saw the left/joined transition (e.g. brief
          // disconnect during an agent leave→rejoin cycle).
          if (event.session_status === 'agent_joined') {
            if (event.agent_display_name) {
              currentAgentDisplayName = event.agent_display_name;
            }
            if (liveSessionStatus !== 'agent_joined') {
              setLiveSessionStatusFn('agent_joined');
            }
            // Always show the agent bar (covers rejoin where status transition
            // was a no-op and setLiveSessionStatusFn skipped the UI update).
            showAgentBar(effectiveAgentDisplayName('A live agent'));
            // Always try to ack. sendJoinAck handles idempotency itself.
            joinAckSent = false;
            sendJoinAck();
          } else if (event.session_status && event.session_status !== 'agent_joined') {
            // Backend says no agent is connected. If our local state is stale
            // (e.g. we missed a `live_agent_left` during a WS disconnect),
            // sync down so the agent bar is removed.
            if (liveSessionStatus === 'agent_joined' || liveSessionStatus === 'agent_requested') {
              setLiveSessionStatusFn(event.session_status === 'agent_requested' ? 'agent_requested' : 'active');
            }
            // Safety net: ensure the bar DOM matches reality even if the state
            // machine was already in sync but the UI wasn't.
            hideAgentBar();
          }
          break;
        }
        case 'live_agent_message': {
          // Any agent message means the agent is no longer "typing" — clear
          // the dots BEFORE the dedup/early-return checks so a re-delivered
          // message (after WS reconnect) still hides a stuck indicator.
          hideAgentTyping();
          // Deduplicate: skip if a message with this id is already rendered
          if (event.id && event.id <= lastAgentMessageId) break;
          if (!event.content) break;
          appendMessage(event.content, 'agent');
          if (event.id && event.id > lastAgentMessageId) lastAgentMessageId = event.id;
          // Send ack via WS; fall back to HTTP if WS is not open
          if (event.id) sendMessageAck([event.id]);
          // If the chat window is currently minimized/closed, surface an
          // unread badge on the icon and an attention pop-up so the visitor
          // doesn't miss the agent's reply.
          if (!chatWindow.classList.contains('show')) {
            unreadAgentCount += 1;
            updateUnreadBadge();
            showAgentMessagePopUp(event.content);
          }
          break;
        }
        case 'live_agent_joined': {
          // Capture per-join agent display name from the portal modal so the
          // visitor sees the personalised name, not the bot-level fallback.
          if (event.agent_display_name) {
            currentAgentDisplayName = event.agent_display_name;
          }
          // Every agent-join event is a reason to re-ack. This covers the
          // re-join case where our liveSessionStatus may already be
          // 'agent_joined' (stale state after a leave/rejoin cycle) — in
          // that case setLiveSessionStatusFn is a no-op and would not fire
          // the handshake. So we ack directly here.
          joinAckSent = false;
          if (liveSessionStatus !== 'agent_joined') {
            setLiveSessionStatusFn('agent_joined');
          } else {
            sendJoinAck();
          }
          break;
        }
        case 'live_agent_left': {
          hideAgentTyping();
          setLiveSessionStatusFn('active');
          break;
        }
        case 'live_agent_requested': {
          // AI-tool-triggered request from the backend's `generate_response`.
          // Mirror the menu-button UI: show the "Please wait / Cancel" notice.
          if (liveSessionStatus !== 'agent_requested' && liveSessionStatus !== 'agent_joined') {
            showWaitingForAgentNotice();
          }
          break;
        }
        case 'typing_start': {
          showAgentTyping();
          break;
        }
        case 'typing_stop': {
          hideAgentTyping();
          break;
        }
        case 'message_delivered': {
          // Backend confirms visitor messages were delivered to the agent.
          // Flip a ✓ indicator on the corresponding user bubbles.
          if (event.direction === 'visitor') {
            markVisitorMessagesDelivered(
              Array.isArray(event.message_ids) ? event.message_ids.length : 1
            );
          }
          break;
        }
        case 'messages_read': {
          // Agent read visitor messages — flip ✓ to ✓✓ on all visitor bubbles
          markAllVisitorMessagesRead();
          break;
        }
        case 'ping': {
          wsSend({ type: 'pong' });
          break;
        }
      }
    });

    liveWs.addEventListener('close', () => {
      wsConnecting = false;
      wsConnected = false;
      wsAuthenticated = false; // W2: WS is gone, upgrade polling cadence
      visitorIsTyping = false; // W11: reset typing state so next keystroke sends typing_start
      liveWs = null;
      // Fallback to faster polling while disconnected
      restartAgentPollingWithCurrentInterval();
      // Reconnect with exponential backoff only when live chat is active
      scheduleWsReconnect();
    });

    liveWs.addEventListener('error', () => {
      wsConnecting = false;
      wsAuthenticated = false; // W2
      // close event will follow; nothing extra needed here
    });
  }

  function scheduleWsReconnect() {
    if (!liveSettings.show_request_button) return;
    if (!liveHeartbeatStarted) return; // no session yet
    if (wsReconnectTimer) return;
    // W3: whenever we schedule a reconnect, we no longer consider the WS
    // authenticated — safety-net polling must take over.
    wsAuthenticated = false;
    // W3: jittered backoff (±50%) to avoid thundering-herd reconnects
    // after a shared outage, with a cap raised from 10 s to 30 s.
    const base = wsReconnectDelay;
    const jittered = Math.floor(base * (0.5 + Math.random()));
    wsReconnectTimer = setTimeout(() => {
      wsReconnectTimer = null;
      wsReconnectDelay = Math.min(wsReconnectDelay * 2, 30000);
      connectLiveWs();
    }, jittered);
  }

  function wsSend(payload) {
    if (liveWs && liveWs.readyState === WebSocket.OPEN) {
      liveWs.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }

  // Task 3: Message acknowledgment — WS first, HTTP fallback
  function sendMessageAck(messageIds) {
    const sent = wsSend({ type: 'message_ack', session_id: sessionId, message_ids: messageIds });
    if (!sent) {
      // HTTP fallback when WS is closed
      const tok = getStoredSessionToken();
      const body = { message_ids: messageIds };
      if (tok) body.session_token = tok;
      fetch(`https://portal.ultimo-bots.com/api/live/ack/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((res) => {
        if (res && res.status === 401) resetLiveSessionForAuthFailure();
      }).catch(() => { /* best-effort */ });
    }
  }

  // Handshake: tell the backend that the visitor has seen the agent-joined
  // notification so the portal's "Connecting..." state can unblock.
  //
  // We intentionally do NOT suppress duplicate sends across a session — each
  // fresh /live/join (including rejoins on the same session_id) needs a new
  // join_ack because the portal arms a new 10s timer. To avoid WS spam when
  // this is called from multiple sources in the same tick (widget_init_ack
  // + live_agent_joined + heartbeat), we debounce within a short window.
  let lastJoinAckAt = 0;
  const JOIN_ACK_DEBOUNCE_MS = 500;
  function sendJoinAck() {
    const now = Date.now();
    if (now - lastJoinAckAt < JOIN_ACK_DEBOUNCE_MS) return;
    lastJoinAckAt = now;
    joinAckSent = true;
    const payload = { type: 'join_ack', session_id: sessionId, bot_id: botId };
    if (wsSend(payload)) return;
    // WS not open — ensure a connect attempt is in flight and retry shortly
    connectLiveWs();
    let tries = 0;
    const retry = () => {
      tries += 1;
      if (wsSend(payload)) return;
      if (tries < 10) setTimeout(retry, 300);
    };
    setTimeout(retry, 300);
  }

  // ── Agent-connected bar (below header) ──
  function showAgentBar(agentName) {
    const bar = chatWindow.querySelector('.saicf-agent-bar');
    if (!bar) return;
    const nameEl = bar.querySelector('.saicf-agent-bar-name');
    if (nameEl) nameEl.textContent = agentName || 'Agent';
    bar.removeAttribute('hidden');
    bar.classList.add('is-visible');
  }

  function hideAgentBar() {
    const bar = chatWindow.querySelector('.saicf-agent-bar');
    if (!bar) return;
    bar.setAttribute('hidden', '');
    bar.classList.remove('is-visible');
  }

  // Mark the oldest N user bubbles that don't yet have a delivery tick with ✓.
  // This is an ordering heuristic (widget doesn't know DB ids) — in practice the
  // agent acks arrive in the same order as the visitor sends, so this is safe.
  function markVisitorMessagesDelivered(count) {
    if (!count || count < 1) count = 1;
    const bubbles = chatBody.querySelectorAll(
      '.saicf-message-row.user .saicf-widget-message:not([data-delivery])'
    );
    let applied = 0;
    for (let i = 0; i < bubbles.length && applied < count; i++) {
      applyDeliveryTick(bubbles[i], 'delivered');
      applied += 1;
    }
  }

  function markAllVisitorMessagesRead() {
    const bubbles = chatBody.querySelectorAll(
      '.saicf-message-row.user .saicf-widget-message'
    );
    bubbles.forEach(b => applyDeliveryTick(b, 'read'));
  }

  function applyDeliveryTick(bubble, state) {
    // state: 'delivered' | 'read'
    // Idempotent: never downgrade read → delivered
    const current = bubble.getAttribute('data-delivery');
    if (current === 'read' && state !== 'read') return;
    bubble.setAttribute('data-delivery', state);
    // Place the tick OUTSIDE the bubble as a sibling inside the row, so it
    // appears right-aligned directly below the user message.
    const row = bubble.closest('.saicf-message-row');
    const host = row || bubble.parentNode;
    let tick = host ? host.querySelector(':scope > .saicf-msg-tick') : null;
    // Clean up any legacy tick rendered inside the bubble itself.
    const legacyTick = bubble.querySelector(':scope > .saicf-msg-tick');
    if (legacyTick) legacyTick.remove();
    if (!tick) {
      tick = document.createElement('span');
      tick.className = 'saicf-msg-tick';
      if (host) host.appendChild(tick);
    }
    tick.textContent = state === 'read' ? '✓✓' : '✓';
    tick.classList.toggle('read', state === 'read');
  }

  // Agent typing indicator DOM helpers
  function showAgentTyping() {
    // Always (re)arm the safety auto-hide timer — covers dropped
    // `typing_stop` events (network hiccup, agent tab closed without
    // emitting stop, backend missed sending one). Keep this generous so
    // the indicator does not flicker during natural typing pauses, but
    // short enough that a stuck indicator clears itself within ~10s.
    if (agentTypingTimer) { clearTimeout(agentTypingTimer); }
    agentTypingTimer = setTimeout(() => { hideAgentTyping(); }, 10000);
    if (agentTypingRow && agentTypingRow.isConnected) return;
    agentTypingRow = document.createElement('div');
    agentTypingRow.className = 'saicf-agent-typing-row';
    agentTypingRow.innerHTML = '<div class="saicf-agent-typing-bubble"><span class="saicf-typing-dot"></span><span class="saicf-typing-dot"></span><span class="saicf-typing-dot"></span></div>';
    chatBody.insertBefore(agentTypingRow, bottomSpacerEl);
    scrollToBottom();
  }

  function hideAgentTyping() {
    if (agentTypingTimer) { clearTimeout(agentTypingTimer); agentTypingTimer = null; }
    if (agentTypingRow && agentTypingRow.isConnected) {
      agentTypingRow.remove();
    }
    agentTypingRow = null;
  }

  // ── Dynamic polling interval helper ──
  // W2: once the WS handshake completes (wsAuthenticated) the WS becomes
  // the primary delivery channel and the HTTP poll is just a safety net,
  // so run it every 30 s. Fall back to 5 s when the WS is merely connected
  // but not authenticated, and 2 s when WS is down entirely.
  function currentPollInterval() {
    if (wsAuthenticated) return 30000;
    if (wsConnected) return 5000;
    return 2000;
  }

  function restartAgentPollingWithCurrentInterval() {
    if (!agentPollInterval) return; // not polling — nothing to restart
    stopAgentPolling();
    startAgentPolling(false); // don't re-trigger WS connect during interval adjustment
  }

  // ── Live chat: Request Agent menu item ──
  const requestAgentBtn = chatWindow.querySelector('.saicf-menu-item--agent');
  // Inline CTA below the chat that mirrors the menu item — easier to
  // discover than the three-dots menu. Forwards clicks to the menu button
  // so all request / waiting / disconnect logic stays in one place.
  const requestAgentCtaBtn = chatWindow.querySelector('.saicf-live-cta-btn');
  const requestAgentCtaLabel = requestAgentCtaBtn?.querySelector('.saicf-live-cta-btn-label');
  if (requestAgentCtaBtn && requestAgentBtn) {
    requestAgentCtaBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (requestAgentCtaBtn.classList.contains('is-disabled')) return;
      requestAgentBtn.click();
    });
    // Mirror the menu button's text + disabled state so the CTA reflects
    // "Talk to a human" → "Waiting for agent…" → back to default automatically
    // without us having to touch every existing call site that mutates the
    // menu button.
    const ctaRow = requestAgentCtaBtn.closest('.saicf-live-cta-row');
    const syncCtaFromMenu = () => {
      if (!requestAgentCtaLabel) return;
      const menuLabel = (requestAgentBtn.textContent || '').trim();
      if (menuLabel) requestAgentCtaLabel.textContent = menuLabel;
      const disabled = requestAgentBtn.classList.contains('is-disabled');
      requestAgentCtaBtn.classList.toggle('is-disabled', disabled);
      requestAgentCtaBtn.disabled = disabled;
      // Hide the inline CTA whenever the menu action is in a non-default
      // state ("Waiting for agent…" or "Disconnect Agent"). The system
      // notice already shows a waiting animation, and disconnect stays
      // available in the three-dots menu — no need to waste chat-window
      // space on a redundant button.
      if (ctaRow) {
        const isDisconnect = liveSessionStatus === 'agent_joined';
        ctaRow.classList.toggle('hidden', isDisconnect || disabled);
      }
    };
    syncCtaFromMenu();
    const ctaObserver = new MutationObserver(syncCtaFromMenu);
    ctaObserver.observe(requestAgentBtn, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      characterData: true,
      subtree: true,
    });
  }
  if (requestAgentBtn) {
    requestAgentBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      toggleMenu(false);
      // If an agent is currently joined, this button acts as "Disconnect Agent".
      if (liveSessionStatus === 'agent_joined') {
        showDisconnectAgentConfirm();
        return;
      }
      if (agentRequestPending) return;
      requestAgentBtn.classList.add('is-disabled');
      agentRequestPending = true;
      try {
        // Check if any agent is currently online before requesting
        const availRes = await fetch(`https://portal.ultimo-bots.com/api/live/agent_available/${botId}`);
        if (availRes.ok) {
          const availData = await availRes.json();
          if (!availData.available) {
            appendSystemNotice('No agent available. Please use the AI assistant.');
            requestAgentBtn.classList.remove('is-disabled');
            agentRequestPending = false;
            return;
          }
        }
        // Ensure a live session exists before requesting an agent
        if (!liveHeartbeatStarted) {
          liveHeartbeatStarted = true;
          await sendHeartbeat();
          startHeartbeat();
        }
        let res = await fetch('https://portal.ultimo-bots.com/api/live/request_agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            bot_id: botId,
            session_token: getStoredSessionToken(),
          }),
        });
        // Defensive: if the stored session is stale/ended (e.g. the previous
        // tab's beforeunload disconnected it), regenerate a fresh session
        // and retry once. Also clear the stale token so the next heartbeat
        // mints a fresh one bound to the new session_id.
        if (res.status === 400 || res.status === 401) {
          setStoredSessionToken(null);
          sessionId = generateSessionId();
          sessionStorage.setItem(`sessionId-${botId}`, sessionId);
          try { await sendHeartbeat(); } catch { /* non-fatal */ }
          res = await fetch('https://portal.ultimo-bots.com/api/live/request_agent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sessionId,
              bot_id: botId,
              session_token: getStoredSessionToken(),
            }),
          });
        }
        if (res.ok) {
          showWaitingForAgentNotice();
        } else {
          requestAgentBtn.classList.remove('is-disabled');
          agentRequestPending = false;
        }
      } catch (err) {
        console.error('Request agent failed:', err);
        requestAgentBtn.classList.remove('is-disabled');
        agentRequestPending = false;
      }
    });
  }

  // ── Live chat: Render "waiting for agent" UI (shared by menu-button click
  // and AI-tool-triggered `live_agent_requested` WS event) ──
  function showWaitingForAgentNotice() {
    // Idempotent: if a waiting notice is already on screen, do nothing.
    if (chatBody.querySelector('.saicf-cancel-request')) return;
    liveSessionStatus = 'agent_requested';
    agentRequestPending = true;
    // Kill AI-mode spacer (it pins the last user message near the top which
    // would push the waiting notice out of view while the bot's "typing…"
    // loading row is still on screen). In live mode we scroll-to-bottom
    // instead, like the agent_joined branch does.
    if (bottomSpacerEl) bottomSpacerEl.style.height = '0px';
    spacerActive = false;
    pendingUserScroll = false;
    if (requestAgentBtn) {
      const svgMarkup = requestAgentBtn.querySelector('svg')?.outerHTML || '';
      requestAgentBtn.innerHTML = svgMarkup + ' Waiting for agent…';
      requestAgentBtn.classList.add('is-disabled');
    }
    const waitingNotice = appendSystemNotice('You requested a live agent. Please wait', {
      waiting: true,
      onCancel: async (notice) => {
        try {
          const tok = getStoredSessionToken();
          const cancelBody = { session_id: sessionId };
          if (tok) cancelBody.session_token = tok;
          const cancelRes = await fetch('https://portal.ultimo-bots.com/api/live/cancel_request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cancelBody),
          });
          if (cancelRes && cancelRes.status === 401) {
            resetLiveSessionForAuthFailure();
          }
        } catch {}
        notice.remove();
        liveSessionStatus = 'active';
        agentRequestPending = false;
        stopAgentPolling();
        if (requestAgentBtn) {
          const svgMarkup = requestAgentBtn.querySelector('svg')?.outerHTML || '';
          requestAgentBtn.innerHTML = svgMarkup + ` ${liveSettings.request_button_text || 'Talk to a human'}`;
          requestAgentBtn.classList.remove('is-disabled');
        }
        appendSystemNotice('Agent request cancelled.');
      },
    });
    // If a bot "typing…" loading indicator is still on screen (e.g. the
    // live_agent_requested event arrived while generate_response was still
    // streaming), make sure it renders *below* the waiting-for-agent notice
    // rather than above it. The loading row was appended earlier so it sits
    // higher in the DOM; move it to just after the notice.
    const loadingRow = chatBody.querySelector('.saicf-loading-row');
    if (loadingRow && waitingNotice && waitingNotice.parentNode === chatBody) {
      chatBody.insertBefore(loadingRow, waitingNotice.nextSibling);
    }
    scrollToBottomHard();
    startAgentPolling();
  }

  // ── Live chat: Confirm disconnecting from a joined agent. Reuses the same
  // confirm modal styles as the clear-chat dialog. Only disconnects the live
  // agent (session stays alive, chat history is kept). ──
  function showDisconnectAgentConfirm() {
    if (chatWindow.querySelector('.saicf-confirm-overlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'saicf-confirm-overlay';
    overlay.innerHTML = `
      <div class="saicf-confirm-box">
        <p>Disconnect from the live agent? Your chat will be kept.</p>
        <div class="saicf-confirm-actions">
          <button class="saicf-confirm-cancel">Cancel</button>
          <button class="saicf-confirm-ok">Disconnect</button>
        </div>
      </div>
    `;
    overlay.querySelector('.saicf-confirm-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('.saicf-confirm-ok').addEventListener('click', async () => {
      overlay.remove();
      try {
        const tok = getStoredSessionToken();
        const cancelBody = { session_id: sessionId };
        if (tok) cancelBody.session_token = tok;
        const cancelRes = await fetch('https://portal.ultimo-bots.com/api/live/cancel_request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cancelBody),
        });
        if (cancelRes && cancelRes.status === 401) {
          resetLiveSessionForAuthFailure();
        }
      } catch { /* non-fatal — WS event will still arrive once backend processes */ }
      // Optimistic local transition. If the backend WS `live_agent_left`
      // event arrives afterwards, setLiveSessionStatusFn is a no-op (state
      // already 'active').
      if (liveSessionStatus === 'agent_joined') {
        setLiveSessionStatusFn('active');
      }
    });
    chatWindow.appendChild(overlay);
  }

  // ── Live chat: System notice helper ──
  function appendSystemNotice(text, { waiting = false, onCancel = null } = {}) {
    const notice = document.createElement('div');
    notice.className = 'saicf-system-notice';
    const span = document.createElement('span');
    span.className = 'saicf-system-notice-text';
    span.textContent = text;
    if (waiting) {
      for (let i = 0; i < 3; i++) {
        const dot = document.createElement('span');
        dot.className = 'saicf-waiting-dot';
        span.appendChild(dot);
      }
    }
    notice.appendChild(span);
    if (onCancel) {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'saicf-cancel-request';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', () => onCancel(notice));
      notice.appendChild(cancelBtn);
    }
    chatBody.insertBefore(notice, bottomSpacerEl);
    scrollToBottom();
    return notice;
  }

  // ── Live chat: Centralized status transition (W6) ──
  function setLiveSessionStatusFn(newStatus) {
    // Handshake: regardless of whether we're transitioning or already in
    // agent_joined state, every "agent joined" signal from the backend is a
    // reason to re-ack the portal. This makes leave→rejoin cycles robust
    // even when our local status is stale.
    if (newStatus === 'agent_joined') {
      sendJoinAck();
    }
    if (newStatus === liveSessionStatus) return;
    const prev = liveSessionStatus;
    liveSessionStatus = newStatus;

    if (newStatus === 'agent_joined' && prev !== 'agent_joined') {
      // Remove the waiting notice with cancel button
      const waitingCancel = chatBody.querySelector('.saicf-cancel-request');
      if (waitingCancel) waitingCancel.closest('.saicf-system-notice')?.remove();

      // Immediately kill AI-mode spacer so live scroll-to-bottom works
      if (bottomSpacerEl) bottomSpacerEl.style.height = '0px';
      spacerActive = false;
      pendingUserScroll = false;

      const agentName = effectiveAgentDisplayName('A live agent');
      // Guard: if the agent_joined signal arrives before welcome messages
      // have been rendered (e.g. widget_init_ack on a restored session while
      // the history/welcome render is still pending), the system notice
      // would appear above the welcome message. Render welcome first.
      //
      // BUT: if sessionStorage already has saved chat history, don't inject
      // welcome messages — the eager loadChatHistory() at module init will
      // restore them. Injecting welcome here would cause the later history
      // restore to be skipped (empty-chatBody guard) and the real chat log
      // would be lost after a refresh while an agent is joined.
      if (
        chatBody.querySelectorAll('.saicf-message-row').length === 0 &&
        !sessionStorage.getItem(`chat-history-${botId}`) &&
        Array.isArray(welcomeMessages) && welcomeMessages.length
      ) {
        welcomeMessages.forEach(msg => appendMessage(msg, 'bot', { skipSave: true }));
      }
      // Skip re-appending the join notice only if the most recent system
      // notice in the conversation is already this same "has joined" line.
      // This prevents `widget_init_ack` replays (page reloads) from pushing
      // a fresh join notice to the bottom, while still allowing a real
      // leave → rejoin cycle to show a new join notice after the "has left"
      // line that came before it.
      const joinNoticeText = `${agentName} has joined the chat.`;
      const allNotices = chatBody.querySelectorAll('.saicf-system-notice .saicf-system-notice-text');
      const lastNotice = allNotices.length ? allNotices[allNotices.length - 1] : null;
      const alreadyShown = lastNotice && lastNotice.textContent === joinNoticeText;
      if (!alreadyShown) {
        appendSystemNotice(joinNoticeText);
        // Persist the new notice so a future reload doesn't duplicate it.
        try { saveChatHistory(); } catch {}
      }
      showAgentBar(agentName);
      scrollToBottomHard();
      startAgentPolling();
      // Handshake: tell the portal we saw the agent join (unblocks Connecting…)
      sendJoinAck();
      if (requestAgentBtn) {
        const svgMarkup = requestAgentBtn.querySelector('svg')?.outerHTML || '';
        requestAgentBtn.innerHTML = svgMarkup + ' Disconnect Agent';
        requestAgentBtn.classList.remove('is-disabled');
      }
    } else if (newStatus === 'active' && prev === 'agent_joined') {
      const agentName = effectiveAgentDisplayName('The live agent');
      appendSystemNotice(`${agentName} has left the chat.`);
      try { saveChatHistory(); } catch {}
      hideAgentBar();
      scrollToBottomHard();
      stopAgentPolling();
      agentRequestPending = false;
      // Reset per-session agent name so the next join starts clean.
      currentAgentDisplayName = null;
      // Reset handshake so the next join triggers a fresh ack
      joinAckSent = false;
      if (requestAgentBtn) {
        const svgMarkup = requestAgentBtn.querySelector('svg')?.outerHTML || '';
        requestAgentBtn.innerHTML = svgMarkup + ` ${liveSettings.request_button_text || 'Talk to a human'}`;
        requestAgentBtn.classList.remove('is-disabled');
      }
    } else if (newStatus === 'active' && prev === 'agent_requested') {
      // Agent request timed out (or was reverted server-side). No agent
      // ever joined, so don't render "X has left the chat". Instead remove
      // the waiting notice, inform the visitor, and surface the configured
      // offline_message as a bot fallback if one is set.
      const waitingCancel = chatBody.querySelector('.saicf-cancel-request');
      if (waitingCancel) waitingCancel.closest('.saicf-system-notice')?.remove();
      appendSystemNotice('No agent responded in time. Your request was cancelled.');
      const offlineMsg = (liveSettings && liveSettings.offline_message) || '';
      if (offlineMsg) {
        appendMessage(offlineMsg, 'bot');
      }
      stopAgentPolling();
      agentRequestPending = false;
      if (requestAgentBtn) {
        const svgMarkup = requestAgentBtn.querySelector('svg')?.outerHTML || '';
        requestAgentBtn.innerHTML = svgMarkup + ` ${liveSettings.request_button_text || 'Talk to a human'}`;
        requestAgentBtn.classList.remove('is-disabled');
      }
    }
  }

  // ── Live chat: Heartbeat ──
  function startHeartbeat() {
    if (heartbeatInterval) return;
    // Open the live WS proactively. The backend uses it to push `live_agent_joined`
    // the instant the portal agent clicks Join. Without this, a visitor who never
    // clicked "Talk to human" only learns about an agent join via the 15s heartbeat
    // poll — causing the portal's "Connecting…" state to stall for ~15s on first join.
    try { connectLiveWs(); } catch (_) { /* best-effort */ }
    sendHeartbeat(); // fire immediately
    heartbeatInterval = setInterval(sendHeartbeat, 15000);
  }

  function stopHeartbeat() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  }

  // W4: slow heartbeat while the tab is hidden but the visitor has an
  // agent-related session that must stay alive. The server now keeps
  // agent_requested / agent_joined sessions for up to 30 min, so a 60 s
  // cadence is plenty to prevent GC without draining the battery.
  function startSlowHiddenHeartbeat() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    // Do NOT fire immediately — the tab just went hidden and the last
    // foreground beat is still fresh. Let the interval take the next one.
    heartbeatInterval = setInterval(sendHeartbeat, 60000);
  }

  async function sendHeartbeat() {
    try {
      const storedToken = getStoredSessionToken();
      const body = {
        session_id: sessionId,
        bot_id: botId,
        visitor_name: 'Website Visitor',
        page_url: window.location.href,
      };
      if (storedToken) body.session_token = storedToken;
      const res = await fetch('https://portal.ultimo-bots.com/api/live/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      // W6: 401 → drop local state and let the widget re-bootstrap.
      if (res.status === 401) {
        resetLiveSessionForAuthFailure();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        // W6: persist the server-minted session_token on first receipt.
        if (data && data.session_token) {
          setStoredSessionToken(data.session_token);
        }
        if (data.session_status === 'agent_joined' || data.session_status === 'active') {
          setLiveSessionStatusFn(data.session_status);
        }
        // If agent joined and polling isn't running, start it immediately
        if (data.session_status === 'agent_joined' && !agentPollInterval) {
          startAgentPolling();
        }
      }
    } catch (err) {
      // Heartbeat is best-effort; don't break the widget
    }
  }

  // ── Live chat: Agent message polling ──
  async function startAgentPolling(connectWs = true) {
    if (agentPollInterval) return;

    // Connect WS immediately so real-time events arrive ASAP
    if (connectWs) connectLiveWs();

    // If lastAgentMessageId is 0 (page reload / first join), seed it with
    // the latest message ID so we don't re-display old messages.
    if (lastAgentMessageId === 0) {
      try {
        const tok = getStoredSessionToken();
        const seedUrl = `https://portal.ultimo-bots.com/api/live/messages/${sessionId}?after_id=0` +
          (tok ? `&session_token=${encodeURIComponent(tok)}` : '');
        const seedRes = await fetch(seedUrl);
        if (seedRes.status === 401) {
          resetLiveSessionForAuthFailure();
          return;
        }
        if (seedRes.ok) {
          const seedData = await seedRes.json();
          const msgs = seedData.messages || [];
          if (msgs.length > 0) {
            lastAgentMessageId = msgs[msgs.length - 1].id || 0;
          }
          // Check status from seed response — agent may have joined during fetch
          if (seedData.status && seedData.status !== liveSessionStatus) {
            setLiveSessionStatusFn(seedData.status);
          }
        }
      } catch (_) { /* best-effort */ }
    }

    // Guard again — seed await may have allowed another caller to start polling
    if (agentPollInterval) return;

    pollAgentMessages(); // fire immediately
    agentPollInterval = setInterval(pollAgentMessages, currentPollInterval());
  }

  function stopAgentPolling() {
    if (agentPollInterval) {
      clearInterval(agentPollInterval);
      agentPollInterval = null;
    }
  }

  async function pollAgentMessages() {
    try {
      const tok = getStoredSessionToken();
      const url = `https://portal.ultimo-bots.com/api/live/messages/${sessionId}?after_id=${lastAgentMessageId}` +
        (tok ? `&session_token=${encodeURIComponent(tok)}` : '');
      const res = await fetch(url);
      if (res.status === 401) {
        resetLiveSessionForAuthFailure();
        return;
      }
      if (!res.ok) return;
      const data = await res.json();

      if (data.status === 'agent_joined' || data.status === 'active') {
        const prevPollStatus = liveSessionStatus;
        setLiveSessionStatusFn(data.status);
        if (data.status === 'active' && (prevPollStatus === 'agent_joined' || prevPollStatus === 'agent_requested')) {
          // Agent left — already handled by setLiveSessionStatusFn; stop polling
          return;
        }
      }

      const messages = data.messages || [];
      for (const msg of messages) {
        if (msg.id && msg.id <= lastAgentMessageId) continue; // skip already-seen
        if (msg.type === 'agent' && msg.content) {
          appendMessage(msg.content, 'agent');
        }
        if (msg.id && msg.id > lastAgentMessageId) {
          lastAgentMessageId = msg.id;
        }
      }
    } catch (err) {
      // Polling errors are non-fatal
    }
  }

  // Start heartbeat on reload only if user already has an active conversation.
  // Heartbeat drives session creation in the portal and is what powers the
  // "new visitor" / "new message" notifications — it must run regardless of
  // whether any agent is currently online — we always want to track sessions.
  if (sessionStorage.getItem(`chat-history-${botId}`)) {
    liveHeartbeatStarted = true;
    // Eagerly restore chat history BEFORE opening the WS. Otherwise the
    // backend's `widget_init_ack` (session_status='agent_joined') can arrive
    // while chatBody is still empty and the agent-joined transition in
    // setLiveSessionStatusFn would inject welcome messages on top of an
    // empty body — which then blocks a later loadChatHistory() call because
    // the "is chatBody empty?" guard no longer matches.
    loadChatHistory().catch(() => { /* non-fatal */ });
    startHeartbeat();
  }

  // ── Graceful handling on tab close / refresh / navigation ──
  // We intentionally do NOT send /api/live/disconnect here. A `beforeunload`
  // can mean "refresh", "same-tab navigation" or "tab closed" — we can't tell
  // them apart reliably. Forcing the session to `ended` immediately kicks the
  // connected agent out on every F5, which is user-hostile.
  //
  // Instead we let the backend's heartbeat-timeout mechanism decide:
  //   - Refresh: heartbeat resumes within ~1–2s → session stays alive.
  //   - Real close: heartbeat stops → `cleanup_stale` ends the session after
  //     the configured timeout → portal sees it vanish naturally.
  // Explicit disconnects (Clear chat) still call /api/live/disconnect.
  window.addEventListener('beforeunload', () => {
    stopHeartbeat();
    if (liveHeartbeatStarted) {
      // Close WS cleanly so backend onclose fires; session row is untouched.
      if (liveWs && liveWs.readyState === WebSocket.OPEN) {
        try { liveWs.close(); } catch { /* non-fatal */ }
      }
    }
  });

  // ── Pause/resume on tab visibility change ──
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // W1: also pause the safety-net agent poll while hidden — otherwise a
      // backgrounded tab keeps hammering /api/live/messages every 2–5 s.
      stopAgentPolling();
      // W4: if a live agent is waiting / connected, the server keeps the
      // session alive for up to 30 min — so we keep a slow 60 s heartbeat
      // going instead of stopping entirely. In plain AI mode we can still
      // take the full 45 s cleanup without hurting anyone.
      if (
        liveHeartbeatStarted &&
        (liveSessionStatus === 'agent_requested' ||
         liveSessionStatus === 'agent_joined')
      ) {
        startSlowHiddenHeartbeat();
      } else {
        stopHeartbeat();
      }
    } else {
      // W4: restore the normal 15 s cadence on return to foreground,
      // regardless of whether we were on the slow path or stopped.
      if (liveHeartbeatStarted) {
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
        startHeartbeat();
      }
      // W3: don't bypass the jittered backoff on focus — funnel through
      // scheduleWsReconnect so a thundering-herd on shared outages is
      // naturally staggered. Skip if a connect is already in flight.
      if (
        liveHeartbeatStarted &&
        (!liveWs || liveWs.readyState === WebSocket.CLOSED)
      ) {
        scheduleWsReconnect();
      }
      // W15: restart polling if agent session is active
      if (liveSessionStatus === 'agent_requested' || liveSessionStatus === 'agent_joined') {
        startAgentPolling(false); // has its own guard, safe to call
      }
    }
  });

  chatWidgetIcon.addEventListener('click', async () => {
    // Desktop: the launcher stays visible while the chat is open and
    // acts as the close button (it shows the chevron face then).
    if (chatWindow.classList.contains('show')) {
      closeChat();
      return;
    }
    // Only load chat history if pre-chat is completed or not required
    if (!requirePreChat || preChatCompleted) {
      if (chatBody.querySelectorAll('.saicf-message-row').length === 0) {
        await loadChatHistory();
        if (chatBody.querySelectorAll('.saicf-message-row').length === 0) {
          await ensureMarked();
          welcomeMessages.forEach(msg => appendMessage(msg, 'bot', { skipSave: true }));
        }
      }
    }
    chatWindow.classList.remove('hidden');
    forceReflow(chatWindow);
    chatWindow.classList.add('show');
    chatOverlay.classList.remove('hidden');
    if (window.matchMedia('(max-width: 768px)').matches) {
      // Mobile: fullscreen window, launcher hidden underneath.
      chatWidgetIcon.classList.add('hidden');
      document.body.classList.add('no-scroll');
    } else {
      // Desktop: window opens above the launcher, which flips to a
      // close chevron and acts as the close button.
      chatWidgetIcon.classList.add('saicf-icon-open');
    }
    widgetOpenedOnce = true;
    markPopUpSeen();
    hidePopUp();
    clearUnreadAgentMessages();
    // Ensure the newest message (e.g. an agent reply that arrived while the
    // widget was minimized) is visible on first view.
    requestAnimationFrame(() => scrollToBottom());
  });

  closeChatBtn.addEventListener('click', () => {
    closeChat();
  });

  sendMessageBtn.addEventListener('click', () => {
    if (isBusy) return;
    sendMessage();
  });

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isBusy) return;
      sendMessage();
    }
  });

  chatInput.addEventListener('input', () => {
    resizeTextarea(chatInput);
    // Visitor typing indicator — only send when live agent is active
    if (liveSessionStatus === 'agent_requested' || liveSessionStatus === 'agent_joined') {
      const hasText = chatInput.value.trim().length > 0;
      if (hasText && !visitorIsTyping) {
        visitorIsTyping = true;
        wsSend({ type: 'typing_start', session_id: sessionId });
      } else if (!hasText && visitorIsTyping) {
        visitorIsTyping = false;
        wsSend({ type: 'typing_stop', session_id: sessionId });
      }
    }
  });

  function resizeTextarea(el) {
    el.style.height = 'auto';
    const lineHeight = 24;
    const maxLines = 5;
    const padding = 20;
    const maxHeight = (lineHeight * maxLines) + padding;
    const minHeight = lineHeight + padding;
    const newHeight = el.value ? Math.min(el.scrollHeight, maxHeight) : minHeight;
    el.style.height = newHeight + 'px';
    if (el.scrollHeight > maxHeight) {
      el.classList.add('has-overflow');
    } else {
      el.classList.remove('has-overflow');
    }
  }

  popUpCloseBtn.addEventListener('click', e => {
    e.stopPropagation();
    hidePopUp();
    widgetOpenedOnce = true;
    markPopUpSeen();
  });

  function showPopUpSequentially() {
    if (widgetOpenedOnce || popUpSeen) return;
    popUpContainer.classList.remove('hidden');

    const msgs = popUpContainer.querySelectorAll('.saicf-pop-up-message');
    msgs.forEach((msg, i) => {
      setTimeout(() => {
        msg.classList.add('show');
        if (i === 0) {
          popUpCloseBtn.classList.add('show');
        }
      }, i * 1200);
    });
  }

  function hidePopUp() {
    popUpContainer.classList.add('hidden');
    popUpContainer.querySelectorAll('.saicf-pop-up-message')
                  .forEach(m => m.classList.remove('show'));
    popUpCloseBtn.classList.remove('show');
  }

  // ───────── Unread-agent-message handling ─────────
  // When the chat window is minimized/closed and a live agent sends a message,
  // we surface it both as an attention pop-up (reusing the pop-up container
  // styling) and as a red unread-count badge on the minimized icon.
  let unreadAgentCount = 0;

  function updateUnreadBadge() {
    if (unreadAgentCount > 0) {
      unreadBadge.textContent = unreadAgentCount > 99 ? '99+' : String(unreadAgentCount);
      unreadBadge.classList.remove('hidden');
    } else {
      unreadBadge.classList.add('hidden');
    }
  }

  function showAgentMessagePopUp(content) {
    // Cap the visible stack so it doesn't grow unbounded on long silences.
    const MAX_AGENT_POPUPS = 3;
    const existing = popUpContainer.querySelectorAll('.saicf-agent-pop-up');
    if (existing.length >= MAX_AGENT_POPUPS) {
      existing[0].remove();
    }

    // Collapse any non-agent welcome pop-up messages. They still occupy
    // layout space even when not `.show` (opacity:0, not display:none), which
    // pushed the close button visually far above the agent messages.
    popUpContainer
      .querySelectorAll('.saicf-pop-up-message:not(.saicf-agent-pop-up)')
      .forEach(n => { n.style.display = 'none'; });

    const msgEl = document.createElement('div');
    msgEl.className = 'saicf-pop-up-message saicf-agent-pop-up';
    // Truncate long agent messages in the pop-up preview so the widget
    // doesn't show a wall of text. The full message is already appended to
    // the chat body, so the visitor sees everything once they open the chat.
    const AGENT_POPUP_MAX_CHARS = 80;
    const preview = content.length > AGENT_POPUP_MAX_CHARS
      ? content.slice(0, AGENT_POPUP_MAX_CHARS).trimEnd() + '…'
      : content;
    // Use textContent to avoid injecting raw HTML from agent input.
    msgEl.textContent = preview;
    msgEl.addEventListener('click', () => {
      // Delegate to the existing icon click handler, which loads history,
      // opens the chat, and clears the unread state.
      chatWidgetIcon.click();
    });
    popUpContainer.appendChild(msgEl);
    popUpContainer.classList.remove('hidden');
    popUpCloseBtn.classList.add('show');
    // Animate in on next frame.
    requestAnimationFrame(() => msgEl.classList.add('show'));
  }

  function clearUnreadAgentMessages() {
    unreadAgentCount = 0;
    updateUnreadBadge();
    popUpContainer.querySelectorAll('.saicf-agent-pop-up').forEach(n => n.remove());
    // If nothing else is left in the pop-up container, collapse it.
    if (popUpContainer.querySelectorAll('.saicf-pop-up-message').length === 0) {
      popUpContainer.classList.add('hidden');
      popUpCloseBtn.classList.remove('show');
    }
  }

  if (popUpMessages) {
    setTimeout(showPopUpSequentially, popUpDelaySeconds * 1000);
  }

  function forceReflow(element) {
    void element.offsetHeight;
  }

  function closeChat() {
    chatWindow.classList.remove('show');
    chatWidgetIcon.classList.remove('hidden');
    chatWidgetIcon.classList.remove('saicf-icon-open');
    chatOverlay.classList.add('hidden');
    if (window.matchMedia('(max-width: 768px)').matches) {
      document.body.classList.remove('no-scroll');
    }
    // Drop the keyboard-fit vars: if the chat is closed while the
    // keyboard is open, the closing resize event is ignored (no .show)
    // and a stale shrunken height would stick until the next reopen.
    clearViewportFit();
    setTimeout(() => chatWindow.classList.add('hidden'), 300);
  }

  function generateSessionId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
      }
      // Fallback for very old browsers: 128 bits of randomness hex-encoded
      const buf = new Uint8Array(16);
      (window.crypto || window.msCrypto).getRandomValues(buf);
      return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      // Absolute last resort (should never hit in a modern browser)
      return 'sid-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    }
  }

  async function sendMessage() {
    if (isBusy) return;

    const message = chatInput.value.trim();
    if (!message) return;

    // Start live session heartbeat on first user message. Heartbeat is the
    // sole trigger for portal-side "new visitor" notifications, so we start
    // it independently of agent online presence.
    if (!liveHeartbeatStarted) {
      liveHeartbeatStarted = true;
      startHeartbeat();
    }

    // Set up scroll positioning flags
    pendingUserScroll = true;
    isStreamingState = true;
    userScrolledAway = false;

    appendMessage(message, 'user', { skipScroll: true });
    chatInput.value = '';
    resizeTextarea(chatInput);
    // Stop visitor typing indicator when message is sent
    if (visitorIsTyping) {
      visitorIsTyping = false;
      if (visitorTypingTimer) { clearTimeout(visitorTypingTimer); visitorTypingTimer = null; }
      wsSend({ type: 'typing_stop', session_id: sessionId });
    }

    // During agent_requested or agent_joined: forward to backend so the
    // visitor message is persisted to chat_history and pushed to the portal
    // via the live WS channel. The backend (generate_response) detects the
    // live session state, saves the user_input, publishes a
    // `live_visitor_message` event, and skips AI generation. Without this
    // call the message would only live in widget localStorage and the agent
    // would never see it after joining.
    if (liveSessionStatus === 'agent_requested' || liveSessionStatus === 'agent_joined') {
      const url =
        `https://portal.ultimo-bots.com/api/chatbot_response?` +
        `user_input=${encodeURIComponent(message)}` +
        `&session_id=${sessionId}&bot_id=${botId}&language=english`;
      fetch(url).catch(() => {}); // fire-and-forget
      saveChatHistory();
      scrollToBottom();
      isStreamingState = false;
      pendingUserScroll = false;
      return;
    }

    // Safety net: if we reach the AI path, no live agent is connected. Make
    // sure the "<agent> is connected" bar isn't lingering from a stale state
    // (e.g. missed `live_agent_left` during a WS disconnect).
    hideAgentBar();

    setBusy(true);
    setLoading(true);

    // Trigger positioning after DOM is updated
    doPositioning();

    let currentBotMessage = '';
    let currentBotProducts = null;
    resetStreamingBotMessage();

    const url =
      `https://portal.ultimo-bots.com/api/chatbot_response?` +
      `user_input=${encodeURIComponent(message)}` +
      `&session_id=${sessionId}&bot_id=${botId}&language=english`;

    const finish = () => {
      setLoading(false);
      setBusy(false);
      isStreamingState = false;
      saveChatHistory();
      resetStreamingBotMessage();
      recalcSpacer();
      updateScrollDownVisibility();
    };

    // Error messages for different error types
    const ERROR_MESSAGES = {
      rate_limit: 'Too many requests. Please wait a moment before trying again.',
      timeout: 'Sorry, the server took too long to respond. Please try again.',
      internal_error: 'Something went wrong. Please try again later.',
      validation_error: 'There was a problem with your request. Please try again.',
      bot_not_found: 'This chatbot is currently unavailable.',
      default: 'An unexpected error occurred. Please try again.'
    };

    return new Promise((resolve) => {
      const es = new EventSource(url);
      let firstChunk = true;
      let hasError = false;

      es.onmessage = ({ data: chunk }) => {
        if (chunk === 'end of response') return;
        if (firstChunk) {
          // If smooth scroll is still animating, snap to final position
          // BEFORE any DOM mutations. Removing loading dots drops
          // scrollHeight, causing the browser to clamp scrollTop
          // synchronously — disrupting the animation and shifting the
          // user message down. By snapping first, we own the scrollTop
          // value and recalcSpacer can re-anchor correctly.
          if (programmaticScroll && !userScrolledAway) {
            programmaticScroll = false;
            smoothScrollTarget = null;
            const allUserMsgs = chatBody.querySelectorAll('.saicf-message-row.user');
            const lastUserMsg = allUserMsgs[allUserMsgs.length - 1];
            if (lastUserMsg) {
              ignoreScrollEvents = true;
              chatBody.scrollTop = lastUserMsg.offsetTop - TOP_MARGIN;
              requestAnimationFrame(() => { ignoreScrollEvents = false; });
            }
          } else if (programmaticScroll) {
            // User scrolled away — just cancel the smooth scroll,
            // don't snap them back to the user message.
            programmaticScroll = false;
            smoothScrollTarget = null;
          }
          setLoading(false);
          firstChunk = false;
        }
        currentBotMessage += chunk.replace(/<newline>/g, '\n');
        updateStreamingBotMessage(currentBotMessage);
      };

      // Structured product cards ride a dedicated SSE event so the text stream
      // stays pure markdown. They normally arrive after the answer text; attach
      // them to the current bot reply so the gallery renders under the text.
      es.addEventListener('products', ({ data }) => {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed.products) && parsed.products.length > 0) {
            currentBotProducts = parsed.products;
            attachProductsToStreamingRow(currentBotProducts);
          }
        } catch (err) {
          console.warn('Could not parse products event:', err);
        }
      });

      es.addEventListener('end', () => {
        if (!hasError) {
          if (currentBotMessage) {
            updateStreamingBotMessage(currentBotMessage);
          } else if (streamingBotRow && currentBotProducts) {
            // Products-only reply: drop the empty text bubble, keep the gallery.
            const emptyBubble = streamingBotRow.querySelector('.widget-bot-message');
            if (emptyBubble && !emptyBubble.textContent.trim()) emptyBubble.remove();
          } else {
            // No bot content — remove streaming placeholder without creating an empty bubble
            resetStreamingBotMessage();
          }
        }
        es.close();
        finish();
        resolve();
      });

      es.addEventListener('error', (e) => {
        hasError = true;
        es.close();
        resetStreamingBotMessage();

        // Parse the error data (now sent as JSON)
        let errorType = 'default';
        let errorMessage = ERROR_MESSAGES.default;

        try {
          if (e?.data) {
            // Handle legacy format (plain string)
            if (e.data === 'Timeout while generating response') {
              errorType = 'timeout';
            } else if (e.data === 'Internal server error') {
              errorType = 'internal_error';
            } else {
              // Try to parse as JSON (new format)
              const errorData = JSON.parse(e.data);
              errorType = errorData.type || 'default';
            }
            errorMessage = ERROR_MESSAGES[errorType] || ERROR_MESSAGES.default;
          }
        } catch (parseError) {
          // If JSON parsing fails, use default error message
          console.warn('Could not parse error data:', e?.data);
        }

        appendMessage(errorMessage, 'bot');
        finish();
        resolve();
      });

      // Handle EventSource connection errors (network issues, etc.)
      es.onerror = (e) => {
        // Only handle if not already handled by 'error' event listener
        if (hasError) return;

        // EventSource will auto-reconnect by default - we don't want that for errors
        if (es.readyState === EventSource.CLOSED) {
          hasError = true;
          resetStreamingBotMessage();
          appendMessage(ERROR_MESSAGES.default, 'bot');
          finish();
          resolve();
        } else if (es.readyState === EventSource.CONNECTING) {
          // Connection lost, close and show error
          hasError = true;
          es.close();
          resetStreamingBotMessage();
          appendMessage('Connection lost. Please try again.', 'bot');
          finish();
          resolve();
        }
      };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // In-chat product gallery (vanilla port of the portal's ProductCarousel.js).
  // Reads the card shape produced by the backend
  // (src/controller/products.py _product_card_from_product): title, price,
  // currency, image_url, url, availability, attributes — and never assumes any
  // specific attribute keys, so it works for any kind of product.
  // ─────────────────────────────────────────────────────────────────────────

  const PC_ICON_CHEVRON_LEFT =
    '<svg viewBox="0 0 320 512" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l192 192c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256 246.6 86.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-192 192z"/></svg>';
  const PC_ICON_CHEVRON_RIGHT =
    '<svg viewBox="0 0 320 512" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256 73.4 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z"/></svg>';
  const PC_ICON_BOX =
    '<svg viewBox="0 0 448 512" width="30" height="30" aria-hidden="true"><path fill="currentColor" d="M50.7 58.5 0 160l208 0 0-128L93.7 32C75.5 32 58.9 42.3 50.7 58.5zM240 32l0 128 208 0L397.3 58.5C389.1 42.3 372.5 32 354.3 32L240 32zM448 192L0 192 0 416c0 35.3 28.7 64 64 64l320 0c35.3 0 64-28.7 64-64l0-224z"/></svg>';
  const PC_ICON_EXTLINK =
    '<svg viewBox="0 0 512 512" width="9" height="9" aria-hidden="true"><path fill="currentColor" d="M352 0c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9L370.7 96 201.4 265.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L416 141.3l41.4 41.4c9.2 9.2 22.9 11.9 34.9 6.9s19.8-16.6 19.8-29.6l0-128c0-17.7-14.3-32-32-32L352 0zM80 32C35.8 32 0 67.8 0 112L0 432c0 44.2 35.8 80 80 80l320 0c44.2 0 80-35.8 80-80l0-112c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 112c0 8.8-7.2 16-16 16L80 448c-8.8 0-16-7.2-16-16l0-320c0-8.8 7.2-16 16-16l112 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L80 32z"/></svg>';

  function pcFormatPrice(price, currency) {
    if (price === null || price === undefined || price === '') return null;
    const num = typeof price === 'number' ? price : parseFloat(price);
    if (Number.isNaN(num)) return null;
    const hasCents = Math.abs(num % 1) > 0.001;
    const formatted = num.toLocaleString(undefined, {
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: 2,
    });
    return currency ? `${formatted} ${currency}` : formatted;
  }

  // "storage_gb" -> "storage", "frame_size_cm" -> "frame size".
  function pcPrettifyKey(k) {
    return String(k)
      .replace(/_(gb|tb|mb|mah|kg|g|cm|mm|inch|in|km|l|ml|ohm|bar|w|hz|mp|px)$/i, '')
      .replace(/_/g, ' ')
      .trim();
  }

  // A short, generic spec line: the first few attributes that aren't the brand
  // (shown separately) or redundant with the title.
  function pcBuildSpecs(attributes) {
    if (!attributes || typeof attributes !== 'object') return [];
    const skip = new Set(['brand', 'title', 'name', 'product_name']);
    return Object.entries(attributes)
      .filter(([k, v]) => !skip.has(String(k).toLowerCase()) && v !== null && v !== '' && v !== undefined)
      .slice(0, 3)
      .map(([k, v]) => `${pcPrettifyKey(k)} ${v}`.trim());
  }

  const PC_AVAILABILITY = {
    in_stock: 'In stock',
    out_of_stock: 'Out of stock',
    partially_out_of_stock: 'Limited availability',
    backorder: 'On backorder',
    on_backorder: 'On backorder',
  };

  // Map a raw availability enum to a friendly badge label; humanize anything
  // unrecognized so the badge never shows a raw machine enum.
  function pcFormatAvailability(value) {
    if (value === null || value === undefined || value === '') return null;
    const norm = String(value).trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (PC_AVAILABILITY[norm]) return PC_AVAILABILITY[norm];
    return String(value)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (ch) => ch.toUpperCase())
      .trim();
  }

  function pcBuildCard(product) {
    const href = product.url || product.product_url || null;
    const card = document.createElement(href ? 'a' : 'div');
    card.className = `ub-pc-card${href ? ' ub-pc-card-link' : ''}`;
    if (href) {
      card.href = href;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
    }

    const imgWrap = document.createElement('div');
    imgWrap.className = 'ub-pc-img';
    if (product.image_url) {
      const img = document.createElement('img');
      img.src = product.image_url;
      img.alt = product.title || '';
      img.loading = 'lazy';
      img.addEventListener('error', () => {
        if (img.parentNode === imgWrap) {
          const fb = document.createElement('div');
          fb.className = 'ub-pc-img-fallback';
          fb.innerHTML = PC_ICON_BOX;
          imgWrap.replaceChild(fb, img);
        }
      });
      imgWrap.appendChild(img);
    } else {
      const fb = document.createElement('div');
      fb.className = 'ub-pc-img-fallback';
      fb.innerHTML = PC_ICON_BOX;
      imgWrap.appendChild(fb);
    }
    const availability = pcFormatAvailability(product.availability);
    if (availability) {
      const badge = document.createElement('span');
      badge.className = 'ub-pc-badge';
      badge.textContent = availability;
      imgWrap.appendChild(badge);
    }
    card.appendChild(imgWrap);

    const body = document.createElement('div');
    body.className = 'ub-pc-body';

    const brand = product.attributes && product.attributes.brand;
    if (brand) {
      const b = document.createElement('span');
      b.className = 'ub-pc-brand';
      b.textContent = brand;
      body.appendChild(b);
    }

    const title = document.createElement('span');
    title.className = 'ub-pc-title';
    title.textContent = product.title || 'Product';
    body.appendChild(title);

    const specs = pcBuildSpecs(product.attributes);
    if (specs.length > 0) {
      const s = document.createElement('span');
      s.className = 'ub-pc-specs';
      s.textContent = specs.join(' · ');
      body.appendChild(s);
    }

    const foot = document.createElement('div');
    foot.className = 'ub-pc-foot';
    const price = pcFormatPrice(product.price, product.currency);
    if (price) {
      const p = document.createElement('span');
      p.className = 'ub-pc-price';
      p.textContent = price;
      foot.appendChild(p);
    }
    if (href) {
      const cta = document.createElement('span');
      cta.className = 'ub-pc-cta';
      cta.appendChild(document.createTextNode('View'));
      const ic = document.createElement('span');
      ic.className = 'ub-pc-cta-ic';
      ic.innerHTML = PC_ICON_EXTLINK;
      cta.appendChild(ic);
      foot.appendChild(cta);
    }
    body.appendChild(foot);
    card.appendChild(body);

    return card;
  }

  function buildProductCarousel(products) {
    if (!Array.isArray(products) || products.length === 0) return null;

    const root = document.createElement('div');
    root.className = 'ub-pc';

    const leftBtn = document.createElement('button');
    leftBtn.type = 'button';
    leftBtn.className = 'ub-pc-arrow ub-pc-arrow-l ub-pc-arrow-off';
    leftBtn.setAttribute('aria-label', 'Scroll left');
    leftBtn.innerHTML = PC_ICON_CHEVRON_LEFT;

    const track = document.createElement('div');
    track.className = 'ub-pc-track';
    products.forEach((p) => track.appendChild(pcBuildCard(p)));

    const rightBtn = document.createElement('button');
    rightBtn.type = 'button';
    rightBtn.className = 'ub-pc-arrow ub-pc-arrow-r ub-pc-arrow-off';
    rightBtn.setAttribute('aria-label', 'Scroll right');
    rightBtn.innerHTML = PC_ICON_CHEVRON_RIGHT;

    const refresh = () => {
      const canLeft = track.scrollLeft > 4;
      const canRight = track.scrollLeft + track.clientWidth < track.scrollWidth - 4;
      leftBtn.classList.toggle('ub-pc-arrow-off', !canLeft);
      rightBtn.classList.toggle('ub-pc-arrow-off', !canRight);
    };
    const scroll = (dir) => {
      const amount = Math.max(track.clientWidth * 0.8, 220);
      track.scrollBy({ left: dir * amount, behavior: 'smooth' });
    };

    leftBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); scroll(-1); });
    rightBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); scroll(1); });
    track.addEventListener('scroll', refresh, { passive: true });
    // Re-evaluate once laid out and again as images settle (width can change).
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(refresh);
    setTimeout(refresh, 300);
    track.querySelectorAll('img').forEach((img) => img.addEventListener('load', refresh));

    root.appendChild(leftBtn);
    root.appendChild(track);
    root.appendChild(rightBtn);
    return root;
  }

  // Attach (or replace) the product gallery on a bot message row, beneath the
  // text bubble. Stores the raw cards on the row so saveChatHistory can persist
  // them and a reload can rebuild the gallery.
  function attachProductsToRow(row, products) {
    if (!row || !Array.isArray(products) || products.length === 0) return;
    const existing = row.querySelector('.ub-pc-inline');
    if (existing) existing.remove();
    const carousel = buildProductCarousel(products);
    if (!carousel) return;
    const inline = document.createElement('div');
    inline.className = 'ub-pc-inline';
    if (row.querySelector('.saicf-message-avatar')) {
      inline.classList.add('ub-pc-inline--indent');
    }
    inline.appendChild(carousel);
    try { row.dataset.products = JSON.stringify(products); } catch {}
    row.appendChild(inline);
  }

  function createMessageRow(text, sender, options = {}) {
    const row = document.createElement('div');
    row.className = `saicf-message-row ${sender}`;
    row.dataset.sender = sender;

    if (sender === 'agent' && agentAvatar) {
      const avatarEl = document.createElement('div');
      avatarEl.className = 'saicf-message-avatar';
      avatarEl.style.backgroundImage = `url("${agentAvatar}")`;
      row.appendChild(avatarEl);
    } else if (sender === 'bot' && avatar) {
      const avatarEl = document.createElement('div');
      avatarEl.className = 'saicf-message-avatar';
      avatarEl.style.backgroundImage = `url("${avatar}")`;
      row.appendChild(avatarEl);
    }

    const bubble = document.createElement('div');
    bubble.className = `saicf-widget-message widget-${sender}-message`;
    if (typeof marked !== 'undefined') {
      bubble.innerHTML = sanitizedMarkdown(text);
    } else {
      bubble.textContent = text;
    }
    row.appendChild(bubble);


    return row;
  }

  function appendMessage(text, sender, options = {}) {
    const row = createMessageRow(text, sender, options);
    chatBody.insertBefore(row, bottomSpacerEl);
    if (!options.skipScroll) {
      scrollToBottom();
    }
    if (!options.skipSave) {
      saveChatHistory();
    }
    return row;
  }

  function resetStreamingBotMessage() {
    streamingBotRow = null;
    streamingBotBubble = null;
  }

  function ensureStreamingBotBubble() {
    if (!streamingBotBubble || !streamingBotBubble.isConnected) {
      streamingBotRow = appendMessage('', 'bot', { skipScroll: true, skipSave: true });
      streamingBotBubble = streamingBotRow
        ? streamingBotRow.querySelector('.widget-bot-message')
        : null;
    }
    return streamingBotBubble;
  }

  function updateStreamingBotMessage(text) {
    const bubble = ensureStreamingBotBubble();
    if (!bubble) return;
    if (typeof marked !== 'undefined') {
      bubble.innerHTML = sanitizedMarkdown(text);
    } else {
      bubble.textContent = text;
    }
    // Shrink spacer as bot response grows + re-anchor scroll.
    // recalcSpacer is a no-op when scrollTop is already correct
    // (lastUserMsg.offsetTop is constant), so no jitter.
    if (spacerActive && !programmaticScroll && !userScrolledAway) {
      recalcSpacer();
    }
    updateScrollDownVisibility();
  }

  // Render the product gallery (from the `products` SSE event) beneath the
  // in-flight bot reply. Ensures a bot row exists even if the gallery arrives
  // before any text chunk.
  function attachProductsToStreamingRow(products) {
    ensureStreamingBotBubble();
    if (!streamingBotRow) return;
    attachProductsToRow(streamingBotRow, products);
    if (spacerActive && !programmaticScroll && !userScrolledAway) {
      recalcSpacer();
    }
    updateScrollDownVisibility();
  }

  function scrollToBottom() {
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  // Aggressive scroll-to-bottom that survives layout shifts happening just
  // after a DOM change (e.g. the agent bar toggling visibility shrinks/grows
  // chatBody.clientHeight, image loads, spacer recalc). It re-pins the
  // scroll position across the next couple of frames and a short window so
  // the visitor definitely ends up at the bottom.
  function scrollToBottomHard() {
    chatBody.scrollTop = chatBody.scrollHeight;
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        chatBody.scrollTop = chatBody.scrollHeight;
        requestAnimationFrame(() => {
          chatBody.scrollTop = chatBody.scrollHeight;
        });
      });
    }
    setTimeout(() => { chatBody.scrollTop = chatBody.scrollHeight; }, 120);
    setTimeout(() => { chatBody.scrollTop = chatBody.scrollHeight; }, 360);
  }

  function setLoading(isLoading) {
    const existing = chatBody.querySelector('.saicf-loading-row');
    if (isLoading) {
      if (existing) return;
      const row = document.createElement('div');
      row.className = 'saicf-loading-row';
      row.innerHTML = '<div class="saicf-loading-dots"><div></div><div></div><div></div></div>';
      chatBody.insertBefore(row, bottomSpacerEl);
      // Only auto-scroll if doPositioning won't handle it
      if (!pendingUserScroll) scrollToBottom();
    } else if (existing) {
      existing.remove();
      if (spacerActive) recalcSpacer();
    }
  }

  function saveChatHistory() {
    // Walk chatBody in document order so message rows AND system notices
    // (e.g. "<agent> has joined the chat.") are saved in the same sequence
    // they were rendered. Without saving notices, a widget reload would
    // restore only the messages and the next `widget_init_ack` would
    // re-append the join notice at the bottom — making it look like the
    // agent re-joined just now.
    const items = [];
    Array.from(chatBody.children).forEach(el => {
      if (!el || !el.classList) return;
      if (el.classList.contains('saicf-loading-row')) return;
      if (el.classList.contains('saicf-message-row')) {
        const bubble = el.querySelector('.saicf-widget-message');
        const item = {
          kind: 'message',
          text: bubble ? bubble.innerHTML : '',
          sender: el.dataset.sender,
        };
        // Persist the product gallery (if any) so it survives a reload.
        if (el.dataset.products) {
          try { item.products = JSON.parse(el.dataset.products); } catch {}
        }
        items.push(item);
      } else if (el.classList.contains('saicf-system-notice')) {
        // Skip ephemeral "waiting for agent" notices — they have a Cancel
        // button and shouldn't survive a reload (the request itself was
        // either accepted, cancelled, or timed out by then).
        if (el.querySelector('.saicf-cancel-request')) return;
        const span = el.querySelector('.saicf-system-notice-text');
        items.push({
          kind: 'notice',
          text: span ? span.textContent : el.textContent,
        });
      }
    });
    sessionStorage.setItem(`chat-history-${botId}`, JSON.stringify(items));
  }

  async function loadChatHistory() {
    const saved = sessionStorage.getItem(`chat-history-${botId}`);
    if (!saved) {
      return;
    }

    // Note: marked is NOT needed here — saved messages already contain
    // pre-rendered HTML from the original send path. Keeping this fully
    // synchronous ensures that when we call loadChatHistory() at module
    // init, the DOM is populated before the WS `widget_init_ack` can arrive
    // and trigger the agent_joined welcome-inject path.

    try {
      const items = JSON.parse(saved);

      items.forEach((item) => {
        // Backwards compat: older saves stored bare {text, sender} objects
        // without a `kind` field — treat those as messages.
        const kind = item.kind || (item.sender ? 'message' : null);
        if (kind === 'notice') {
          const notice = document.createElement('div');
          notice.className = 'saicf-system-notice';
          const span = document.createElement('span');
          span.className = 'saicf-system-notice-text';
          span.textContent = item.text || '';
          notice.appendChild(span);
          chatBody.insertBefore(notice, bottomSpacerEl);
          return;
        }
        if (kind !== 'message') return;

        const msg = item;
        const row = document.createElement('div');
        row.className = `saicf-message-row ${msg.sender}`;
        row.dataset.sender = msg.sender;

        if (msg.sender === 'agent' && agentAvatar) {
          const avatarEl = document.createElement('div');
          avatarEl.className = 'saicf-message-avatar';
          avatarEl.style.backgroundImage = `url("${agentAvatar}")`;
          row.appendChild(avatarEl);
        } else if (msg.sender === 'bot' && avatar) {
          const avatarEl = document.createElement('div');
          avatarEl.className = 'saicf-message-avatar';
          avatarEl.style.backgroundImage = `url("${avatar}")`;
          row.appendChild(avatarEl);
        }

        const hasProducts = Array.isArray(msg.products) && msg.products.length > 0;

        // Set the HTML directly - it's already processed. W5: run it
        // through DOMPurify as a second line of defence in case a prior
        // session was saved before the sanitiser was in place, or
        // sessionStorage has been tampered with. If DOMPurify hasn't
        // finished its dynamic import yet, degrade to textContent rather
        // than assigning raw HTML (that would re-open the XSS hole).
        if (msg.text) {
          const bubble = document.createElement('div');
          bubble.className = `saicf-widget-message widget-${msg.sender}-message`;
          if (typeof DOMPurify !== 'undefined') {
            bubble.innerHTML = DOMPurify.sanitize(msg.text, { ADD_ATTR: ['target', 'rel'] });
          } else {
            bubble.textContent = msg.text;
          }
          row.appendChild(bubble);
        } else if (!hasProducts) {
          // Empty text and no gallery — keep the legacy placeholder bubble.
          const bubble = document.createElement('div');
          bubble.className = `saicf-widget-message widget-${msg.sender}-message`;
          bubble.textContent = '(empty message)';
          row.appendChild(bubble);
        }
        // else: products-only reply, no text bubble — just the gallery below.

        if (hasProducts) {
          attachProductsToRow(row, msg.products);
        }

        chatBody.insertBefore(row, bottomSpacerEl);
      });

      scrollToBottom();
    } catch (error) {
      console.error('Failed to load chat history:', error);
      sessionStorage.removeItem(`chat-history-${botId}`);
    }
  }
}
