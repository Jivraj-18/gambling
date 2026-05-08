// gemini-live.js — Gemini plays, everything captured, analysis done later
import WebSocket from 'ws';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { appendFileSync, writeFileSync } from 'fs';

const GAME_ID = 'pglYSBbcroTrz1BexlA9W2_DC';
const COOKIE  = 'npt=kZ6_r29vdNkCcnx_8YXXnLc7U6ONR1TCApOntNFv-oILwE0lRH; _ga_6XKYK79KZ9=GS2.1.s1778212928$o3$g1$t1778214963$j60$l0$h0; _ga=GA1.2.573723277.1778155911; _gid=GA1.2.1031275976.1778155911; apt=ipgnpasbtylm0dqcckwpvn7pjakinr8oh59ym402m5aln';
const WS_URL  = `wss://www.pokernow.com/socket.io/?gameID=${GAME_ID}&firstConnection=true&layout=d&EIO=3&transport=websocket`;

const LIVE_LOG     = '/tmp/gemini-live.log';    // human-readable, everything
const SESSION_JSON = '/tmp/session-data.json';  // structured JSON, for analysis later

const gemini = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
  .getGenerativeModel({ model: 'gemini-2.5-flash' });

// ─── Game state ────────────────────────────────────────────────
let gs = {
  board: [], pot: 0, holeCards: [], bigBlind: 2,
  players: {}, seats: [], callAmount: 0, tB: {},
};
let heroId   = null;
let deciding = false;
let lastTurnKey = '';

// ─── Session-level record (written to JSON after every hand) ───
let session = {
  gameId: GAME_ID,
  startedAt: new Date().toISOString(),
  heroId: null,
  hands: [],
};

// ─── Per-hand state ────────────────────────────────────────────
let hand = {
  id: null, handNumber: 0,
  startedAt: null,
  holeCards: [], board: [],
  stackBefore: null, stackAfter: null,
  // Every Gemini call: { street, promptSent, fullResponse, decision, timestamp }
  geminiCalls: [],
  // Every bet by any player: { time, street, playerId, playerName, action, amount, totalInPot, pot }
  bettingTimeline: [],
  // Per player total chips in this hand
  playerContributions: {},
  // What hero actually did at each decision point
  heroActions: [],
  prevTB: {},
  pendingDecision: null,
};
let handCount = 0;

// ─── Logging ───────────────────────────────────────────────────
function log(msg) {
  const ts   = new Date().toISOString().slice(11, 19);
  const line = `[${ts}] ${msg}`;
  console.log(line);
  appendFileSync(LIVE_LOG, line + '\n');
}

function logBlock(header, body) {
  const sep = '─'.repeat(55);
  log(`\n${sep}`);
  log(header);
  body.split('\n').forEach(l => appendFileSync(LIVE_LOG, `          ${l}\n`));
  console.log(body);
  log(sep);
}

function saveSession() {
  writeFileSync(SESSION_JSON, JSON.stringify(session, null, 2));
}

// ─── Helpers ───────────────────────────────────────────────────
function heroStack() {
  return Number((heroId ? gs.players[heroId] : null)?.stack ?? 0);
}

function currentStreet() {
  const b = gs.board.length;
  return b === 0 ? 'pre-flop' : b === 3 ? 'flop' : b === 4 ? 'turn' : 'river';
}

function playerName(id) {
  return gs.players[id]?.name || id.slice(0, 8);
}

function allOpponents() {
  return gs.seats
    .map(([, id]) => gs.players[id])
    .filter(p => p && !p.isHero)
    .map(p => ({ name: p.name || '?', stack: p.stack, status: p.status }));
}

function parseTB(rawTB) {
  if (!rawTB || typeof rawTB !== 'object') return {};
  const r = {};
  for (const [id, val] of Object.entries(rawTB))
    r[id] = Number(val?.value ?? val ?? 0);
  return r;
}

function bettingTimelineText() {
  if (!hand.bettingTimeline.length) return '  (no bets recorded yet)';
  return hand.bettingTimeline
    .map(e => `  [${e.time}] ${e.street.padEnd(8)} | ${e.playerName.padEnd(16)} | ${e.action.padEnd(5)} ${String(e.amount).padStart(4)} chips  (total in pot from them: ${e.totalInPot}, pot was: ${e.pot})`)
    .join('\n');
}

