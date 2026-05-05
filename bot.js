import { chromium } from 'playwright';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { writeFileSync, readFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'fs';
import { join } from 'path';

// --- CLI Args ---
const argv = process.argv.slice(2).reduce((acc, a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return { ...acc, [k]: v ?? true };
}, {});

const USE_AI    = 'ai' in argv;
const MODEL     = argv.model || 'gemini-3.1-pro-preview';
const MODE      = argv.mode  || 'advisory';
const URL       = argv.url   || 'https://www.pokernow.club';
const MAX_HANDS = argv.hands ? parseInt(argv.hands) : 20;

// --- Setup ---
mkdirSync('data', { recursive: true });
mkdirSync('logs', { recursive: true });

const runId        = new Date().toISOString().replace(/[:.]/g, '-');
const runFile      = join('data', `run_${runId}.json`);
const manifestFile = join('data', 'manifest.json');
const rawLogFile   = join('logs', `raw_${runId}.jsonl`);

function logRaw(event, data) {
  writeFileSync(rawLogFile, JSON.stringify({ ts: new Date().toISOString(), event, data }) + '\n', { flag: 'a' });
}

// --- Run Data (grouped by hand) ---
const runMeta = { file: `run_${runId}.json`, timestamp: new Date().toISOString(), ai: USE_AI, mode: USE_AI ? MODE : null, model: USE_AI ? MODEL : null, hands: 0, decisions: 0 };
let hands            = [];
let currentHandId    = 1;
let currentDecisions = [];
let currentHandCards = null;

function closeCurrentHand() {
  if (!currentDecisions.length) return;
  const hand = { handId: currentHandId++, holeCards: currentHandCards, startedAt: currentDecisions[0].timestamp, decisions: currentDecisions };
  hands.push(hand);
  currentDecisions = [];
  currentHandCards = null;
  if (gemini) analyzeHand(hand).catch(e => console.error('[Analysis]', e.message));
  if (hands.length >= MAX_HANDS) {
    console.log(`[Bot] Reached ${MAX_HANDS} hands — stopping.`);
    save();
    process.exit(0);
  }
}

async function analyzeHand(hand) {
  if (!hand.decisions.length) return;
  const lines = hand.decisions.map((d, i) => {
    const gs = d.game_state || {};
    const ai = d.ai_metadata || {};
    return `  ${i+1}. [${d.street}] ${ai.decision || d.actual_action || '?'} | pot=${gs.pot} board=${gs.board?.join(' ')||'none'} | ${ai.reasoning || '—'}`;
  }).join('\n');

  const prompt = `Post-hand analysis. Hero held ${hand.holeCards?.join(' ')}.
Decisions:
${lines}

For each decision: was it correct, or was there a better play?
Respond JSON only: {"steps":[{"verdict":"correct|questionable|mistake","note":"1 sentence"}],"overall":"Well played|Acceptable|Missed opportunity","summary":"2 sentences max"}`;

  const res  = await gemini.generateContent(prompt);
  const raw  = res.response.text();
  const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)[0]);
  hand.analysis = parsed;
  console.log(`[Analysis] Hand ${hand.handId}: ${parsed.overall}`);
  save();
}

function save(entry) {
  if (entry) currentDecisions.push(entry);
  const allHands = currentDecisions.length
    ? [...hands, { handId: currentHandId, holeCards: currentHandCards, startedAt: currentDecisions[0]?.timestamp, decisions: currentDecisions }]
    : [...hands];
  const runData = { meta: runMeta, hands: allHands };
  writeFileSync(`${runFile}.tmp`, JSON.stringify(runData, null, 2));
  renameSync(`${runFile}.tmp`, runFile);
  runMeta.hands     = allHands.length;
  runMeta.decisions = allHands.reduce((s, h) => s + h.decisions.length, 0);
  const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : [];
  const i = manifest.findIndex(m => m.file === runMeta.file);
  i >= 0 ? (manifest[i] = runMeta) : manifest.unshift(runMeta);
  while (manifest.length > 20) {
    const old = manifest.pop();
    try { unlinkSync(join('data', old.file)); } catch {}
  }
  writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
}

// --- Game State (driven entirely by WebSocket) ---
let gs = { board: [], pot: 0, holeCards: [], handName: null, players: {}, seats: [], tableBets: {}, cRPI: [], callAmount: 0, bigBlind: 2 };
let heroId      = null;  // account ID — used for private pC card lookups
let turnLock = false;

