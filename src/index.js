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

function addUltimoBacklink(promotingText, removePoweredBy) {
  if (
    removePoweredBy ||
    document.querySelector('a[href="https://www.ultimo-bots.com"]')
  ) {
    return;
  }

  const backlink = document.createElement('a');
  backlink.href = 'https://www.ultimo-bots.com';
  backlink.target = '_blank';
  backlink.rel = 'noopener noreferrer';
  backlink.textContent = promotingText;
  backlink.style.display = 'block';
  backlink.style.textAlign = 'center';
  backlink.style.fontSize = '4px';
  backlink.style.opacity = '0.9';
  backlink.style.textDecoration = 'none';
  backlink.style.color = '#555555';
  backlink.style.margin = '0';
  backlink.style.padding = '0';
  backlink.style.paddingTop = '2px';
  backlink.style.paddingBottom = '2px';

  document.body.appendChild(backlink);
}

async function initializeChatWidget() {
  ['https://portal.ultimo-bots.com', 'https://cdn.jsdelivr.net']
    .forEach(h => {
      if (!document.querySelector(`link[rel="preconnect"][href="${h}"]`)) {
        const l = document.createElement('link');
        l.rel = 'preconnect'; l.href = h; l.crossOrigin = ''; document.head.appendChild(l);
      }
    });
  let markedReady = typeof marked !== 'undefined';

  async function ensureMarked() {
    if (markedReady) return;

    const mod = await import(/* webpackIgnore: true */
      'https://cdn.jsdelivr.net/npm/marked@11.1.1/lib/marked.esm.js');

    mod.marked.setOptions({ gfm: true, breaks: true, headerIds: false });
    globalThis.marked = mod.marked;
    markedReady = true;
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
      opacity: 0;
      transform: translateY(100%);
      transition: opacity 0.5s ease, transform 0.5s ease;
    }
    .saicf-chat-window.show {
      opacity: 1;
      transform: translateY(0);
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
      transform: scale(1.2);
    }
    .saicf-chat-body {
      flex: 1;
      padding: 8px;
      padding-top: 0;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      background-color: white;
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
    .saicf-chat-footer button {
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
    .saicf-chat-footer button:hover {
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
    .widget-user-message {
      align-self: flex-end !important;
      color: white !important;
      border-radius: 8px !important;
      padding: 8px !important;
      font-size: 15px !important;
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

    /* ───────── predefined-question chips ───────── */
    .saicf-predefined-container{
      display:flex;
      flex-wrap:wrap-reverse;
      justify-content: flex-end;
      gap:8px;
      padding:6px 10px;
      padding-bottom: 0;
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
    .saicf-ellipsis-btn:hover { transform: scale(1.08); }
    .saicf-ellipsis-btn svg { width: 1.4em; height: 1.4em; display: block; }

    .saicf-menu {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      min-width: 160px;
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

    .saicf-menu-item svg { width: 1em; height: 1em; display: block; }

    @media (min-width: 769px) {
      .saicf-chat-window {
        width: min(430px, calc(100svw - 24px));
        height: min(620px, calc(100svh - 24px));
        max-height: calc(100svh - 24px);
      }
    }

    @media (max-width: 768px) {
      /* Hide the dim overlay; the window itself covers the screen */
      .saicf-chat-overlay {
        display: none !important;
      }

      /* Fullscreen chat window (slides up when .show is added) */
      .saicf-chat-window {
        position: fixed !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        border-radius: 0 !important;
        background: #ffffff !important;
        opacity: 0 !important;
        transform: translateY(100%) !important;
        transition: opacity 0.75s ease, transform 0.75s ease !important;
        display: flex !important;
        flex-direction: column !important;
      }

      /* When opened */
      .saicf-chat-window.show {
        opacity: 1 !important;
        transform: none !important;
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
      flex: 1;
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
    addUltimoBacklink(promotingText, false);
    return;
  }

  const removePoweredBy     = widgetConfig.remove_powered_by       ?? false;
  addUltimoBacklink(promotingText, removePoweredBy);

  const themeColor          = widgetConfig.theme_color             || '#0082ba';
  const hoverColor          = widgetConfig.button_hover_color      || '#0595d3';
  const headerFontColor     = widgetConfig.header_font_color       || '#ffffff';
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
      <img
        src="${icon}"
        alt="Widget Icon"
        style="max-width: 100%; max-height: 100%; border-radius: ${widgetBorderRadius}%;">
    `;
  } else {
    chatWidgetIcon.innerHTML = `
<div style="display:flex; justify-content:center; align-items:center; background-color: transparent; padding-top: 3px">
  <svg xmlns="http://www.w3.org/2000/svg" width="65%" viewBox="0 0 24 24" fill="currentColor" class="size-6">
    <path fill-rule="evenodd" d="M12 2.25c-2.429 0-4.817.178-7.152.521C2.87 3.061 1.5 4.795 1.5 6.741v6.018c0 1.946 1.37 3.68 3.348 3.97.877.129 1.761.234 2.652.316V21a.75.75 0 0 0 1.28.53l4.184-4.183a.39.39 0 0 1 .266-.112c2.006-.05 3.982-.22 5.922-.506 1.978-.29 3.348-2.023 3.348-3.97V6.741c0-1.947-1.37-3.68-3.348-3.97A49.145 49.145 0 0 0 12 2.25ZM8.25 8.625a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25Zm2.625 1.125a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875-1.125a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25Z" clip-rule="evenodd" />
  </svg>
</div>
`;
  }
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
          </div>
        </div>
      </div>
    </div>
  `;
  const poweredByHTML = removePoweredBy
    ? ''
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
        <svg class="saicf-pre-chat-icon" viewBox="0 0 640 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M208 352c114.9 0 208-78.8 208-176S322.9 0 208 0S0 78.8 0 176c0 38.6 14.7 74.3 39.6 103.4c-3.5 9.4-8.7 17.7-14.2 24.7c-4.8 6.2-9.7 11-13.3 14.3c-1.8 1.6-3.3 2.9-4.3 3.7c-.5 .4-.9 .7-1.1 .8l-.2 .2 0 0 0 0C1 327.2-1.4 334.4 .8 340.9S9.1 352 16 352c21.8 0 43.8-5.6 62.1-12.5c9.2-3.5 17.8-7.4 25.3-11.4C134.1 343.3 169.8 352 208 352zM448 176c0 112.3-99.1 196.9-216.5 207C255.8 457.4 336.4 512 432 512c38.2 0 73.9-8.7 104.7-23.9c7.5 4 16 7.9 25.2 11.4c18.3 6.9 40.3 12.5 62.1 12.5c6.9 0 13.1-4.5 15.2-11.1c2.1-6.6-.2-13.8-5.8-17.9l0 0 0 0-.2-.2c-.2-.2-.6-.4-1.1-.8c-1-.8-2.5-2-4.3-3.7c-3.6-3.3-8.5-8.1-13.3-14.3c-5.5-7-10.7-15.4-14.2-24.7c24.9-29 39.6-64.7 39.6-103.4c0-92.8-84.9-168.9-192.6-175.5c.4 5.1 .6 10.3 .6 15.5z"/>
        </svg>
        <h3>Before we start chatting</h3>
        <p>Please provide your details to continue</p>
      </div>
      <div class="saicf-pre-chat-fields"></div>
      <button class="saicf-pre-chat-submit" disabled>Start Chat</button>
    </div>
    <div class="saicf-chat-body hidden"></div>
    <div class="saicf-chat-footer hidden">
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
          if (chatBody.childElementCount === 0) {
            welcomeMessages.forEach(msg => appendMessage(msg, 'bot'));
          }
        });
      }
      chatWindow.classList.remove('hidden');
      forceReflow(chatWindow);
      chatWindow.classList.add('show');
      chatOverlay.classList.remove('hidden');

      if (window.matchMedia('(max-width: 768px)').matches) {
        document.body.classList.add('no-scroll');
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
    .saicf-chat-footer button:hover {
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
  `;
  shadowRoot.appendChild(dynamicStyleEl);

  const closeChatBtn   = chatWindow.querySelector('.saicf-close-btn');
  const chatBody       = chatWindow.querySelector('.saicf-chat-body');
  const chatFooter     = chatWindow.querySelector('.saicf-chat-footer');
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

      // Transition to chat view
      preChatContainer.classList.add('hidden');
      chatBody.classList.remove('hidden');
      chatFooter.classList.remove('hidden');

      // Load chat history or show welcome messages
      if (chatBody.childElementCount === 0) {
        await loadChatHistory();
        if (chatBody.childElementCount === 0) {
          await ensureMarked();
          welcomeMessages.forEach(msg => appendMessage(msg, 'bot'));
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

  clearBtn.addEventListener('click', (e) => {
    e.preventDefault();
    toggleMenu(false);

    sessionId = generateSessionId();
    sessionStorage.setItem(`sessionId-${botId}`, sessionId);
    sessionStorage.removeItem(`chat-history-${botId}`);

    chatBody.innerHTML = '';

    const loadingRow = chatBody.querySelector('.saicf-loading-row');
    if (loadingRow) {
      loadingRow.remove();
    } else {
      const legacyDots = chatBody.querySelector('.saicf-loading-dots');
      if (legacyDots) legacyDots.remove();
    }
    resetStreamingBotMessage();

    if (Array.isArray(welcomeMessages) && welcomeMessages.length) {
      welcomeMessages.forEach(msg => appendMessage(msg, 'bot'));
    }

    chatInput.focus();
  });

  const _origCloseChat = closeChat;
  closeChat = function () {
    toggleMenu(false);
    resetStreamingBotMessage();
    _origCloseChat();
  };

  let isBusy = false;

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

  chatWidgetIcon.addEventListener('click', async () => {
    // Only load chat history if pre-chat is completed or not required
    if (!requirePreChat || preChatCompleted) {
      if (chatBody.childElementCount === 0) {
        await loadChatHistory();
        if (chatBody.childElementCount === 0) {
          await ensureMarked();
          welcomeMessages.forEach(msg => appendMessage(msg, 'bot'));
        }
      }
    }
    chatWindow.classList.remove('hidden');
    forceReflow(chatWindow);
    chatWindow.classList.add('show');
    chatOverlay.classList.remove('hidden');
    if (window.matchMedia('(max-width: 768px)').matches) {
      document.body.classList.add('no-scroll');
    }
    widgetOpenedOnce = true;
    markPopUpSeen();
    hidePopUp();
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

  if (popUpMessages) {
    setTimeout(showPopUpSequentially, popUpDelaySeconds * 1000);
  }

  function forceReflow(element) {
    void element.offsetHeight;
  }

  function closeChat() {
    chatWindow.classList.remove('show');
    chatOverlay.classList.add('hidden');
    if (window.matchMedia('(max-width: 768px)').matches) {
      document.body.classList.remove('no-scroll');
    }
    setTimeout(() => chatWindow.classList.add('hidden'), 300);
  }

  function generateSessionId() {
    const timestamp = new Date().getTime();
    const randomNum = Math.floor(Math.random() * 10000) + 1;
    return `${timestamp}-${randomNum}`;
  }

  async function sendMessage() {
    if (isBusy) return;

    const message = chatInput.value.trim();
    if (!message) return;

    appendMessage(message, 'user');
    chatInput.value = '';
    resizeTextarea(chatInput);

    setBusy(true);
    setLoading(true);

    let currentBotMessage = '';
    resetStreamingBotMessage();

    const url =
      `https://portal.ultimo-bots.com/api/chatbot_response?` +
      `user_input=${encodeURIComponent(message)}` +
      `&session_id=${sessionId}&bot_id=${botId}&language=english`;

    const finish = () => {
      setLoading(false);
      setBusy(false);
      saveChatHistory();
      resetStreamingBotMessage();
      scrollToBottom();
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
          setLoading(false);
          firstChunk = false;
        }
        currentBotMessage += chunk.replace(/<newline>/g, '\n');
        updateStreamingBotMessage(currentBotMessage);
      };

      es.addEventListener('end', () => {
        if (!hasError) {
          updateStreamingBotMessage(currentBotMessage);
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

  function createMessageRow(text, sender) {
    const row = document.createElement('div');
    row.className = `saicf-message-row ${sender}`;
    row.dataset.sender = sender;

    if (sender === 'bot' && avatar) {
      const avatarEl = document.createElement('div');
      avatarEl.className = 'saicf-message-avatar';
      avatarEl.style.backgroundImage = `url("${avatar}")`;
      row.appendChild(avatarEl);
    }

    const bubble = document.createElement('div');
    bubble.className = `saicf-widget-message widget-${sender}-message`;
    if (typeof marked !== 'undefined') {
      bubble.innerHTML = marked.parse(text);
    } else {
      bubble.textContent = text;
    }
    row.appendChild(bubble);
    return row;
  }

  function appendMessage(text, sender, options = {}) {
    const row = createMessageRow(text, sender);
    chatBody.appendChild(row);
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
      bubble.innerHTML = marked.parse(text);
    } else {
      bubble.textContent = text;
    }
    scrollToBottom();
  }

  function scrollToBottom() {
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function setLoading(isLoading) {
    const existing = chatBody.querySelector('.saicf-loading-row');
    if (isLoading) {
      if (existing) return;
      const row = document.createElement('div');
      row.className = 'saicf-loading-row';
      row.innerHTML = '<div class="saicf-loading-dots"><div></div><div></div><div></div></div>';
      chatBody.appendChild(row);
      scrollToBottom();
    } else if (existing) {
      existing.remove();
    }
  }

  function saveChatHistory() {
    const messages = Array.from(chatBody.querySelectorAll('.saicf-message-row'))
      .filter(row => !row.classList.contains('saicf-loading-row'))
      .map(row => {
        const bubble = row.querySelector('.saicf-widget-message');
        const text = bubble ? bubble.innerHTML : '';
        return {
          text: text,
          sender: row.dataset.sender
        };
      });
    const data = JSON.stringify(messages);
    sessionStorage.setItem(`chat-history-${botId}`, data);
  }

  async function loadChatHistory() {
    const saved = sessionStorage.getItem(`chat-history-${botId}`);
    if (!saved) {
      return;
    }

    await ensureMarked();

    try {
      const messages = JSON.parse(saved);

      messages.forEach((msg) => {
        const row = document.createElement('div');
        row.className = `saicf-message-row ${msg.sender}`;
        row.dataset.sender = msg.sender;

        if (msg.sender === 'bot' && avatar) {
          const avatarEl = document.createElement('div');
          avatarEl.className = 'saicf-message-avatar';
          avatarEl.style.backgroundImage = `url("${avatar}")`;
          row.appendChild(avatarEl);
        }

        const bubble = document.createElement('div');
        bubble.className = `saicf-widget-message widget-${msg.sender}-message`;

        // Set the HTML directly - it's already processed
        if (msg.text) {
          bubble.innerHTML = msg.text;
        } else {
          bubble.textContent = '(empty message)';
        }

        row.appendChild(bubble);
        chatBody.appendChild(row);
      });

      scrollToBottom();
    } catch (error) {
      console.error('Failed to load chat history:', error);
      sessionStorage.removeItem(`chat-history-${botId}`);
    }
  }
}
