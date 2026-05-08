// play.js — pure browser puppet, ~80 lines
// Detects turns, writes one line, clicks whatever I say
// All intelligence lives in Claude (this conversation)

import { chromium } from 'playwright';
import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync, watch } from 'fs';

mkdirSync('logs/snapshots', { recursive: true });
mkdirSync('data', { recursive: true });

const GAME_FILE = 'data/active-game.json';
let gs      = { board: [], pot: 0, holeCards: [], bigBlind: 2, callAmount: 0, players: {}, seats: [], tableBets: {} };
let heroId  = null;
let locked  = false;
let lastAct = 0;

// ── WS state ─────────────────────────────────────────────────────────────────
function merge(data) {
  if (data.pot !== undefined)      gs.pot = data.pot;
  if (data.bigBlind !== undefined) gs.bigBlind = data.bigBlind;
  if (data.seats)                  gs.seats = data.seats;
  if (data.tB)                     gs.tableBets = { ...gs.tableBets, ...data.tB };
  if (data.players) for (const [id, p] of Object.entries(data.players))
    gs.players[id] = { ...gs.players[id], ...p };
  if (data.oTC?.['1'] !== undefined) gs.board = data.oTC['1'];
  if (data.pC?.[heroId]) {
    const cards = (data.pC[heroId].cards || []).filter(c => c.value).map(c => c.value);
    if (cards.length) gs.holeCards = cards;
  }
}

// ── Available actions ─────────────────────────────────────────────────────────
async function getActions(page) {
  const out = [];
  for (const n of ['check','call','raise','fold']) {
    const el = page.locator(`button.action-button.${n}:not([disabled])`);
    if (await el.count()) out.push({ n, label: (await el.first().textContent()).trim() });
  }
  if (!out.find(a => a.n === 'call')) {
    const el = page.locator('button.action-button:has-text("All In"):not([disabled])').first();
    if (await el.count()) out.push({ n: 'call', label: (await el.textContent()).trim() });
  }
  return out;
}

// ── Click whatever I say ──────────────────────────────────────────────────────
async function act(page, cmd) {
  const [action, ...rest] = cmd.toLowerCase().split(/\s+/);
  const amount = parseInt(rest[0] || '0');
  const hero   = gs.seats.map(([,id]) => gs.players[id]).find(p => p && p.isHero) || {};
  const stack  = Number(hero?.stack ?? 0);

  try {
    if (action === 'fold')  await page.locator('button.action-button.fold:not([disabled])').first().click({ timeout: 3000 });
    else if (action === 'check') await page.locator('button.action-button.check:not([disabled])').first().click({ timeout: 3000 });
    else if (action === 'call')  await page.locator('button.action-button.call:not([disabled]), button.action-button:has-text("All In"):not([disabled])').first().click({ timeout: 3000 });
    else if (action === 'raise' || action === 'allin') {
      await page.locator('button.action-button.raise:not([disabled])').first().click({ timeout: 3000 });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `logs/snapshots/raise_${Date.now()}.png` }).catch(() => {});
      const isShove = !amount || amount >= stack * 0.9;
      if (isShove) {
        const allIn = page.locator('button:has-text("ALL IN"), button:has-text("All In")').first();
        if (await allIn.count()) { await allIn.click({ timeout: 2000 }); }
        else {
          const s = page.locator('input[type="range"]').first();
          if (await s.count()) { const b = await s.boundingBox(); if (b) await page.mouse.click(b.x + b.width - 2, b.y + b.height/2); }
        }
      } else {
        const inp = page.locator('input.raise-input, input[type="number"]').first();
        if (await inp.count()) { await inp.click({ clickCount: 3 }); await inp.fill(String(amount)); }
      }
      await page.keyboard.press('Enter').catch(() => {});
      await page.waitForTimeout(300);
      const confirm = page.locator('button.bet-button, button.raise-button-confirm, button:has-text("Raise to"), button:has-text("Bet")').first();
      if (await confirm.count()) await confirm.click({ timeout: 2000 }).catch(() => {});
    }
    console.log(`[Action] ${cmd}`);
    await page.screenshot({ path: `logs/snapshots/after_${Date.now()}.png` }).catch(() => {});
    return true;
  } catch (e) {
    console.log(`[Action] FAIL ${cmd}: ${e.message.slice(0,60)}`);
    await page.screenshot({ path: `logs/snapshots/fail_${Date.now()}.png` }).catch(() => {});
    return false;
  }
}

