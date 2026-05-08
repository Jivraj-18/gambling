// gemini-player.js — watches /tmp/poker-turn, asks Gemini, prints decision
import { GoogleGenerativeAI } from '@google/generative-ai';
import { watch, readFileSync, existsSync } from 'fs';

const gemini = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
  .getGenerativeModel({ model: 'gemini-2.0-flash' });

const SYSTEM = `You are an expert poker player. You will be given the current game state and must decide the best action.
Rules:
- Respond with ONLY one line: the action and optional amount
- Format: FOLD | CALL | CHECK | RAISE <amount> | ALLIN
- Be decisive and fast. Think like a professional.
- Consider pot odds, position, stack depth, and hand strength.
- At <=10BB shove or fold only. Never limp at short stack.
- Suited connectors and pairs = see flops cheaply when deep stacked.
- Top pair or better on dangerous boards = bet/raise for protection.`;

let lastTurn = '';
let deciding = false;

async function decide(line) {
  if (deciding || line === lastTurn) return;
  deciding = true;
  lastTurn = line;

  const parts = line.split('|');
  const street   = parts[1] || '';
  const cards    = parts[2] || '';
  const board    = parts[3]?.replace('board:','') || '--';
  const pot      = parts[4]?.replace('pot:','') || '0';
  const call     = parts[5]?.replace('call:','') || '0';
  const stack    = parts[6]?.replace('stack:','') || '0';
  const players  = parts[7]?.replace('players:','') || '?';
  const actions  = parts[8]?.replace('actions:','') || '';
  const opp      = parts[9]?.replace('opp:','') || '';

  const prompt = `${SYSTEM}

GAME STATE:
- Street: ${street}
- My cards: ${cards}
- Board: ${board}
- Pot: ${pot} | Call: ${call} | Stack: ${stack}
- Players active: ${players}
- Available actions: ${actions}
- Opponents (name:stack): ${opp}

What is your action? Reply with one line only.`;

  try {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[State] ${street} | Cards: ${cards} | Board: ${board}`);
    console.log(`[Info]  Pot:${pot} Call:${call} Stack:${stack} Players:${players}`);
    console.log(`[Gemini] Thinking...`);

    const res = await gemini.generateContent(prompt);
    const decision = res.response.text().trim().split('\n')[0].toUpperCase();

    console.log(`\n🎯 GEMINI SAYS: ${decision}\n`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  } catch (e) {
    console.log(`[Error] Gemini failed: ${e.message}`);
  } finally {
    deciding = false;
  }
}

console.log('[Gemini Player] Watching /tmp/poker-turn for turns...');

// Check immediately if turn exists
if (existsSync('/tmp/poker-turn')) {
  const line = readFileSync('/tmp/poker-turn', 'utf8').trim();
  if (line.startsWith('TURN|')) decide(line);
}

// Watch for new turns
watch('/tmp', (_, name) => {
  if (name !== 'poker-turn') return;
  try {
    const line = readFileSync('/tmp/poker-turn', 'utf8').trim();
    if (line.startsWith('TURN|')) decide(line);
  } catch {}
});
