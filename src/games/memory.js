// Memory / pairs — the first waiting-room game.
//
// Deliberately DOM-only (no canvas): it is the cheapest possible way to
// validate the whole mount/destroy/interrupt contract, and a tap-only game
// needs no input abstraction on mobile. Canvas games (Snake, Breakout) come
// later and plug into the same interface, see ./index.js.
//
// Symbols are emoji on purpose — zero asset bytes, no sprite sheet, no
// network request. A widget that already ships on every customer page
// cannot afford image payloads for a filler game.

const SYMBOLS = ['\u{1F340}', '\u{1F31F}', '\u{1F388}', '\u{1F369}', '\u{1F3A7}', '\u{1F680}', '\u{1F419}', '\u{1F352}'];

const FLIP_BACK_MS = 750;

function shuffle(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function createMemoryGame() {
  let root = null;
  let flipTimer = null;
  let first = null;
  let busy = false;
  let moves = 0;
  let matched = 0;
  let statusEl = null;
  let restart = null;

  function clearFlipTimer() {
    if (flipTimer) {
      clearTimeout(flipTimer);
      flipTimer = null;
    }
  }

  function onCardClick(card) {
    // Guard every re-entrant path: mid-flip-back, already-open, already-matched.
    if (busy || card.classList.contains('is-open') || card.classList.contains('is-matched')) return;

    card.classList.add('is-open');

    if (!first) {
      first = card;
      return;
    }

    moves++;
    const second = card;

    if (first.dataset.symbol === second.dataset.symbol) {
      first.classList.add('is-matched');
      second.classList.add('is-matched');
      first = null;
      matched++;
      if (matched === SYMBOLS.length) {
        statusEl.textContent = `Solved in ${moves} moves`;
        statusEl.classList.add('is-win');
        // The restart icon in the bar is too quiet to read as "next round".
        const again = document.createElement('button');
        again.type = 'button';
        again.className = 'saicf-game-again';
        again.textContent = 'Play again';
        again.addEventListener('click', () => restart?.());
        // Below the board: the status now sits on top, and a button wedged
        // between the score and the board reads as part of the score line.
        root.appendChild(again);
      } else {
        statusEl.textContent = `${moves} moves`;
      }
      return;
    }

    busy = true;
    statusEl.textContent = `${moves} moves`;
    const a = first;
    first = null;
    flipTimer = setTimeout(() => {
      a.classList.remove('is-open');
      second.classList.remove('is-open');
      busy = false;
      flipTimer = null;
    }, FLIP_BACK_MS);
  }

  return {
    id: 'memory',
    label: 'Memory Game',

    mount(el, ctx = {}) {
      root = el;
      restart = ctx.restart || null;
      clearFlipTimer();
      first = null;
      busy = false;
      moves = 0;
      matched = 0;

      // .saicf-game-fit absorbs the leftover stage height so the square board
      // can size itself from it. See gameStyles() in ./index.js.
      const fit = document.createElement('div');
      fit.className = 'saicf-game-fit';
      const board = document.createElement('div');
      board.className = 'saicf-game-memory-board';

      const deck = shuffle(SYMBOLS.concat(SYMBOLS));
      deck.forEach((symbol, i) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'saicf-game-memory-card';
        card.dataset.symbol = symbol;
        card.setAttribute('aria-label', `Card ${i + 1}`);
        card.innerHTML =
          '<span class="saicf-game-memory-back"></span>' +
          `<span class="saicf-game-memory-face">${symbol}</span>`;
        card.addEventListener('click', () => onCardClick(card));
        board.appendChild(card);
      });

      statusEl = document.createElement('div');
      statusEl.className = 'saicf-game-status';
      statusEl.textContent = 'Find all eight pairs';

      fit.appendChild(board);
      root.appendChild(statusEl); // score sits above the board
      root.appendChild(fit);
    },

    // Nothing time-critical runs between turns, but the flip-back timer would
    // otherwise fire against a backgrounded tab and silently consume the
    // player's peek at the second card.
    pause() {
      clearFlipTimer();
    },

    resume() {
      if (busy) {
        root.querySelectorAll('.saicf-game-memory-card.is-open:not(.is-matched)')
          .forEach((c) => c.classList.remove('is-open'));
        busy = false;
      }
    },

    destroy() {
      clearFlipTimer();
      first = null;
      busy = false;
      statusEl = null;
      if (root) root.innerHTML = '';
      root = null;
    },
  };
}
