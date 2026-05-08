// ws-spy.js — tap into WS, log ALL raw data to find turn detection fields
import WebSocket from 'ws';
import { writeFileSync, appendFileSync } from 'fs';

const GAME_ID = 'pglYSBbcroTrz1BexlA9W2_DC';
const COOKIE  = 'npt=kZ6_r29vdNkCcnx_8YXXnLc7U6ONR1TCApOntNFv-oILwE0lRH; apt=ipgnpasbtylm0dqcckwpvn7pjakinr8oh59ym402m5aln; _ga=GA1.2.573723277.1778155911; _gid=GA1.2.1031275976.1778155911';
const URL     = `wss://www.pokernow.com/socket.io/?gameID=${GAME_ID}&firstConnection=true&layout=d&EIO=3&transport=websocket`;

let heroId = null;
let gs = { board:[], pot:0, holeCards:[], bigBlind:2, players:{}, seats:[] };
const LOG = '/tmp/ws-raw.log';

writeFileSync(LOG, `=== WS Spy started ${new Date().toISOString()} ===\n`);

function log(msg) {
  const line = `${new Date().toISOString().slice(11,23)} ${msg}`;
  console.log(line);
  appendFileSync(LOG, line + '\n');
}

function merge(data) {
  if (data.pot !== undefined) gs.pot = data.pot;
  if (data.bigBlind !== undefined) gs.bigBlind = data.bigBlind;
  if (data.seats) gs.seats = data.seats;
  if (data.players) for (const [id,p] of Object.entries(data.players))
    gs.players[id] = { ...gs.players[id], ...p };
  if (data.oTC?.['1'] !== undefined) gs.board = data.oTC['1'];
  if (heroId && data.pC?.[heroId]) {
    const cards = (data.pC[heroId].cards||[]).filter(c=>c.value).map(c=>c.value);
    if (cards.length) gs.holeCards = cards;
  }
}

function connect() {
  const ws = new WebSocket(URL, { headers: { Cookie: COOKIE, Origin: 'https://www.pokernow.com' } });

  ws.on('open', () => log('[WS] Connected'));

  ws.on('message', raw => {
    const msg = raw.toString();
    if (msg === '2') { ws.send('3'); return; }
    if (!msg.startsWith('42')) return;

    try {
      const parsed = JSON.parse(msg.slice(2));
      const ev = parsed[0];
      const data = parsed[1];

      if (ev === 'registered') {
        heroId = data?.currentPlayer?.id;
        merge(data?.gameState || {});
        log(`[Hero] ${heroId}`);
        log(`[Cards] ${gs.holeCards.join(' ')} Board: ${gs.board.join(' ')||'--'}`);
        return;
      }

      if (ev !== 'gC') return;
      merge(data);

      // Log ALL top-level fields in every gC event
      const keys = Object.keys(data);

      // Check hero player state for toAct indicators
      const hp = gs.players[heroId];
      const hpRaw = data.players?.[heroId];

      // Log any field that might indicate turn
      const turnFields = {
        cPI: data.cPI,          // current player index/ID — KEY CANDIDATE
        cRPI: data.cRPI,        // current required player index
        pITT: data.pITT,        // player in the timer
        sNAA: data.sNAA,        // seat next action available
        pASA: data.pASA,        // player action sent/available
        mAVTB: data.mAVTB,      // min/max valid to bet
        playerToAct: data.playerToAct,
        tA: data.tA,
        heroStatus: hp?.status,
        heroRaw_toAct: hpRaw?.toAct,
        heroRaw_status: hpRaw?.status,
      };

      // Only log if there's something interesting (non-null/undefined values)
      const interesting = Object.entries(turnFields).filter(([k,v]) => v !== undefined && v !== null);
      if (interesting.length > 0) {
        log(`[gC] keys:${keys.join(',')} | turn-fields: ${interesting.map(([k,v])=>`${k}=${JSON.stringify(v)}`).join(' | ')}`);
      } else {
        log(`[gC] keys:${keys.join(',')} | cards:${gs.holeCards.join(' ')} board:${gs.board.join(' ')||'--'} pot:${gs.pot}`);
      }

      // Log full hero player data when it changes
      if (hpRaw && Object.keys(hpRaw).length > 0) {
        log(`[HeroPlayer] ${JSON.stringify(hpRaw)}`);
      }

    } catch(e) {
      log(`[ParseErr] ${e.message}`);
    }
  });

  ws.on('close', () => { log('[WS] Disconnected — reconnecting in 2s'); setTimeout(connect, 2000); });
  ws.on('error', e => log(`[WS Error] ${e.message}`));
}

connect();
log('Spying... play normally for 5-10 mins. Analysis after.');
