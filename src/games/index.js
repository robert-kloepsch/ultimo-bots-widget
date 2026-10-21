// Waiting-room games: something to do while a live agent is being fetched.
//
// Contract with src/index.js is deliberately tiny:
//   armOffer(noticeEl)     from showWaitingForAgentNotice()
//   teardown()             from setLiveSessionStatusFn('agent_joined'), the
//                          cancel handler, and any other exit from the wait
//   setWindowOpen(bool)    from opening / closing the chat window
//
// This module owns NO live-chat state. It never touches the WS, the
// heartbeat, the polling loop or the session token, which is why it does not
// fall under the "keep useLiveAgent.js 1:1 in sync" rule — same reasoning as
// the Shopify buy button. Keep it that way: the leaderboard calls go through
// the `leaderboard` adapter src/index.js passes in, which holds the token.
//
// Every game implements: { id, label, order, unit, mount(el, ctx), destroy(),
// pause?(), resume?() }. `order` is 'desc' when a higher score is better.
// A finished round calls ctx.gameOver({ score, durationMs, headline }); the
// result screen with the leaderboard is drawn here, not in the game.
// Games must be self-contained, asset-free and touch-first. The widget bundle
// ships on every page of every customer site, so size is a hard budget, not a
// preference. See CLAUDE.md.

import { createMemoryGame } from './memory.js';
import { createWhackGame } from './whack.js';

// One entry per game. A random one is picked per waiting session, never the
// same one twice in a row.
//
// The bar for being in here: a first-time player must understand the game from
// the screen alone, without a gesture or a rule they have to know in advance.
// Simon Says and 2048 were both built and both dropped for failing exactly
// that test — one needs you to know to watch-then-repeat, the other to swipe,
// and neither says so on screen.
const REGISTRY = [createMemoryGame, createWhackGame];

// Shown immediately, beside the Cancel button on the waiting notice.
const DEFAULT_OFFER_DELAY_MS = 0;

// The one line of copy above the offer. Swap this string to change it.
const OFFER_HINT = 'Nothing to do?';
const OFFER_LABEL = 'Play a Game';

// Rows on the leaderboard. A visitor below them sees the top 3, a gap and
// their own row, so the list never needs more height than these rows.
const BOARD_ROWS = 5;
const MEDALS = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];

