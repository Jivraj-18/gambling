import { chromium } from 'playwright';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { writeFileSync, readFileSync, existsSync, mkdirSync, renameSync } from 'fs';
import { join } from 'path';

// --- CLI Args ---
const argv = process.argv.slice(2).reduce((acc, a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return { ...acc, [k]: v ?? true };
}, {});

const USE_AI = 'ai' in argv;
const MODEL  = argv.model || 'gemini-3.1-pro-preview';
const MODE   = argv.mode  || 'advisory';
const URL    = argv.url   || 'https://www.pokernow.club';

// --- Setup ---
mkdirSync('data', { recursive: true });
mkdirSync('logs', { recursive: true });

const runId        = new Date().toISOString().replace(/[:.]/g, '-');
const runFile      = join('data', `run_${runId}.json`);
const manifestFile = join('data', 'manifest.json');
const rawLogFile   = join('logs', `raw_${runId}.jsonl`);
const runMeta      = { file: `run_${runId}.json`, timestamp: new Date().toISOString(), ai: USE_AI, mode: USE_AI ? MODE : null, entries: 0 };
const entries      = [];

function logRaw(event, data) {
  const line = JSON.stringify({ timestamp: new Date().toISOString(), event, data }) + '\n';
  writeFileSync(rawLogFile, line, { flag: 'a' });
}

function save() {
  writeFileSync(`${runFile}.tmp`, JSON.stringify(entries, null, 2));
  renameSync(`${runFile}.tmp`, runFile);
  runMeta.entries = entries.length;
  const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : [];
  const i = manifest.findIndex(m => m.file === runMeta.file);
  i >= 0 ? (manifest[i] = runMeta) : manifest.unshift(runMeta);
  writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
}

// --- Game State (from WebSocket) ---
let gameState    = { recentActions: [], players: {}, pot: 0 };
let heroId       = null;
let turnLock     = false;
let gamePage     = null;

// --- Session History ---
let currentHand  = [];          // decisions made in the current hand
let pastHands    = [];          // completed hands (last 5)
let playerStats  = {};          // per-player: { folds, active, seen }
let lastHoleCards = null;       // detect new hand when hole cards change

function detectNewHand(holeCards) {
  const key = JSON.stringify(holeCards);
  if (lastHoleCards && lastHoleCards !== key && currentHand.length) {
    pastHands.unshift({ decisions: currentHand });
    if (pastHands.length > 5) pastHands.pop();
    currentHand = [];
  }
  lastHoleCards = key;
}

function updatePlayerStats(players = []) {
  for (const p of players) {
    if (!p.name) continue;
    if (!playerStats[p.name]) playerStats[p.name] = { folds: 0, active: 0, seen: 0 };
    playerStats[p.name].seen++;
    if (p.status === 'fold') playerStats[p.name].folds++;
    else if (parseFloat(p.currentBet) > 0) playerStats[p.name].active++;
  }
}

function tendencySummary() {
  return Object.entries(playerStats)
    .filter(([, s]) => s.seen >= 3)
    .map(([name, s]) => {
      const foldPct   = Math.round(s.folds  / s.seen * 100);
      const activePct = Math.round(s.active / s.seen * 100);
      return `  ${name}: ${foldPct}% fold, ${activePct}% bet/call (${s.seen} obs)`;
    }).join('\n') || '  Not enough data yet';
}

// --- WebSocket Parser ---
function parseFrame(payload) {
  if (typeof payload !== 'string' || !payload.startsWith('42')) return null;
  try { return JSON.parse(payload.slice(2)); } catch { return null; }
}