function contributionsSummary() {
  return Object.entries(hand.playerContributions)
    .sort(([, a], [, b]) => b - a)
    .map(([id, total]) => `${playerName(id)}: ${total}`)
    .join(' | ') || 'none';
}

// ─── Merge WS game state ───────────────────────────────────────
function merge(data) {
  if (data.pot      !== undefined) gs.pot      = data.pot;
  if (data.bigBlind !== undefined) gs.bigBlind = data.bigBlind;
  if (data.seats)  gs.seats = data.seats;
  if (data.players)
    for (const [id, p] of Object.entries(data.players))
      gs.players[id] = { ...gs.players[id], ...p };
  if (data.oTC?.['1'] !== undefined) {
    gs.board = data.oTC['1'];
    hand.board = [...gs.board];
  }
  if (heroId && data.pC?.[heroId]) {
    const cards = (data.pC[heroId].cards || []).filter(c => c.value).map(c => c.value);
    if (cards.length) { gs.holeCards = cards; hand.holeCards = cards; }
  }
  if (data.tB) {
    gs.tB = parseTB(data.tB);
    const vals = Object.values(gs.tB).filter(v => v > 0);
    gs.callAmount = vals.length ? Math.max(...vals) : 0;
  }
  if (data.mAVTB !== undefined) gs.minBet = data.mAVTB;
}

// ─── Bet tracking ──────────────────────────────────────────────
function recordBetAction(actorId) {
  const prev  = hand.prevTB[actorId] ?? 0;
  const curr  = gs.tB[actorId] ?? 0;
  const delta = curr - prev;
  if (delta <= 0) return;

  const st       = currentStreet();
  const name     = playerName(actorId);
  const prevMax  = Math.max(0, ...Object.values(hand.prevTB).map(Number));
  const action   = curr > prevMax ? (prevMax === 0 ? 'BET' : 'RAISE') : 'CALL';

  hand.playerContributions[actorId] = (hand.playerContributions[actorId] ?? 0) + delta;
  const totalIn = hand.playerContributions[actorId];

  const entry = {
    time: new Date().toISOString().slice(11, 19),
    street: st, playerId: actorId, playerName: name,
    action, amount: delta, totalInPot: totalIn, pot: gs.pot,
  };
  hand.bettingTimeline.push(entry);
  log(`💸  ${name.padEnd(16)} ${action.padEnd(5)} ${delta} on ${st}  (total in: ${totalIn} | pot: ${gs.pot})`);

  // Track hero's actual action when cRPI fires for them
  if (actorId === heroId && hand.pendingDecision) {
    const pd = hand.pendingDecision;
    const stackAfter = heroStack();
    const heroEntry = {
      street: st,
      geminiDecision: pd.geminiDecision,
      actualAction: action,
      amountPlayed: delta,
      stackBefore: pd.stackBefore,
      stackAfter,
      followed: pd.geminiDecision?.startsWith(action),
    };
    hand.heroActions.push(heroEntry);
    hand.pendingDecision = null;
    const tag = heroEntry.followed ? '✅ matched Gemini' : '⚡ overrode Gemini';
    log(`📝  HERO: ${action} ${delta} | Gemini said: ${pd.geminiDecision} | ${tag}`);
  }
}

function onPlayerActed(actorId) {
  recordBetAction(actorId);
  hand.prevTB = { ...gs.tB };
}

