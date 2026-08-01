// Whack-a-Mole — something pops up, you tap it.
//
// The design brief here is "no hidden rule". Memory works in a waiting room
// because tapping a card does something immediately. Two earlier attempts were
// dropped for the opposite reason: one needed you to know to swipe, the other
// to watch a sequence and repeat it. In both the rule lived in the player's
// head instead of on the screen.
//
// So: no gestures, no sequence to remember, no way to lose. A miss costs
// nothing — someone who is already waiting on support should not also be
// punished by the distraction. The only feedback is the score going up.

// A target, not a logo. The holes are circles, so a squared-off app icon sat
// in them as an obvious shape mismatch. Concentric rings read as "hit this"
// without a word of explanation, and `currentColor` means the target inherits
// the bot's own theme colour instead of hardcoding a brand into someone
// else's white-labelled widget.
const TARGET_SVG =
  '<svg viewBox="0 0 100 100" aria-hidden="true">'
  + '<circle cx="50" cy="50" r="48" fill="currentColor"/>'
  + '<circle cx="50" cy="50" r="31" fill="none" stroke="#fff" stroke-width="10" opacity=".6"/>'
  + '<circle cx="50" cy="50" r="12" fill="#fff"/>'
  + '</svg>';

const HOLES = 9;
const ROUND_MS = 30000;
const TICK_MS = 100;

// The mole gets quicker as the round goes on, but never unfair.
const UP_START = 1100;
const UP_END = 620;
const GAP_MS = 260;

export function createWhackGame() {
  let root = null;
  let holeEls = [];
  let statusEl = null;
  let ringEl = null;
  let secsEl = null;
  let scoreEl = null;
  let restart = null;

  let score = 0;
  let remaining = ROUND_MS;
  let activeIndex = -1;
  let lastIndex = -1;
  let over = false;
  let running = false;
  let tickTimer = null;
  let moleTimer = null;

  function clearTimers() {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    if (moleTimer) { clearTimeout(moleTimer); moleTimer = null; }
  }

  // Ring circumference for r=15. The stroke is drawn as one dash of this
  // length and pushed out of view by the offset, so the ring visibly empties.
  const RING = 2 * Math.PI * 15;

  function buildStatus() {
    statusEl.className = 'saicf-game-status has-timer';
    statusEl.innerHTML =
      '<span class="saicf-game-timer">'
      + '<svg viewBox="0 0 36 36" aria-hidden="true">'
      + '<circle class="saicf-game-timer-track" cx="18" cy="18" r="15"/>'
      + '<circle class="saicf-game-timer-prog" cx="18" cy="18" r="15"/>'
      + '</svg></span>'
      + '<span class="saicf-game-timer-secs"></span>'
      + '<span class="saicf-game-status-sep">·</span>'
      + '<span class="saicf-game-timer-score"></span>';
    ringEl = statusEl.querySelector('.saicf-game-timer-prog');
    ringEl.style.strokeDasharray = RING;
    secsEl = statusEl.querySelector('.saicf-game-timer-secs');
    scoreEl = statusEl.querySelector('.saicf-game-timer-score');
  }

  function renderStatus() {
    if (!statusEl || !ringEl) return;
    const secs = Math.ceil(remaining / 1000);
    secsEl.textContent = `${secs}s`;
    scoreEl.textContent = `Score ${score}`;
    ringEl.style.strokeDashoffset = RING * (1 - remaining / ROUND_MS);
  }

  function hide() {
    if (activeIndex >= 0 && holeEls[activeIndex]) {
      holeEls[activeIndex].classList.remove('is-up');
    }
    activeIndex = -1;
  }

  function upDuration() {
    const progress = 1 - remaining / ROUND_MS; // 0 at start, 1 at the end
    return Math.round(UP_START - (UP_START - UP_END) * progress);
  }

  function popNext() {
    if (over || !running) return;
    let next = Math.floor(Math.random() * HOLES);
    // Never twice in the same hole: it reads as a stuck mole, not a new one.
    if (next === lastIndex) next = (next + 1 + Math.floor(Math.random() * (HOLES - 1))) % HOLES;
    lastIndex = next;
    activeIndex = next;
    holeEls[next].classList.add('is-up');

    moleTimer = setTimeout(() => {
      hide();
      // A missed mole costs nothing. Straight on to the next one.
      moleTimer = setTimeout(popNext, GAP_MS);
    }, upDuration());
  }

  function finish() {
    over = true;
    running = false;
    clearTimers();
    hide();
    // Back to a plain line: the ring is spent, and has-timer would keep the
    // flex row layout for a single sentence.
    ringEl = null;
    statusEl.className = 'saicf-game-status is-win';
    statusEl.textContent = score === 0 ? 'Time! Next round?' : `Time! You got ${score}`;
    const again = document.createElement('button');
    again.type = 'button';
    again.className = 'saicf-game-again';
    again.textContent = 'Play again';
    again.addEventListener('click', () => restart?.());
    root.appendChild(again); // below the board, see memory.js
  }

  function start() {
    running = true;
    tickTimer = setInterval(() => {
      remaining -= TICK_MS;
      if (remaining <= 0) {
        remaining = 0;
        renderStatus();
        finish();
        return;
      }
      renderStatus();
    }, TICK_MS);
    popNext();
  }

  function onHole(i) {
    if (over || i !== activeIndex) return; // tapping an empty hole does nothing
    score++;
    const el = holeEls[i];
    el.classList.remove('is-up');
    el.classList.add('is-hit');
    setTimeout(() => el.classList.remove('is-hit'), 200);
    activeIndex = -1;
    renderStatus();

    // Reward a hit with the next mole sooner than a miss would.
    if (moleTimer) { clearTimeout(moleTimer); moleTimer = null; }
    moleTimer = setTimeout(popNext, 180);
  }

  return {
    id: 'whack',
    label: 'Whack-a-Mole',

    mount(el, ctx = {}) {
      root = el;
      restart = ctx.restart || null;
      clearTimers();
      score = 0;
      remaining = ROUND_MS;
      activeIndex = -1;
      lastIndex = -1;
      over = false;
      running = false;

      const fit = document.createElement('div');
      fit.className = 'saicf-game-fit';

      const board = document.createElement('div');
      board.className = 'saicf-game-whack-board';
      holeEls = [];
      for (let i = 0; i < HOLES; i++) {
        const hole = document.createElement('button');
        hole.type = 'button';
        hole.className = 'saicf-game-whack-hole';
        hole.setAttribute('aria-label', `Hole ${i + 1}`);
        hole.innerHTML = `<span class="saicf-game-whack-mole">${TARGET_SVG}</span>`;
        hole.addEventListener('click', () => onHole(i));
        board.appendChild(hole);
        holeEls.push(hole);
      }

      statusEl = document.createElement('div');
      buildStatus();

      fit.appendChild(board);
      root.appendChild(statusEl); // score sits above the board
      root.appendChild(fit);

      renderStatus();
      start();
    },

    // The clock must not run while the tab is hidden, or the visitor comes
    // back to a finished round they never got to play.
    pause() {
      if (over) return;
      running = false;
      clearTimers();
      hide();
    },

    resume() {
      if (over || running) return;
      start();
    },

    destroy() {
      clearTimers();
      holeEls = [];
      statusEl = null;
      ringEl = null;
      secsEl = null;
      scoreEl = null;
      over = false;
      running = false;
      if (root) root.innerHTML = '';
      root = null;
    },
  };
}