// --- DOM State Extraction ---
async function extractFromDOM(page) {
  const state = {};
  try {
    // Hero hole cards
    const cardEls = page.locator('.table-player.you-player .table-player-cards .card-container.flipped .card');
    const cardCount = await cardEls.count();
    if (cardCount > 0) {
      state.holeCards = [];
      for (let i = 0; i < cardCount; i++) {
        const el   = cardEls.nth(i);
        const val  = (await el.locator('.value').textContent()).trim();
        const suit = (await el.locator('.suit').last().textContent()).trim();
        state.holeCards.push(val + suit);
      }
    }

    // Board cards
    const boardEls = page.locator('.table-cards .card-container.flipped.big .card');
    const boardCount = await boardEls.count();
    state.board = [];
    for (let i = 0; i < boardCount; i++) {
      const el   = boardEls.nth(i);
      const val  = (await el.locator('.value').textContent()).trim();
      const suit = (await el.locator('.suit').last().textContent()).trim();
      state.board.push(val + suit);
    }

    // Pot
    const addOnPot = page.locator('.table-pot-size .add-on .normal-value');
    const mainPot  = page.locator('.table-pot-size .main-value .normal-value');
    state.pot = await (await addOnPot.count() ? addOnPot : mainPot).textContent().then(t => t.trim());

    // All players: name, stack, current bet, status (fold/active/away)
    const playerEls = page.locator('.table-player');
    const pCount    = await playerEls.count();
    state.players   = [];
    for (let i = 0; i < pCount; i++) {
      const el     = playerEls.nth(i);
      const classes = await el.getAttribute('class') || '';
      const isHero  = classes.includes('you-player');
      const isFold  = classes.includes('fold');
      const isAway  = classes.includes('offline');

      const nameEl  = el.locator('.table-player-name a, .table-player-name span').first();
      const stackEl = el.locator('.table-player-stack .normal-value');
      const betEl   = el.locator('.table-player-bet-value .normal-value');

      const name  = await nameEl.count()  ? (await nameEl.textContent()).trim()  : null;
      const stack = await stackEl.count() ? (await stackEl.textContent()).trim() : null;
      const bet   = await betEl.count()   ? (await betEl.textContent()).trim()   : '0';

      if (!name) continue;
      const player = { name, stack, currentBet: bet, status: isFold ? 'fold' : isAway ? 'away' : 'active' };
      if (isHero) { player.isHero = true; state.heroStack = stack; }
      state.players.push(player);
    }

    // Current bet to call (from button label e.g. "Call 4")
    const callBtn = page.locator('button.action-button.call');
    if (await callBtn.count()) {
      const label = (await callBtn.first().textContent()).trim();
      const match = label.match(/\d+/);
      state.callAmount = match ? parseInt(match[0]) : 0;
    } else {
      state.callAmount = 0;
    }

    // Raise range (min/max from input if raise panel is open)
    const raiseInput = page.locator('input.raise-input, input[type="number"]');
    if (await raiseInput.count()) {
      state.raiseMin = await raiseInput.getAttribute('min');
      state.raiseMax = await raiseInput.getAttribute('max');
    }

    // Dealer position (which seat has the D button)
    const dealerEl = page.locator('.dealer-button-ctn');
    if (await dealerEl.count()) {
      const cls = await dealerEl.getAttribute('class') || '';
      const pos = cls.match(/dealer-position-(\d+)/);
      state.dealerPosition = pos ? pos[1] : null;
    }

  } catch (e) {
    logRaw('dom_extract_error', { message: e.message });
  }
  return { ...gameState, ...state };
}

// --- Read which buttons are actually enabled in DOM ---
async function getAvailableActions(page) {
  const available = [];
  for (const name of ['check', 'call', 'raise', 'fold']) {
    const el = page.locator(`button.action-button.${name}:not([disabled])`);
    if (await el.count()) {
      const label = (await el.first().textContent()).trim();
      available.push({ action: name.toUpperCase(), label });
    }
  }
  return available;
}

// --- Compute position label from seat numbers ---
function getPositionLabel(state) {
  const dealer   = parseInt(state.dealerPosition);
  const heroEl   = (state.players || []).findIndex(p => p.isHero);
  const active   = (state.players || []).filter(p => p.status !== 'away');
  const n        = active.length;
  if (!dealer || heroEl < 0 || n < 2) return 'unknown';
  const dealerIdx = active.findIndex(p => p.seatNum == dealer);
  const relPos    = ((heroEl - dealerIdx + n) % n);
  if (relPos === 0) return 'BTN (Button)';
  if (relPos === 1) return 'SB (Small Blind)';
  if (relPos === 2) return 'BB (Big Blind)';
  if (relPos === n - 1) return 'CO (Cutoff)';
  if (relPos <= Math.floor(n / 3)) return 'EP (Early Position)';
  return 'MP (Middle Position)';
}

// --- Compute pot odds ---
function potOdds(pot, callAmount) {
  if (!callAmount || callAmount === 0) return null;
  const total  = (parseFloat(pot) || 0) + (parseFloat(callAmount) || 0);
  const equity = Math.round((callAmount / total) * 100);
  return `${equity}% equity needed to break even`;
}

// --- Gemini ---
const SYS_PROMPT = `You are a seasoned No Limit Texas Hold'em poker player with 15+ years of experience at mid-to-high stakes cash games. You play a balanced, exploitative style — primarily GTO but willing to deviate when opponent tendencies justify it.

Your playing style:
- Aggressive in position: bet and raise to take control, don't let opponents see free cards
- Exploit weak players: bluff more against tight folders, value-bet thinner against calling stations
- Protect your stack: fold speculative hands when pot odds don't justify the risk
- Mix your play: don't be predictable — sometimes slow-play, sometimes bet big
- Think in ranges: consider what hands opponents likely have given their actions
- Never results-oriented: make the decision with the highest expected value, not the "safe" one

Rules you never break:
1. NEVER fold to a free check — if check is available, always at least check
2. NEVER call off your stack with a weak hand just to stay in the game
3. ALWAYS consider pot odds before calling
4. ONLY choose from the available actions listed

Respond ONLY with valid JSON: {"decision":"FOLD|CHECK|CALL|RAISE","amount":number,"reasoning":"string"}
The reasoning must be a concise 1–2 sentence poker thought process, not a generic statement.`;