// --- Session stats for Gemini context ---
let playerStats = {};
let pastHands   = [];     // last 5 completed hands for Gemini context

function updateStats(players = []) {
  for (const p of players) {
    if (!p.name) continue;
    if (!playerStats[p.name]) playerStats[p.name] = { folds: 0, active: 0, seen: 0 };
    playerStats[p.name].seen++;
    if (p.status === 'fold') playerStats[p.name].folds++;
    else if (parseFloat(p.currentBet) > 0) playerStats[p.name].active++;
  }
}

function tendencies() {
  const lines = Object.entries(playerStats)
    .filter(([, s]) => s.seen >= 3)
    .map(([name, s]) => `  ${name}: folds ${Math.round(s.folds/s.seen*100)}%, bets ${Math.round(s.active/s.seen*100)}% (${s.seen} hands)`);
  return lines.length ? lines.join('\n') : '  Insufficient data yet';
}

// --- Merge gC data into game state ---
function mergeGC(data) {
  if (data.pot !== undefined)  gs.pot = data.pot;
  if (data.bigBlind !== undefined) gs.bigBlind = data.bigBlind;
  if (data.seats)              gs.seats = data.seats;
  if (data.cRPI !== undefined) gs.cRPI = data.cRPI;
  if (data.tB)                 gs.tableBets = { ...gs.tableBets, ...data.tB };

  // Player stacks
  if (data.players) {
    for (const [id, p] of Object.entries(data.players)) {
      gs.players[id] = { ...(gs.players[id] || {}), ...p };
    }
  }

  // Community cards — board reset means new hand
  if (data.oTC?.['1'] !== undefined) {
    const board = data.oTC['1'];
    if (gs.board.length > 0 && board.length === 0) {
      // New hand starting — archive current hand
      closeCurrentHand();
      if (currentDecisions.length === 0 && hands.length > 0) {
        pastHands.unshift(hands[hands.length - 1]);
        if (pastHands.length > 5) pastHands.pop();
      }
      gs.holeCards = [];
      gs.handName  = null;
      gs.tableBets = {};
      gs.callAmount = 0;
    }
    gs.board = board;
  }

  // Hero hole cards — server sends own cards with showing:false (private), value is always set
  if (data.pC && heroId && data.pC[heroId]) {
    const pc = data.pC[heroId];
    if (Array.isArray(pc.cards)) {
      const cards = pc.cards.filter(c => c.value).map(c => c.value);
      console.log('[pC] cards:', cards, 'name:', pc.name1 || '—');
      if (cards.length) {
        if (gs.holeCards.length && JSON.stringify(cards) !== JSON.stringify(gs.holeCards)) {
          closeCurrentHand();
        }
        gs.holeCards     = cards;
        gs.handName      = pc.name1 || null;
        currentHandCards = cards;
      }
    }
  }
}

// --- WebSocket frame parser (direction: 'in' | 'out') ---
function parseFrame(payload, direction) {
  const raw = typeof payload === 'string' ? payload : Buffer.from(payload).toString('base64');
  logRaw('ws_' + direction, { raw });   // log every frame, no exceptions

  if (typeof payload !== 'string') return null;
  const prefix = payload.slice(0, 2);
  if (prefix === '42' || prefix === '43' || prefix === '45') {
    try { return { type: prefix, parsed: JSON.parse(payload.slice(2)) }; } catch { return null; }
  }
  return null;
}

// --- Build players list from current state ---
function playersList() {
  return gs.seats.map(([seatNum, playerId]) => {
    const p     = gs.players[playerId] || {};
    const bet   = gs.tableBets[playerId];
    const isHero = playerId === heroId;
    return { name: p.name || playerId.slice(0, 8), stack: p.stack, currentBet: (bet === '<D>' || !bet) ? '0' : String(bet), status: p.status || 'active', isHero, seatNum };
  });
}

// --- Available DOM actions ---
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

