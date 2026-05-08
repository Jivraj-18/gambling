# Agent Gamble

A real-time poker AI that connects directly to [PokerNow.com](https://www.pokernow.com) via WebSocket. Gemini 2.5 Flash makes decisions instantly — no browser, no Playwright, no screenshots.

## How it works

1. The bot connects to the game WebSocket using your session cookie
2. It watches for the `cPI` field in game events — this signals whose turn it is
3. When it's your turn, the bot calls Gemini with the full game state:
   - Your hole cards and the board
   - Pot size, call amount, your stack in BB
   - Every bet made by every player — who, how much, which street
   - Total chips each player has invested this hand
4. Gemini responds with `FOLD / CALL / CHECK / RAISE <amount> / ALLIN`
5. You click. Everything is logged.

## Setup

```bash
npm install
export GOOGLE_API_KEY=your_key_here
```

## Running

```bash
npm start
```

Or directly:
```bash
node gemini-live.js
```

Before running, update the two constants at the top of `gemini-live.js`:
```js
const GAME_ID = 'pgl...';   // from the WebSocket URL in browser DevTools
const COOKIE  = 'npt=...';  // from the request headers
```

## Using a coding agent

See `prmompts.md` — two ready-to-paste prompts:

- **Prompt 1** — give any coding agent (Claude, Gemini CLI, Cursor) your WebSocket URL and it sets up and runs the bot automatically
- **Prompt 2** — after the session, give any agent the log files and it produces a full domain expert report with hand-by-hand analysis

## Output files

| File | What it contains |
|------|-----------------|
| `/tmp/gemini-live.log` | Live log — every event, full Gemini prompts and responses, bet tracking |
| `/tmp/session-data.json` | Structured JSON — every hand with cards, board, betting timeline, Gemini decisions, hero actions |

### Session JSON structure (per hand)

```json
{
  "handNumber": 3,
  "holeCards": ["Ks", "Jd"],
  "board": ["6d", "3s", "8d", "7c", "2s"],
  "stackBefore": 150,
  "stackAfter": 106,
  "stackChange": -44,
  "outcome": "LOSS",
  "bettingTimeline": [
    { "time": "05:36:05", "street": "pre-flop", "playerName": "strange",
      "action": "RAISE", "amount": 50, "totalInPot": 50, "pot": 12 }
  ],
  "geminiCalls": [
    { "street": "flop", "promptSent": "...", "fullResponse": "...", "decision": "CHECK" }
  ],
  "heroActions": [
    { "street": "flop", "geminiDecision": "CHECK", "actualAction": "CALL", "followed": false }
  ]
}
```

## Gemini decision rules (built into the prompt)

- **≤15BB stack**: ALLIN or FOLD only — no post-flop speculation
- **≤25BB stack**: fold anything below top pair — no draws, no bluffs
- **Facing large pre-flop raise (>5× BB)**: only continue with AA, KK, QQ, JJ, AKs, AKo
- **Bet sizing**: RAISE must be ≥2.5× the current call amount — no undersized raises
- **No pair + no draw on board**: fold to any bet, check if free
- **Table bully detection**: auto-flags players who raised >100 chips pre-flop — only engage with premium hands

## Files

```
agent-gamble/
├── gemini-live.js           ← the bot
├── prmompts.md              ← two-prompt system for coding agents
├── domain-expert-prakhar.md ← 7 domain expert questions answered per session
├── domain-expert-report.md  ← latest session analysis
├── gameplays/               ← hand-by-hand records from past sessions
└── data/manifest.json       ← session metadata index
```