const gemini = USE_AI
  ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY).getGenerativeModel({ model: MODEL })
  : null;

async function askGemini(state, availableActions) {
  const position = getPositionLabel(state);
  const odds          = potOdds(state.pot, state.callAmount);

  const handCtx = currentHand.length
    ? `This hand so far:\n${currentHand.map((d, i) => `  ${i + 1}. ${d.street} — Hero: ${d.heroAction}, Pot: ${d.pot}`).join('\n')}`
    : 'First decision this hand (pre-flop open).';

  const pastCtx = pastHands.length
    ? `Recent hands (hero actions):\n${pastHands.map((h, i) => `  Hand -${i + 1}: ${h.decisions.map(d => d.heroAction).join(' → ')}`).join('\n')}`
    : '';

  const prompt = `=== CURRENT SITUATION ===
Hero hole cards : ${JSON.stringify(state.holeCards)}
Board           : ${state.board?.length ? JSON.stringify(state.board) : 'none — PRE-FLOP'}
Street          : ${!state.board?.length ? 'Pre-flop' : state.board.length === 3 ? 'Flop' : state.board.length === 4 ? 'Turn' : 'River'}
Hero position   : ${position}
Hero stack      : ${state.heroStack}
Pot             : ${state.pot}
To call         : ${state.callAmount ?? 0}${odds ? `  (${odds})` : ''}
${state.raiseMin ? `Raise range     : ${state.raiseMin} – ${state.raiseMax}` : ''}

=== PLAYERS ===
${(state.players || []).map(p =>
  `  ${p.isHero ? '★ YOU' : '      '} ${p.name.padEnd(15)} stack=${String(p.stack).padStart(4)}  bet=${String(p.currentBet).padStart(4)}  [${p.status}]`
).join('\n')}

=== HAND HISTORY ===
${handCtx}
${pastCtx}

=== OPPONENT TENDENCIES (session) ===
${tendencySummary()}

=== AVAILABLE ACTIONS ===
${availableActions.map(a => a.label).join('  |  ')}`;

  const res    = await gemini.generateContent(`${SYS_PROMPT}\n\n${prompt}`);
  const raw    = res.response.text();
  const parsed = JSON.parse(raw.match(/\{[\s\S]*?\}/)[0]);
  return { prompt, raw, ...parsed };
}

// --- Validate Gemini decision against available actions, fallback if needed ---
function resolveDecision(decision, availableActions) {
  const names = availableActions.map(a => a.action);
  if (names.includes(decision)) return decision;
  // Fallback order: CHECK → CALL → FOLD (never default to FOLD first)
  for (const fallback of ['CHECK', 'CALL', 'FOLD']) {
    if (names.includes(fallback)) {
      console.log(`[Warning] ${decision} not available, falling back to ${fallback}`);
      return fallback;
    }
  }
  return decision;
}

// --- DOM Actions ---
async function executeAction(page, decision, amount) {
  await page.waitForTimeout(2000 + Math.random() * 3000);
  const btn = (sel) => page.locator(`button.action-button.${sel}:not([disabled])`).first();

  if      (decision === 'FOLD')  await btn('fold').click();
  else if (decision === 'CHECK') await btn('check').click();
  else if (decision === 'CALL')  await btn('call').click();
  else if (decision === 'RAISE') {
    await btn('raise').click();
    const input = page.locator('input.raise-input, input[type="number"]').first();
    await input.fill(String(amount));
    await input.press('Enter');
  }
}

// --- Safe fallback when no card data ---
async function safeDefault(page, available) {
  const names = available.map(a => a.action);
  const pick  = ['CHECK', 'CALL'].find(a => names.includes(a));
  if (pick) {
    console.log(`[Advisory] Suggest: ${pick} (no card data)`);
    if (MODE === 'auto') { await page.waitForTimeout(1500); await executeAction(page, pick, 0); }
  } else {
    console.log('[Advisory] No safe fallback — please act manually');
  }
}