// --- Refresh gs from DOM so state is always current at decision time ---
async function refreshStateFromDOM(page) {
  try {
    const potText = await page.$eval('.table-pot-size', el => el.textContent).catch(() => null);
    if (potText) {
      const potNum = parseInt(potText.replace(/[^0-9]/g, ''));
      if (!isNaN(potNum)) gs.pot = potNum;
    }
    // Refresh call amount from the call button label
    const callEl = await page.$('button.action-button.call:not([disabled])');
    if (callEl) {
      const callText = await callEl.textContent();
      const callNum = parseInt(callText.replace(/[^0-9]/g, ''));
      if (!isNaN(callNum)) gs.callAmount = callNum;
    }
  } catch { /* DOM may be mid-update — use existing WS state */ }
}

// --- Gemini ---
const SYS_PROMPT = `You are a seasoned No Limit Texas Hold'em player with 15+ years of mid-to-high stakes experience. You play exploitative GTO — balanced by default, deviating when opponent tendencies justify it.

How you think at every decision:
1. Assess your raw hand strength AND your equity given the board texture
2. Identify your position and use it — be aggressive in position, cautious out of position
3. Read the table: who has been aggressive, who folds too much, who calls too wide
4. Calculate pot odds — only call if your equity exceeds the price
5. Think about your range and opponents' ranges, not just your specific hand
6. Use SPR: below 3 = pot committed (simplify to stack-off or fold), 3–13 = standard play, above 13 = implied odds matter
7. Use stack depth in BBs: under 20BB = push/fold game, 20–40BB = shove-heavy, 40BB+ = full poker
8. Count active players: multiway pots require stronger hands; heads-up allows wider bluffs
9. Factor in bet sizing: read opponent bets as % of pot shown — small = weak/probing, large = polarised

Your rules:
- NEVER fold to a free check. Check is free money.
- NEVER call off your stack drawing thin. Know your outs.
- Raise for value AND as a bluff — mix your frequencies
- Bet sizing: value bets 60–80% pot, bluffs can be smaller (40–60%)
- Only choose from the AVAILABLE ACTIONS listed. Nothing else.

Respond ONLY with valid JSON: {"decision":"FOLD|CHECK|CALL|RAISE","amount":number,"reasoning":"string"}
reasoning: 1–2 sentences of actual poker thinking. No generic statements.`;

const gemini = USE_AI
  ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY).getGenerativeModel({ model: MODEL })
  : null;

async function askGemini(available) {
  const players  = playersList();
  const hero     = players.find(p => p.isHero);
  const street   = !gs.board.length ? 'Pre-flop' : gs.board.length === 3 ? 'Flop' : gs.board.length === 4 ? 'Turn' : 'River';
  const callAmt  = gs.callAmount || 0;
  const potOdds  = callAmt ? `${Math.round(callAmt / (Number(gs.pot) + callAmt) * 100)}% equity needed` : null;
  const heroStack = Number(hero?.stack ?? 0);
  const bb        = Number(gs.bigBlind) || 2;
  const pot       = Number(gs.pot) || 1;
  const stackBB   = Math.round(heroStack / bb);
  const spr       = (heroStack / pot).toFixed(1);
  const activeCnt = players.filter(p => p.status !== 'fold').length;

  const handCtx = currentDecisions.length
    ? currentDecisions.map((d, i) => {
        const who = Object.entries(d.game_state?.tableBets || {})
          .map(([id, v]) => `${gs.players[id]?.name||id.slice(0,8)}:${v}`).join(' ');
        return `  ${i+1}. [${d.street}] ${d.actual_action || d.ai_metadata?.decision}  pot=${d.game_state?.pot}  bets={${who}}`;
      }).join('\n')
    : '  First decision this hand';

  const pastCtx = pastHands.length
    ? pastHands.map((h, i) => `  Hand -${i+1} [${h.holeCards?.join(' ')}]: ${h.decisions.map(d => d.actual_action || d.ai_metadata?.decision).join('→')}`).join('\n')
    : '  No prior hands this session';

  const prompt = `=== SITUATION ===
Street         : ${street}
Hole cards     : ${gs.holeCards.join(' ')}${gs.handName ? `  (${gs.handName})` : ''}
Board          : ${gs.board.length ? gs.board.join(' ') : '(none — pre-flop)'}
Pot            : ${gs.pot}${potOdds ? `   To call: ${callAmt}  [${potOdds}]` : ''}
Hero stack     : ${heroStack}  (${stackBB} BBs)
SPR            : ${spr}  (stack-to-pot ratio)
Active players : ${activeCnt} of ${players.length} still in
Big blind      : ${bb}
Position       : seat ${hero?.seatNum ?? '?'} of ${players.length} (button not tracked — use seat order as proxy)

=== ALL PLAYERS (seat order) ===
${players.map(p =>
  `${p.isHero ? '★' : ' '} [seat ${p.seatNum}] ${(p.name).padEnd(14)} stack=${String(p.stack??'?').padStart(5)} (${Math.round(Number(p.stack||0)/bb)}BB)  bet=${String(p.currentBet).padStart(5)}  ${p.status}`
).join('\n')}

=== BETTING THIS STREET ===
${Object.entries(gs.tableBets).map(([id, v]) => {
  const pct = gs.pot ? Math.round(Number(v) / pot * 100) : 0;
  return `  ${(gs.players[id]?.name||id.slice(0,8)).padEnd(16)}: ${v}  (${pct}% of pot)`;
}).join('\n') || '  none yet'}

=== THIS HAND HISTORY ===
${handCtx}

=== RECENT HANDS ===
${pastCtx}

=== OPPONENT TENDENCIES ===
${tendencies()}

=== AVAILABLE ACTIONS ===
${available.map(a => a.label).join('  |  ')}`;

  const res    = await gemini.generateContent(`${SYS_PROMPT}\n\n${prompt}`);
  const raw    = res.response.text();
  const parsed = JSON.parse(raw.match(/\{[\s\S]*?\}/)[0]);
  return { prompt, raw, ...parsed };
}