// ─── Gemini call ───────────────────────────────────────────────
async function askGemini() {
  if (deciding) return;
  deciding = true;

  const bb      = Number(gs.bigBlind) || 2;
  const stack   = heroStack();
  const st      = currentStreet();
  const opps    = allOpponents();
  const turnKey = `${st}|${gs.holeCards.join(' ')}|${gs.board.join(' ')}|${gs.pot}|${gs.callAmount}`;

  if (turnKey === lastTurnKey) { deciding = false; return; }
  lastTurnKey = turnKey;

  hand.pendingDecision = {
    street: st, stackBefore: stack,
    pot: gs.pot, callAmount: gs.callAmount,
    geminiDecision: null,
  };

  // Detect table bullies — opponents who have raised >100 chips pre-flop this hand
  const bullies = hand.bettingTimeline
    .filter(e => e.street === 'pre-flop' && e.action === 'RAISE' && e.amount > 100)
    .map(e => `${e.playerName} (raised ${e.amount})`);
  const bullyWarning = bullies.length
    ? `⚠️  TABLE AGGRESSOR(S) ACTIVE: ${bullies.join(', ')} — only engage with AA/KK/QQ/AKs`
    : '';

  const stackBBs = Math.round(stack / bb);

  const prompt = `You are a professional poker player making a real-time decision.

GAME STATE:
- Street: ${st}
- My hole cards: ${gs.holeCards.join(' ')}
- Board: ${gs.board.join(' ') || 'none (pre-flop)'}
- Pot: ${gs.pot} | To call: ${gs.callAmount} | My stack: ${stack} (${stackBBs}BB)
- Big blind: ${bb}
${bullyWarning ? `\n${bullyWarning}\n` : ''}
OPPONENTS (name | stack):
${opps.map(o => `    ${o.name.padEnd(18)} stack: ${String(o.stack).padStart(5)}`).join('\n')}

BETTING HISTORY THIS HAND (who bet how much and when):
${bettingTimelineText()}

TOTAL INVESTED PER PLAYER:
  ${contributionsSummary()}

DECISION RULES — apply in order, stop at the first match:

SHORT STACK RULES (override everything else):
- My stack ≤ 15BB: ALLIN or FOLD only. No post-flop speculation.
- My stack ≤ 25BB: fold any hand below top pair on flop. No draws. No bluffs.

FREE ACTION:
- If call amount = 0: always CHECK, never fold.

FACING A LARGE PRE-FLOP RAISE (call amount > 5x big blind):
- Only continue with: AA, KK, QQ, JJ, AKs, AKo
- Everything else: FOLD regardless of pot odds

BET SIZING (critical — if you raise, the amount must make sense):
- RAISE amount must be AT LEAST 2.5× the current call amount
- RAISE amount must not exceed your stack
- If you cannot raise a meaningful amount, CALL or FOLD instead
- Example: if call is 50, RAISE must be at least 125. Never RAISE 8 into a 50-chip bet.

POST-FLOP DISCIPLINE:
- No pair + no draw on board = FOLD to any bet, CHECK if free
- Flush/straight draw needs >33% equity vs pot-sized bet to call
- Top pair or better on dangerous board = RAISE for protection
- Do not bluff multi-way pots (3+ players still in)

Reply ONE line only: FOLD | CALL | CHECK | RAISE <amount> | ALLIN`;

  try {
    log(`\n${'━'.repeat(55)}`);
    log(`🃏  TURN | ${st.toUpperCase()} | Cards: ${gs.holeCards.join(' ')} | Board: ${gs.board.join(' ') || '--'}`);
    log(`💰  Pot: ${gs.pot} | Call: ${gs.callAmount} | Stack: ${stack} (${Math.round(stack / bb)}BB)`);
    log(`👥  Opponents: ${opps.map(o => `${o.name}:${o.stack}`).join(' ')}`);
    log(`📊  Chips in pot per player: ${contributionsSummary()}`);

    logBlock('📨  FULL PROMPT SENT TO GEMINI:', prompt);

    const res = await gemini.generateContent(prompt);
    const fullResponse = res.response.text().trim();
    const decision = fullResponse.split('\n')[0].replace(/\*+/g, '').trim().toUpperCase();

    logBlock('📩  FULL GEMINI RESPONSE:', fullResponse);
    log(`🎯  GEMINI DECISION: ${decision}`);
    log(`    ↳ You decide what to click — your move is tracked via WebSocket`);
    log(`${'━'.repeat(55)}\n`);

    // Record in hand's geminiCalls
    hand.geminiCalls.push({
      timestamp: new Date().toISOString(),
      street: st,
      promptSent: prompt,
      fullResponse,
      decision,
      gameSnapshot: {
        holeCards: gs.holeCards, board: [...gs.board],
        pot: gs.pot, callAmount: gs.callAmount, stack,
        opponents: opps,
      },
    });

    if (hand.pendingDecision) hand.pendingDecision.geminiDecision = decision;

  } catch (e) {
    log(`[Gemini Error] ${e.message}`);
    if (hand.pendingDecision) hand.pendingDecision.geminiDecision = 'ERROR';
  } finally {
    deciding = false;
  }
}