// --- AI Turn Handler ---
async function handleTurn(page) {
  if (turnLock) return;
  turnLock = true;

  try {
    const [state, available] = await Promise.all([extractFromDOM(page), getAvailableActions(page)]);
    console.log('[Turn] Available actions:', available.map(a => a.label).join(', '));

    // Track new hand and update player tendency stats
    if (state.holeCards?.length) detectNewHand(state.holeCards);
    updatePlayerStats(state.players);

    if (!state.holeCards?.length) {
      console.log('[Turn] No hole cards in DOM');
      await safeDefault(page, available);
      return;
    }

    const street = !state.board?.length ? 'pre-flop' : state.board.length === 3 ? 'flop' : state.board.length === 4 ? 'turn' : 'river';
    console.log('[Turn] Cards:', state.holeCards, '| Street:', street, '| Board:', state.board, '| Pot:', state.pot);

    if (!USE_AI) {
      entries.push({ timestamp: new Date().toISOString(), game_state: state });
      save();
      return;
    }

    const ai      = await askGemini(state, available);
    const decision = resolveDecision(ai.decision, available);
    console.log(`[Gemini] ${ai.decision} ${ai.amount || ''} | ${ai.reasoning}`);
    if (decision !== ai.decision) console.log(`[Resolved] Using ${decision} instead`);

    // Record this decision into current hand history
    currentHand.push({ street, heroAction: `${decision}${ai.amount ? ' ' + ai.amount : ''}`, pot: state.pot });

    const entry = {
      timestamp:     new Date().toISOString(),
      game_state:    state,
      ai_metadata:   { prompt: ai.prompt, raw: ai.raw, decision: ai.decision, amount: ai.amount, reasoning: ai.reasoning },
      actual_action: MODE === 'auto' ? decision : 'PENDING',
      mode: MODE,
    };

    if (MODE === 'auto') {
      await executeAction(page, decision, ai.amount);
      entry.actual_action = decision;
      console.log(`[Action] Executed: ${decision}`);
    } else {
      console.log(`[Advisory] Suggested: ${decision} ${ai.amount || ''}`);
    }

    entries.push(entry);
    save();
  } catch (e) {
    console.error('[Error]', e.message);
    logRaw('error', { message: e.message, stack: e.stack });
  } finally {
    turnLock = false;
  }
}

// --- WebSocket Listener ---
function attachWS(page) {
  page.on('websocket', ws => {
    if (!ws.url().includes('pokernow')) return;
    console.log('[WS] Connected:', ws.url());
    gamePage = page;

    // Log outgoing frames — needed to learn action format for future WS-based actions
    ws.on('framesent', ({ payload }) => {
      if (typeof payload === 'string' && payload.startsWith('42')) {
        const frame = parseFrame(payload);
        if (frame) logRaw('sent', frame);
      }
    });

    ws.on('framereceived', ({ payload }) => {
      const frame = parseFrame(payload);
      if (!frame) return;
      const [event, data] = frame;
      logRaw(event, data);

      if (event === 'registered') {
        heroId = data?.currentPlayer?.id;
        console.log('[Hero] ID:', heroId);
        const gs = data?.gameState || {};
        if (gs.players) gameState.players = gs.players;
        if (gs.seats)   gameState.seats   = gs.seats;
        if (gs.pot != null) gameState.pot = gs.pot;
        gameState.heroId = heroId;

      } else if (event === 'gC') {
        // Heartbeat — eventsData carries incremental updates when non-empty
        const events = data?.eventsData;
        if (Array.isArray(events) && events.length) {
          events.forEach(e => gameState.recentActions.push(e));
          if (gameState.recentActions.length > 20) gameState.recentActions = gameState.recentActions.slice(-20);
          logRaw('gC_events', events);
        }

      } else if (event === 'action') {
        gameState.recentActions.push(data);
        if (gameState.recentActions.length > 20) gameState.recentActions.shift();
        if (!USE_AI) {
          entries.push({ timestamp: new Date().toISOString(), event: 'action', action_data: data, game_state: structuredClone(gameState) });
          save();
          console.log(`[Action] ${data?.type || JSON.stringify(data).slice(0, 80)}`);
        }

      } else {
        console.log(`[WS event] ${event}`);
      }
    });
  });
}

// --- Main ---
async function main() {
  const browser = await chromium.launch({ headless: false });

  browser.on('page', page => { console.log('[Page] New tab'); attachWS(page); });

  const page = await browser.newPage();
  attachWS(page);
  await page.goto(URL);

  console.log(`[Bot] Mode: ${USE_AI ? `AI (${MODEL}, ${MODE})` : 'Capture only'} | ${runFile}`);
  console.log('[Bot] Login and join your PokerNow game...');

  if (USE_AI) {
    let lastSeen = false;
    while (true) {
      await new Promise(r => setTimeout(r, 500));
      const active = gamePage || page;
      try {
        const myTurn = await active.$('div.table-player.you-player.decision-current');
        if (myTurn && !lastSeen) {
          lastSeen = true;
          await handleTurn(active);
        } else if (!myTurn) {
          lastSeen = false;
        }
      } catch (e) {
        logRaw('dom_error', { message: e.message });
      }
    }
  }
}

main().catch(console.error);
