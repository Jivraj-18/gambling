# Poker AI Bot

A Playwright-based bot that plays on [PokerNow.club](https://www.pokernow.club), optionally assisted by the Gemini AI. Every move is logged as a structured JSON snapshot and can be replayed in a browser UI.

## Setup

```bash
npm install
npx playwright install chromium
```

Set your Google API key in `~/.bashrc`:
```bash
export GOOGLE_API_KEY=your_key_here
```

## Running the Bot

```bash
# Capture only — records all WebSocket events, no AI
node bot.js

# AI advisory — Gemini suggests moves, you click manually
node bot.js --ai

# AI auto-click — Gemini decides and clicks for you
node bot.js --ai --mode=auto

# Auto-click with local heuristic agent (no API key)
node bot.js --ai --mode=auto --agent=heuristic

# Open a specific game room directly
node bot.js --ai --url=https://www.pokernow.club/games/YOUR_ROOM_ID

# Use a different Gemini model
node bot.js --ai --model=gemini-2.5-pro
```

### Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--ai` | off | Enable Gemini AI advisor |
| `--agent` | `gemini` (when `--ai` is set) | `gemini` or `heuristic` |
| `--mode` | `advisory` | `advisory` (suggest only) or `auto` (click for you) |
| `--model` | `gemini-3.1-pro-preview` | Gemini model to use |
| `--url` | `https://www.pokernow.club` | URL to open on launch |

## Flow

1. Run `node bot.js --ai` — a browser window opens
2. Log in to PokerNow and join a game in that browser
3. When a WebSocket connection is detected, you'll see `[WS] Connected on: ...`
4. When it's your turn with hole cards dealt, Gemini is called automatically
5. In `advisory` mode: suggested action is printed to console, you click manually
6. In `auto` mode: bot clicks the action after a random 2–5s humanisation delay

## Output Files

```
data/
  manifest.json          — index of all runs
  run_<timestamp>.json   — full move log for each session

logs/
  raw_<timestamp>.jsonl  — every raw WebSocket event (for debugging)
```

### Run JSON structure

Each entry in a run file:
```json
{
  "timestamp": "2026-04-30T...",
  "game_state": {
    "players": {},
    "board": [],
    "pot": 50,
    "holeCards": ["2♦", "8♥"],
    "heroStack": 19,
    "recentActions": []
  },
  "ai_metadata": {
    "prompt": "...",
    "raw": "...",
    "decision": "CALL",
    "amount": 2,
    "reasoning": "..."
  },
  "actual_action": "CALL",
  "mode": "advisory"
}
```

For capture-only (no `--ai`) runs, entries look like:
```json
{
  "timestamp": "...",
  "event": "action",
  "action_data": { "type": "call", ... },
  "game_state": { ... }
}
```

## Replay UI

Serve the project folder with any static server:

```bash
npx serve .
# or
python3 -m http.server
```

Open `http://localhost:3000` (or `http://localhost:8000`).

- **Run selector** — dropdown shows all sessions with timestamp, AI/Manual badge, and move count
- **Game panel** — board cards, pot, player positions and stacks
- **AI panel** — shown only for AI runs; displays decision badge, reasoning, and expandable prompt/raw response
- **Domain expert log** — `domain-expert-log.md` captures each decision with Q&A and context
- **Controls** — Prev / Play-Pause / Next / End + speed slider (0.25× – 4×)