function resolveDecision(decision, available) {
  const names = available.map(a => a.action);
  if (names.includes(decision)) return decision;
  for (const f of ['CHECK', 'CALL', 'FOLD']) {
    if (names.includes(f)) { console.log(`[Resolve] ${decision} → ${f}`); return f; }
  }
  return decision;
}

// --- DOM click (auto mode) ---
async function executeAction(page, decision, amount) {
  await page.waitForTimeout(300 + Math.random() * 500);
  // Dismiss any overlay (TOS agreement, notifications) blocking clicks
  const overlay = page.locator('#accept-tos-button, button.decision-button.green');
  if (await overlay.count()) await overlay.first().click().catch(() => {});
  await page.waitForTimeout(200);
  // Re-check available buttons — state may have changed while Gemini was thinking
  const fresh = await getAvailableActions(page);
  if (!fresh.length) { console.log('[Action] Buttons gone before click — hand moved on'); return; }
  const resolved = resolveDecision(decision, fresh);
  const btn = s => page.locator(`button.action-button.${s}:not([disabled])`).first();
  if      (resolved === 'FOLD')  await btn('fold').click();
  else if (resolved === 'CHECK') await btn('check').click();
  else if (resolved === 'CALL')  await btn('call').click();
  else if (resolved === 'RAISE') {
    await btn('raise').click();
    await page.waitForTimeout(400);
    // Try to find and fill the raise amount input (short timeout — if gone, raise already committed)
    try {
      const input = page.locator('input.raise-input, input[type="number"]').first();
      await input.waitFor({ timeout: 2000 });
      await input.fill(String(amount));
      await input.press('Enter');
    } catch {
      // No input appeared — raise button may have directly committed (e.g. all-in)
      console.log('[Action] No raise input found — raise committed directly');
    }
  }
}