// ─── Hand lifecycle ────────────────────────────────────────────
function onNewHand(data) {
  handCount++;
  hand = {
    id: data.hI || `hand-${handCount}`,
    handNumber: handCount,
    startedAt: new Date().toISOString(),
    holeCards: [], board: [],
    stackBefore: heroStack(), stackAfter: null,
    geminiCalls: [],
    bettingTimeline: [],
    playerContributions: {},
    heroActions: [],
    prevTB: {},
    pendingDecision: null,
  };
  lastTurnKey = '';
  log(`\n${'═'.repeat(55)}`);
  log(`🆕  NEW HAND #${handCount} | ID: ${hand.id} | Stack: ${hand.stackBefore}`);
}

function onHandEnd() {
  hand.stackAfter  = heroStack();
  hand.endedAt     = new Date().toISOString();
  hand.stackChange = hand.stackAfter - (hand.stackBefore ?? hand.stackAfter);
  hand.outcome     = hand.stackChange > 0 ? 'WIN' : hand.stackChange < 0 ? 'LOSS' : 'BREAK_EVEN';

  if (hand.pendingDecision) {
    hand.heroActions.push({
      street: hand.pendingDecision.street,
      geminiDecision: hand.pendingDecision.geminiDecision,
      actualAction: 'UNKNOWN',
      stackBefore: hand.pendingDecision.stackBefore,
      stackAfter: hand.stackAfter,
    });
    hand.pendingDecision = null;
  }

  log(`🏁  HAND #${handCount} ENDED | ${hand.outcome} | Stack: ${hand.stackBefore} → ${hand.stackAfter} (${hand.stackChange >= 0 ? '+' : ''}${hand.stackChange})`);
  log(`    Cards: ${hand.holeCards.join(' ')} | Board: ${hand.board.join(' ') || '--'}`);
  log(`    Gemini calls: ${hand.geminiCalls.length} | Bets tracked: ${hand.bettingTimeline.length} | Hero overrides: ${hand.heroActions.filter(a => !a.followed).length}`);
  log(`${'═'.repeat(55)}\n`);

  // Append this hand to session and persist
  session.hands.push({ ...hand });
  saveSession();

  log(`💾  Session saved → ${SESSION_JSON}  (${session.hands.length} hands total)`);
}

// ─── WebSocket ─────────────────────────────────────────────────
function connect() {
  const ws = new WebSocket(WS_URL, {
    headers: { Cookie: COOKIE, Origin: 'https://www.pokernow.com' },
  });

  ws.on('open', () => log('[WS] Connected → ' + GAME_ID));

  ws.on('message', raw => {
    const msg = raw.toString();
    if (msg === '2') { ws.send('3'); return; }
    if (!msg.startsWith('42')) return;

    try {
      const [ev, data] = JSON.parse(msg.slice(2));

      if (ev === 'registered') {
        heroId = data?.currentPlayer?.id;
        session.heroId = heroId;
        merge(data?.gameState || {});
        hand.stackBefore = heroStack();
        log(`[Hero] ${heroId} | Stack: ${hand.stackBefore} | Cards: ${gs.holeCards.join(' ')}`);
        saveSession();

      } else if (ev === 'gC') {
        merge(data);

        if (data.hI) onNewHand(data);

        if (data.gameResult && !data.hI) onHandEnd();

        if (data.cRPI) {
          const actors = Array.isArray(data.cRPI) ? data.cRPI : [data.cRPI];
          for (const id of actors) if (id) onPlayerActed(id);
        }

        if (data.cPI && data.cPI === heroId) {
          log(`[TURN] cPI=${heroId} — calling Gemini`);
          askGemini();
        }
      }
    } catch {}
  });

  ws.on('close', () => {
    log('[WS] Disconnected — reconnecting in 2s');
    setTimeout(connect, 2000);
  });
  ws.on('error', e => log(`[WS Error] ${e.message}`));
}

// ─── Boot ──────────────────────────────────────────────────────
writeFileSync(LIVE_LOG, [
  `${'═'.repeat(55)}`,
  `  GEMINI LIVE — Session started ${new Date().toISOString()}`,
  `  Game: ${GAME_ID}`,
  `  Capturing: full prompts · full responses · betting timeline · hero actions`,
  `  Analysis: run later from ${SESSION_JSON}`,
  `${'═'.repeat(55)}`,
  '',
].join('\n'));

writeFileSync(SESSION_JSON, JSON.stringify(session, null, 2));

log('🚀 Bot running — Gemini decides, everything logged, analysis later');
log(`📋 Live log  → ${LIVE_LOG}`);
log(`📦 JSON data → ${SESSION_JSON}`);
connect();