export function gameStyles(themeColor) {
  return `
    /* One quiet line above the action row. */
    .saicf-game-hint {
      font-size: 11px;
      color: #999;
      margin-top: 12px;
      text-align: center;
      animation: saicf-notice-in .35s ease-out;
    }
    /* Filled, so it reads as the positive action while the outlined Cancel
       above stays quiet. Same radius and font size as .saicf-cancel-request. */
    .saicf-game-offer {
      margin-top: 6px;
      background: ${themeColor};
      border: 1px solid ${themeColor};
      color: #fff;
      font-size: 12px;
      padding: 5px 14px;
      border-radius: 11px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: filter .2s;
      animation: saicf-notice-in .35s ease-out;
    }
    .saicf-game-offer:hover { filter: brightness(1.12); }
    .saicf-game-offer svg { display: block; flex-shrink: 0; }
    /* Game mode: everything below the header is replaced by the game. The
       header stays so the visitor keeps close / menu. Hiding by "every direct
       child except these" survives future additions to the window markup.
       .saicf-confirm-overlay is exempt because the header menu can still open
       Clear chat while the game is up, and a hidden modal would swallow clicks. */
    .saicf-chat-window.saicf-game-mode > *:not(.saicf-chat-header):not(.saicf-game-overlay):not(.saicf-confirm-overlay) {
      display: none !important;
    }
    /* A flex child, not an absolute overlay: the game then gets exactly the
       leftover height, which is what makes "no scrollbar" provable. */
    .saicf-game-overlay {
      flex: 1 1 auto;
      min-height: 0;
      background: #fff;
      display: flex;
      flex-direction: column;
      animation: saicf-notice-in .25s ease-out;
    }
    /* 1fr auto 1fr: the two side columns are always equal, so the middle one
       is centred on the bar itself, not on the space left over next to the
       wide "Back to chat". Absolute centring also centred it, but the title
       then overlapped the button because nothing reserved room for it. */
    .saicf-game-bar {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 8px;
      padding: 8px var(--saicf-gutter);
      border-bottom: 1px solid #ececec;
      flex: 0 0 auto;
    }
    .saicf-game-back { justify-self: start; }
    .saicf-game-restart { justify-self: end; }
    .saicf-game-back {
      background: none;
      border: none;
      color: #666;
      font-size: 12px;
      padding: 4px 6px;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      /* The grid column is narrower than the old flex slot, so without this
         the label wraps to "Back to / chat". */
      white-space: nowrap;
    }
    .saicf-game-back:hover { background: #f2f2f2; color: #333; }
    .saicf-game-title {
      justify-self: center;
      white-space: nowrap;
      font-size: 12px;
      font-weight: 600;
      color: #333;
    }
    .saicf-game-restart {
      background: none;
      border: none;
      color: #666;
      font-size: 14px;
      line-height: 1;
      padding: 4px 7px;
      border-radius: 8px;
      cursor: pointer;
    }
    .saicf-game-restart:hover { background: #f2f2f2; color: #333; }
    /* overflow:hidden, not auto — a game that does not fit is a bug to fix in
       the game's own sizing, never something to paper over with a scrollbar. */
    .saicf-game-stage {
      flex: 1 1 auto;
      min-height: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 10px var(--saicf-gutter);
      gap: 10px;
    }
    .saicf-game-foot {
      flex: 0 0 auto;
      display: flex;
      justify-content: center;
      padding: 0 var(--saicf-gutter) 10px;
    }

    /* ── Memory ── */
    /* Sizing box for any game that wants to stay square. It takes the height
       left over after the stage's other rows, and the square inside is driven
       by THAT height, so a short window shrinks the board instead of squashing
       it. max-width then clamps the narrow case, and aspect-ratio pulls the
       height back down with it. */
    .saicf-game-fit {
      flex: 1 1 auto;
      min-height: 0;
      width: 100%;
      /* Size container so boards can ask for 100cqmin — the smaller of this
         box's two axes. aspect-ratio + width:auto was NOT deterministic here:
         as a flex item the board's width still resolved from grid content, so
         a 2x2 board came out 243x288 while a 4x4 one landed on 288x288. */
      container-type: size;
      display: flex;
      /* Centred between the score line and the footer. This box spans exactly
         that range, so centring in it centres the board between the two. The
         gap that made this look wrong before came from the board being capped
         at 288px; at 380 the leftover is small enough to split evenly. */
      align-items: center;
      justify-content: center;
    }
    /* One rule sizes every square board. Add a game, add its class here.
       border-box is not optional: a board that carries padding otherwise gets
       that padding added to its height only, and the "square" comes out
       243x257. */
    .saicf-game-memory-board,
    .saicf-game-whack-board {
      box-sizing: border-box;
      /* The cap only ever binds on desktop, where the window is far taller
         than wide and a square board is width-limited. 380 leaves ~15px either
         side inside a 430px window and makes the cells noticeably easier to
         hit. On mobile 100cqmin wins and the cap never applies. */
      width: min(380px, 100cqmin);
      height: min(380px, 100cqmin);
      flex: 0 0 auto;
    }
    .saicf-game-memory-board {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      grid-template-rows: repeat(4, 1fr);
      gap: 8px;
    }
    .saicf-game-memory-card {
      position: relative;
      border: none;
      padding: 0;
      background: none;
      cursor: pointer;
      transform-style: preserve-3d;
      transition: transform .28s ease;
    }
    .saicf-game-memory-card.is-open { transform: rotateY(180deg); }
    .saicf-game-memory-card.is-matched { cursor: default; }
    .saicf-game-memory-back,
    .saicf-game-memory-face {
      position: absolute;
      inset: 0;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
    }
    .saicf-game-memory-back {
      background: ${themeColor};
      opacity: .18;
    }
    .saicf-game-memory-face {
      background: #f7f7f7;
      border: 1px solid #e6e6e6;
      font-size: 22px;
      transform: rotateY(180deg);
    }
    .saicf-game-memory-card.is-matched .saicf-game-memory-face {
      background: ${themeColor}14;
      border-color: ${themeColor}55;
    }
    /* Shared by every game: the score / progress line, ABOVE the board. */
    .saicf-game-status {
      font-size: 15px;
      font-weight: 700;
      color: #555;
      min-height: 20px;
      text-align: center;
      flex: 0 0 auto;
    }
    .saicf-game-status.is-win {
      color: ${themeColor};
      font-weight: 600;
    }
    /* Status as a row: depleting ring, seconds, score. */
    .saicf-game-status.has-timer {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .saicf-game-timer {
      display: block;
      width: 22px;
      height: 22px;
      flex-shrink: 0;
    }
    /* -90deg so the ring starts emptying from twelve o'clock. */
    .saicf-game-timer svg {
      display: block;
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }
    .saicf-game-timer-track,
    .saicf-game-timer-prog {
      fill: none;
      stroke-width: 5;
    }
    .saicf-game-timer-track { stroke: rgba(0,0,0,.1); }
    .saicf-game-timer-prog {
      stroke: ${themeColor};
      stroke-linecap: round;
      transition: stroke-dashoffset .1s linear;
    }
    .saicf-game-timer-secs {
      min-width: 34px;
      text-align: left;
    }
    .saicf-game-status-sep {
      color: #bbb;
      font-weight: 400;
    }

    /* ── Whack-a-Mole ── */
    .saicf-game-whack-board {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(3, 1fr);
      gap: 10px;
      user-select: none;
    }
    .saicf-game-whack-hole {
      border: none;
      padding: 0;
      border-radius: 50%;
      background: rgba(0,0,0,.06);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      transition: background .12s ease;
    }
    /* The mole is scaled to nothing rather than hidden, so it visibly pops out
       of the hole instead of blinking into existence. */
    /* Percentage of the hole, not a fixed px: the target then scales with the
       board on every window size. currentColor feeds the SVG fills. */
    .saicf-game-whack-mole {
      display: block;
      width: 66%;
      color: ${themeColor};
      transform: scale(0) translateY(30%);
      opacity: 0;
      transition: transform .13s ease-out, opacity .1s ease-out;
      pointer-events: none;
    }
    .saicf-game-whack-mole svg {
      display: block;
      width: 100%;
      height: auto;
    }
    .saicf-game-whack-hole.is-up { background: ${themeColor}22; }
    .saicf-game-whack-hole.is-up .saicf-game-whack-mole {
      transform: scale(1) translateY(0);
      opacity: 1;
    }
    .saicf-game-whack-hole.is-hit { background: ${themeColor}; }
    .saicf-game-whack-hole.is-hit .saicf-game-whack-mole {
      transform: scale(1.35) translateY(0);
      opacity: 0;
      transition: transform .2s ease-out, opacity .2s ease-out;
    }
    .saicf-game-again {
      background: ${themeColor};
      border: none;
      color: #fff;
      font-size: 12px;
      padding: 6px 16px;
      border-radius: 10px;
      cursor: pointer;
      animation: saicf-notice-in .3s ease-out;
    }

    /* ── Result + leaderboard (replaces the board when a round ends) ── */
    .saicf-game-result {
      width: 100%;
      max-width: 320px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      animation: saicf-notice-in .25s ease-out;
    }
    .saicf-game-result-head {
      font-size: 13px;
      font-weight: 600;
      color: #555;
    }
    .saicf-game-result-score {
      display: flex;
      align-items: baseline;
      gap: 6px;
      color: ${themeColor};
    }
    .saicf-game-result-num {
      font-size: 40px;
      font-weight: 800;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }
    .saicf-game-result-unit {
      font-size: 13px;
      font-weight: 600;
      color: #888;
    }
    .saicf-game-result-best {
      font-size: 12px;
      color: #888;
      min-height: 16px;
    }
    .saicf-game-result-best.is-new {
      color: ${themeColor};
      font-weight: 600;
    }
    .saicf-game-lb {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid #ececec;
      border-radius: 12px;
      padding: 8px 8px 6px;
      margin: 4px 0 6px;
    }
    .saicf-game-lb-title {
      display: flex;
      justify-content: space-between;
      padding: 0 6px 4px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .04em;
      text-transform: uppercase;
      color: #999;
    }
    .saicf-game-lb-count {
      font-weight: 500;
      letter-spacing: 0;
      text-transform: none;
    }
    /* Fixed height for BOARD_ROWS rows: the list fills in after the request
       without pushing the Play again button down. */
    .saicf-game-lb-list {
      list-style: none;
      margin: 0;
      padding: 0;
      height: calc(${BOARD_ROWS} * 26px);
    }
    .saicf-game-lb-row {
      display: grid;
      grid-template-columns: 24px 1fr auto;
      align-items: center;
      gap: 8px;
      height: 26px;
      padding: 0 6px;
      border-radius: 8px;
      font-size: 13px;
      color: #444;
    }
    .saicf-game-lb-rank {
      text-align: center;
      font-size: 12px;
      font-weight: 700;
      color: #aaa;
    }
    .saicf-game-lb-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .saicf-game-lb-score {
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .saicf-game-lb-row.is-you {
      background: ${themeColor}14;
      color: ${themeColor};
      font-weight: 600;
    }
    .saicf-game-lb-gap {
      height: 26px;
      line-height: 20px;
      text-align: center;
      color: #bbb;
    }
    .saicf-game-lb-row.is-placeholder .saicf-game-lb-name::before {
      content: '';
      display: block;
      width: 55%;
      height: 8px;
      border-radius: 4px;
      background: #f0f0f0;
    }
    .saicf-game-lb-empty {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      color: #999;
    }
  `;
}