// --- Turn handler ---
async function handleTurn(page) {
  if (turnLock) return;
  turnLock = true;
  try {
    // If marked away, click "I'M BACK" first so action buttons appear
    const backBtn = page.locator('button.back-to-game-btn, button:has-text("I\'M BACK")');
    if (await backBtn.count()) {
      console.log('[Bot] Clicking I\'M BACK');
      await backBtn.first().click();
      await page.waitForTimeout(800);
    }

    let available = await getAvailableActions(page);
    if (!available.length) {
      // Buttons briefly absent — wait one tick and retry once
      await page.waitForTimeout(500);
      available = await getAvailableActions(page);
    }
    if (!available.length) { console.log('[Turn] No action buttons after retry — skipping'); return; }

    // Extract call amount from button label
    const callBtn = available.find(a => a.action === 'CALL');
    gs.callAmount = callBtn ? parseInt(callBtn.label.match(/\d+/)?.[0] || '0') : 0;

    const street = !gs.board.length ? 'pre-flop' : gs.board.length === 3 ? 'flop' : gs.board.length === 4 ? 'turn' : 'river';
    console.log(`[Turn] ${street} | ${gs.holeCards.join(' ')} ${gs.handName||''} | board: ${gs.board.join(' ')||'—'} | pot: ${gs.pot}`);
    console.log(`[Turn] Actions: ${available.map(a=>a.label).join(', ')}`);

    if (!gs.holeCards.length) {
      console.log('[Turn] No hole cards yet — waiting up to 3s');
      for (let i = 0; i < 6 && !gs.holeCards.length; i++) await page.waitForTimeout(500);
      if (!gs.holeCards.length) { console.log('[Turn] Gave up waiting for hole cards'); return; }
    }

    await refreshStateFromDOM(page);
    updateStats(playersList());

    if (!USE_AI) {
      save({ timestamp: new Date().toISOString(), street, game_state: structuredClone(gs) });
      return;
    }

    console.log(`[Gemini] Calling... ${gs.holeCards.join(' ')} | ${street} | pot=${gs.pot}`);
    const ai       = await askGemini(available);
    const decision = resolveDecision(ai.decision, available);
    console.log(`[Gemini] ${ai.decision}${ai.amount?' '+ai.amount:''} | ${ai.reasoning}`);

    const entry = {
      timestamp: new Date().toISOString(), street,
      game_state:  structuredClone(gs),
      ai_metadata: { prompt: ai.prompt, raw: ai.raw, decision: ai.decision, amount: ai.amount, reasoning: ai.reasoning },
      actual_action: MODE === 'auto' ? decision : 'PENDING',
      mode: MODE,
    };

    if (MODE === 'auto') {
      await executeAction(page, decision, ai.amount);
      entry.actual_action = decision;
      console.log(`[Action] ${decision}`);
    } else {
      console.log(`[Advisory] ${decision}${ai.amount?' '+ai.amount:''}`);
    }

    save(entry);
  } catch (e) {
    console.error('[Error]', e.message);
    logRaw('error', { message: e.message, stack: e.stack });
  } finally {
    turnLock = false;
  }
}

// --- HTTP response interception (catch any non-WS card delivery) ---
function attachHTTP(page) {
  page.on('response', async res => {
    try {
      const url = res.url();
      const ct  = res.headers()['content-type'] || '';
      if (!ct.includes('json') && !ct.includes('text')) return;
      const body = await res.text().catch(() => '');
      if (!body) return;
      logRaw('http_response', { url, status: res.status(), body: body.slice(0, 2000) });
    } catch { /* ignore */ }
  });
}

// --- DOM turn watcher — polls decision-current class every 500ms (original approach) ---
let turnWatcherStarted = false;

async function startTurnWatcher(page) {
  if (turnWatcherStarted) return;  // only one watcher per session
  turnWatcherStarted = true;
  console.log('[Bot] Turn watcher started');
  let lastSeen = false;
  while (true) {
    try {
      await page.waitForTimeout(500);
      const myTurn = await page.$('div.table-player.you-player.decision-current');
      if (myTurn && !lastSeen) {
        lastSeen = true;
        handleTurn(page);  // fire-and-forget, turnLock prevents overlap
      } else if (!myTurn) {
        lastSeen = false;
      }
    } catch { /* page navigating — keep looping */ }
  }
}

// --- WebSocket attachment ---
function attachWS(page) {
  attachHTTP(page);
  page.on('websocket', ws => {
    if (!ws.url().includes('pokernow')) return;
    console.log('[WS] Connected:', ws.url());
    startTurnWatcher(page);  // no-op if already running

    ws.on('framesent', ({ payload }) => {
      parseFrame(payload, 'out');
    });

    ws.on('framereceived', ({ payload }) => {
      const frame = parseFrame(payload, 'in');
      if (!frame) return;
      const [event, data] = frame.parsed || [];
      if (!event) return;

      if (event === 'registered') {
        heroId = data?.currentPlayer?.id;
        mergeGC(data?.gameState || {});
        console.log('[Hero] ID:', heroId);

      } else if (event === 'gC') {
        mergeGC(data);

      } else {
        console.log(`[WS] ${event}`);
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

  console.log(`[Bot] ${USE_AI ? `AI (${MODEL}, ${MODE})` : 'Capture only'} | ${runFile}`);
  console.log('[Bot] Login and join your PokerNow game...');

  await new Promise(() => {}); // stay alive — WS events drive everything
}

main().catch(console.error);
