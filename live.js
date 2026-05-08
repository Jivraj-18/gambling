// live.js — direct PokerNow WS, no browser needed
import WebSocket from 'ws';
import { writeFileSync } from 'fs';

const GAME_ID = 'pglbdDerk0qz2s-SbNubC6yX-';
const COOKIE  = 'npt=kZ6_r29vdNkCcnx_8YXXnLc7U6ONR1TCApOntNFv-oILwE0lRH; apt=ipgnpasbtylm0dqcckwpvn7pjakinr8oh59ym402m5aln; _ga=GA1.2.573723277.1778155911; _gid=GA1.2.1031275976.1778155911';
const URL     = `wss://www.pokernow.com/socket.io/?gameID=${GAME_ID}&firstConnection=true&layout=d&EIO=3&transport=websocket`;

let gs     = { board:[], pot:0, holeCards:[], bigBlind:2, players:{}, seats:[] };
let heroId = null;
let lastTurn = '';

function merge(data) {
  if (data.pot      !== undefined) gs.pot      = data.pot;
  if (data.bigBlind !== undefined) gs.bigBlind = data.bigBlind;
  if (data.seats)  gs.seats   = data.seats;
  if (data.players) for (const [id,p] of Object.entries(data.players))
    gs.players[id] = { ...gs.players[id], ...p };
  if (data.oTC?.['1'] !== undefined) gs.board = data.oTC['1'];
  if (heroId && data.pC?.[heroId]) {
    const cards = (data.pC[heroId].cards||[]).filter(c=>c.value).map(c=>c.value);
    if (cards.length) gs.holeCards = cards;
  }
}

function checkTurn(data) {
  if (!heroId) return;
  const hero = Object.values(gs.players).find(p => p.isHero);
  if (!hero) return;
  // Detect our turn: player has toAct flag or playerToAct matches heroId
  const isMyTurn = data.playerToAct === heroId
    || (data.players?.[heroId]?.toAct)
    || gs.players[heroId]?.toAct;
  if (!isMyTurn) return;

  const bb     = Number(gs.bigBlind)||2;
  const stack  = Number(hero.stack??0);
  const street = !gs.board.length?'pre-flop':gs.board.length===3?'flop':gs.board.length===4?'turn':'river';
  const opp    = gs.seats.map(([,id])=>gs.players[id]).filter(p=>p&&!p.isHero).map(p=>`${p.name||id}:${p.stack}`).join(' ');
  const line   = `TURN|${street}|${gs.holeCards.join(' ')}|board:${gs.board.join(' ')||'--'}|pot:${gs.pot}|stack:${stack}(${Math.round(stack/bb)}BB)|opp:${opp}`;
  if (line === lastTurn) return;
  lastTurn = line;
  writeFileSync('/tmp/poker-turn', line);
  console.log(`[TURN] ${line}`);
}

function connect() {
  const ws = new WebSocket(URL, { headers: { Cookie: COOKIE, Origin: 'https://www.pokernow.com' } });
  ws.on('open', () => console.log('[WS] Connected'));
  ws.on('message', raw => {
    const msg = raw.toString();
    if (msg === '2') { ws.send('3'); return; }   // heartbeat
    if (!msg.startsWith('42')) return;
    try {
      const [ev, data] = JSON.parse(msg.slice(2));
      if (ev === 'registered') {
        heroId = data?.currentPlayer?.id;
        merge(data?.gameState||{});
        console.log('[Hero]', heroId);
        console.log('[State] board:', gs.board, 'cards:', gs.holeCards);
      } else if (ev === 'gC') {
        merge(data);
        checkTurn(data);
        // Log player state to find toAct field
        const hp = data.players?.[heroId];
        if (hp) console.log('[Hero player]', JSON.stringify(hp));
      }
    } catch {}
  });
  ws.on('close', ()=>{ console.log('[WS] Disconnected — reconnecting in 2s'); setTimeout(connect, 2000); });
  ws.on('error', e=>console.log('[WS] Error:', e.message));
}

connect();