function readBest(key) {
  try {
    const v = parseInt(localStorage.getItem(key), 10);
    return Number.isFinite(v) ? v : null;
  } catch { return null; }
}

function writeBest(key, value) {
  try { localStorage.setItem(key, String(value)); } catch { /* private mode */ }
}

// `leaderboard` is { fetch(gameId), submit(gameId, score, durationMs) }, both
// resolving to the board or null. Without it the result screen shows the
// visitor's own best only.
export function createGameCenter({ mountTarget, offerDelayMs = DEFAULT_OFFER_DELAY_MS, leaderboard = null, bestKey = null }) {
  // Survives close/reopen for the lifetime of the widget, so "back to chat"
  // and then Play again always hands out a different game.
  let lastGameIndex = -1;

  let offerTimer = null;
  let offerBtn = null;
  let offerHint = null;
  let overlay = null;
  let game = null;
  let onVisibility = null;
  // A game must not run on while nobody can see it: neither in a hidden tab
  // nor behind a minimised chat window.
  let windowOpen = true;
  let paused = false;
  // False once the result screen is up: the round is over, nothing to pause.
  let playing = false;
  // Bumped whenever the stage is redrawn, so a leaderboard answer that comes
  // back after a restart or close is dropped instead of drawn over the board.
  let round = 0;

  function syncPause() {
    if (!game || !playing) return;
    const shouldPause = document.hidden || !windowOpen;
    if (shouldPause === paused) return;
    paused = shouldPause;
    if (paused) game.pause?.();
    else game.resume?.();
  }

  function boardRow(rank, name, score, you) {
    const li = document.createElement('li');
    li.className = 'saicf-game-lb-row' + (you ? ' is-you' : '');
    const r = document.createElement('span');
    r.className = 'saicf-game-lb-rank';
    r.textContent = rank <= MEDALS.length ? MEDALS[rank - 1] : String(rank);
    const n = document.createElement('span');
    n.className = 'saicf-game-lb-name';
    n.textContent = you ? `${name} (you)` : name;
    const s = document.createElement('span');
    s.className = 'saicf-game-lb-score';
    s.textContent = String(score);
    li.append(r, n, s);
    return li;
  }

  function drawBoard(box, board, bestEl) {
    const list = box.querySelector('.saicf-game-lb-list');
    list.innerHTML = '';
    const top = board.top || [];
    const you = board.you;
    box.querySelector('.saicf-game-lb-count').textContent =
      board.players ? `${board.players} ${board.players === 1 ? 'player' : 'players'}` : '';
    if (!top.length) {
      const empty = document.createElement('li');
      empty.className = 'saicf-game-lb-empty';
      empty.textContent = 'No scores yet. Be the first!';
      list.appendChild(empty);
      return;
    }
    const below = you && you.rank > BOARD_ROWS;
    top.slice(0, below ? BOARD_ROWS - 2 : BOARD_ROWS)
      .forEach((r) => list.appendChild(boardRow(r.rank, r.name, r.score, r.you)));
    if (below) {
      const gap = document.createElement('li');
      gap.className = 'saicf-game-lb-gap';
      gap.textContent = '\u22EF';
      list.appendChild(gap);
      list.appendChild(boardRow(you.rank, you.name, you.score, true));
    }
    if (you && you.rank === 1 && bestEl) {
      bestEl.textContent = 'You lead the board!';
      bestEl.classList.add('is-new');
    }
  }

  function showResult(stage, result) {
    const thisRound = ++round;
    const g = game;
    const key = bestKey ? bestKey(g.id) : null;
    const better = (a, b) => (g.order === 'asc' ? a < b : a > b);
    const prevBest = key ? readBest(key) : null;
    const counts = g.order !== 'desc' || result.score > 0;
    const isNewBest = counts && (prevBest === null || better(result.score, prevBest));
    if (key && isNewBest) writeBest(key, result.score);

    playing = false;
    paused = false;
    g.destroy();
    stage.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'saicf-game-result';
    box.innerHTML = `
      <div class="saicf-game-result-head"></div>
      <div class="saicf-game-result-score">
        <span class="saicf-game-result-num"></span>
        <span class="saicf-game-result-unit"></span>
      </div>
      <div class="saicf-game-result-best"></div>
      <div class="saicf-game-lb">
        <div class="saicf-game-lb-title"><span>Leaderboard</span><span class="saicf-game-lb-count"></span></div>
        <ol class="saicf-game-lb-list"></ol>
      </div>
      <button class="saicf-game-again" type="button">Play again</button>
    `;
    box.querySelector('.saicf-game-result-head').textContent = result.headline || 'Round over';
    box.querySelector('.saicf-game-result-num').textContent = String(result.score);
    box.querySelector('.saicf-game-result-unit').textContent = g.unit || '';
    const bestEl = box.querySelector('.saicf-game-result-best');
    if (isNewBest && prevBest !== null) {
      bestEl.textContent = 'New personal best!';
      bestEl.classList.add('is-new');
    } else if (prevBest !== null && !isNewBest) {
      bestEl.textContent = `Your best: ${prevBest}`;
    }
    box.querySelector('.saicf-game-again').addEventListener('click', () => restartGame(stage));

    const lb = box.querySelector('.saicf-game-lb');
    if (!leaderboard) {
      lb.remove();
    } else {
      const list = lb.querySelector('.saicf-game-lb-list');
      for (let i = 0; i < BOARD_ROWS; i++) {
        const li = document.createElement('li');
        li.className = 'saicf-game-lb-row is-placeholder';
        li.innerHTML = '<span class="saicf-game-lb-rank"></span><span class="saicf-game-lb-name"></span><span></span>';
        list.appendChild(li);
      }
      // A round worth nothing is not submitted; the board is still shown.
      const request = counts && result.score > 0
        ? leaderboard.submit(g.id, result.score, Math.round(result.durationMs || 0))
        : leaderboard.fetch(g.id);
      Promise.resolve(request)
        .then((board) => {
          if (thisRound !== round) return;
          if (!board) { lb.remove(); return; }
          drawBoard(lb, board, bestEl);
        })
        .catch(() => { if (thisRound === round) lb.remove(); });
    }
    stage.appendChild(box);
  }

  function gameContext(stage) {
    return {
      restart: () => restartGame(stage),
      gameOver: (result) => {
        if (overlay && game) showResult(stage, result);
      },
    };
  }

  function restartGame(stage) {
    if (!game) return;
    round++;
    game.destroy();
    stage.innerHTML = '';
    game.mount(stage, gameContext(stage));
    playing = true;
    paused = false;
    syncPause();
  }

  function clearOfferTimer() {
    if (offerTimer) {
      clearTimeout(offerTimer);
      offerTimer = null;
    }
  }

  function removeOffer() {
    clearOfferTimer();
    if (offerBtn) {
      offerBtn.remove();
      offerBtn = null;
    }
    if (offerHint) {
      offerHint.remove();
      offerHint = null;
    }
  }

  function close() {
    round++;
    playing = false;
    paused = false;
    if (onVisibility) {
      document.removeEventListener('visibilitychange', onVisibility);
      onVisibility = null;
    }
    if (game) {
      game.destroy();
      game = null;
    }
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
    // Always drop the class, even if the overlay was already gone, so the chat
    // can never be left with its body and composer hidden.
    mountTarget.classList.remove('saicf-game-mode');
  }

  function open() {
    if (overlay) return;

    // Never the same game twice in a row. With two registered games that is a
    // strict alternation; with more it picks at random among the others.
    let index = 0;
    if (REGISTRY.length > 1) {
      do { index = Math.floor(Math.random() * REGISTRY.length); }
      while (index === lastGameIndex);
    }
    lastGameIndex = index;
    game = REGISTRY[index]();

    overlay = document.createElement('div');
    overlay.className = 'saicf-game-overlay';
    overlay.innerHTML = `
      <div class="saicf-game-bar">
        <button class="saicf-game-back" type="button">
          <svg viewBox="0 0 320 512" width="10" height="10" aria-hidden="true"><path d="M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l192 192c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256 246.6 86.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-192 192z" fill="currentColor"/></svg>
          Back to chat
        </button>
        <span class="saicf-game-title"></span>
        <button class="saicf-game-restart" type="button" aria-label="Restart game">&#8635;</button>
      </div>
      <div class="saicf-game-stage"></div>
      <div class="saicf-game-foot"></div>
    `;

    // Reuse the window's own branding block rather than hardcoding "Powered by
    // Ultimo Bots": customers on plans with custom branding render their own
    // text there, and a hardcoded line would silently un-white-label them.
    const branding = mountTarget.querySelector('.saicf-chat-footer .saicf-powered-by');
    if (branding) overlay.querySelector('.saicf-game-foot').appendChild(branding.cloneNode(true));

    const stage = overlay.querySelector('.saicf-game-stage');
    const restart = () => restartGame(stage);

    overlay.querySelector('.saicf-game-title').textContent = game.label;
    overlay.querySelector('.saicf-game-back').addEventListener('click', () => {
      // Only hides the game. The visitor is still queued, and the offer button
      // stays on the waiting notice so they can come back.
      close();
    });
    overlay.querySelector('.saicf-game-restart').addEventListener('click', restart);

    mountTarget.appendChild(overlay);
    mountTarget.classList.add('saicf-game-mode');
    game.mount(stage, gameContext(stage));
    playing = true;
    paused = false;

    onVisibility = syncPause;
    document.addEventListener('visibilitychange', onVisibility);
  }

  return {
    // Called from showWaitingForAgentNotice(). Injects the offer button into
    // the waiting notice after the delay, but only if that notice is still on
    // screen — the visitor may have been served or cancelled in the meantime.
    armOffer(noticeEl) {
      if (offerTimer || offerBtn) return;
      offerTimer = setTimeout(() => {
        offerTimer = null;
        if (!noticeEl || !noticeEl.isConnected) return;

        offerBtn = document.createElement('button');
        offerBtn.type = 'button';
        offerBtn.className = 'saicf-game-offer';
        offerBtn.innerHTML =
          '<svg viewBox="0 0 640 512" width="15" height="15" aria-hidden="true"><path d="M192 64C86 64 0 150 0 256S86 448 192 448H448c106 0 192-86 192-192s-86-192-192-192H192zM496 168a40 40 0 1 1 0 80 40 40 0 1 1 0-80zM392 304a40 40 0 1 1 80 0 40 40 0 1 1-80 0zM168 200c0-13.3 10.7-24 24-24s24 10.7 24 24v32h32c13.3 0 24 10.7 24 24s-10.7 24-24 24H216v32c0 13.3-10.7 24-24 24s-24-10.7-24-24V280H136c-13.3 0-24-10.7-24-24s10.7-24 24-24h32V200z" fill="currentColor"/></svg>' +
          `<span>${OFFER_LABEL}</span>`;
        offerBtn.addEventListener('click', open);

        // Stacked under Cancel: banner, Cancel, hint, button. The notice is
        // already a centered flex column, so appending in order is enough.
        if (OFFER_HINT) {
          offerHint = document.createElement('div');
          offerHint.className = 'saicf-game-hint';
          offerHint.textContent = OFFER_HINT;
          noticeEl.appendChild(offerHint);
        }
        noticeEl.appendChild(offerBtn);
      }, offerDelayMs);
    },

    // Single exit point. Safe to call repeatedly and when nothing is open.
    teardown() {
      removeOffer();
      close();
    },

    isOpen() {
      return !!overlay;
    },

    // The chat window was minimised or opened again.
    setWindowOpen(open) {
      windowOpen = !!open;
      syncPause();
    },
  };
}