// ── Handle turn ───────────────────────────────────────────────────────────────
async function turn(page) {
  if (locked || Date.now() - lastAct < 3000) return;
  locked = true;
  try {
    // Dismiss overlays (only when not in raise UI)
    const actionVis = await page.$('button.action-button:not([disabled])').catch(() => null);
    if (!actionVis) {
      for (const s of ["button:has-text('I\\'M BACK')","button:has-text('RETURN ON BIG BLIND')","button:has-text('Return to Big Blind')","#accept-tos-button"]) {
        const el = page.locator(s).first(); if (await el.count()) await el.click().catch(() => {});
      }
    }

    let available = await getActions(page);
    if (!available.length) { await page.waitForTimeout(600); available = await getActions(page); }
    if (!available.length) { console.log('[Turn] No buttons'); return; }

    const callBtn  = available.find(a => a.n === 'call');
    gs.callAmount  = callBtn ? parseInt(callBtn.label.match(/\d+/)?.[0] || '0') : 0;
    const street   = !gs.board.length ? 'pre-flop' : gs.board.length===3 ? 'flop' : gs.board.length===4 ? 'turn' : 'river';
    const bb       = Number(gs.bigBlind) || 2;
    const players  = gs.seats.map(([,id]) => ({ name: gs.players[id]?.name||id.slice(0,8), stack: gs.players[id]?.stack, isHero: id===heroId }));
    const hero     = players.find(p => p.isHero);
    const stack    = Number(hero?.stack ?? 0);
    const stackBB  = Math.round(stack / bb);
    const opp      = players.filter(p => !p.isHero).map(p => `${p.name}:${p.stack}`).join(' ');
    const active   = players.filter(p => p.stack > 0).length;

    await page.screenshot({ path: `logs/snapshots/turn_${Date.now()}.png` }).catch(() => {});

    const line = `TURN|${street}|${gs.holeCards.join(' ')}|board:${gs.board.join(' ')||'--'}|pot:${gs.pot}|call:${gs.callAmount}|stack:${stack}(${stackBB}BB)|players:${active}|actions:${available.map(a=>a.label).join('/')}|opp:${opp}`;
    writeFileSync('/tmp/poker-turn', line);
    try { unlinkSync('/tmp/poker-cmd'); } catch {}
    console.log(`[Turn] ${line}`);

    const cmd = await new Promise(resolve => {
      const fallback = available.find(a => a.n==='check') ? 'check' : 'fold';
      const t = setTimeout(() => { w.close(); console.log(`[CMD] Timeout→${fallback}`); resolve(fallback); }, 35000);
      if (existsSync('/tmp/poker-cmd')) { clearTimeout(t); return resolve(readFileSync('/tmp/poker-cmd','utf8').trim().toLowerCase()); }
      const w = watch('/tmp', (_, name) => {
        if (name === 'poker-cmd' && existsSync('/tmp/poker-cmd')) { clearTimeout(t); w.close(); resolve(readFileSync('/tmp/poker-cmd','utf8').trim().toLowerCase()); }
      });
    });

    lastAct = Date.now();
    await act(page, cmd.split('\n')[0], stack); // only first line = action
  } finally { locked = false; }
}

// ── Main ──────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: false });
const page    = await browser.newPage();

page.on('websocket', ws => {
  if (!ws.url().includes('pokernow')) return;
  console.log('[WS] ' + ws.url().split('?')[0]);
  ws.on('framereceived', ({ payload }) => {
    if (typeof payload !== 'string' || !['42','43','45'].includes(payload.slice(0,2))) return;
    try {
      const [ev, data] = JSON.parse(payload.slice(2));
      if (ev === 'registered') { heroId = data?.currentPlayer?.id; merge(data?.gameState||{}); console.log('[Hero]', heroId); }
      else if (ev === 'gC') merge(data);
    } catch {}
  });
});

page.on('framenavigated', f => {
  if (f === page.mainFrame() && f.url().includes('/games/'))
    writeFileSync(GAME_FILE, JSON.stringify({ url: f.url(), ts: new Date().toISOString() }));
});

const savedUrl = existsSync(GAME_FILE) ? JSON.parse(readFileSync(GAME_FILE)).url : null;
await page.goto(savedUrl || 'https://www.pokernow.com');
console.log('[Bot] Loaded:', savedUrl || 'pokernow home');

// Poll for turn every 500ms
let lastSeen = false;
while (true) {
  await page.waitForTimeout(500);
  try {
    const myTurn = await page.$('div.table-player.you-player.decision-current');
    if (myTurn && !lastSeen) { lastSeen = true; turn(page); }
    else if (!myTurn) lastSeen = false;
  } catch {}
}
