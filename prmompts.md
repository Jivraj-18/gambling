# Agent Gamble — Prompts

Two separate prompts. Use them in order.

---

# PROMPT 1 — Play the Game

> Give this prompt to any coding agent (Claude, Gemini CLI, Cursor, etc.) along with the WebSocket URL of the active game.

---

You are a coding agent. Your only job right now is to get `gemini-live.js` running against the active game. Do not do any analysis. Just play and capture everything.

**Steps:**

1. The user will give you a WebSocket URL or curl command. Extract two things from it:
   - `gameID` — from the URL parameter `?gameID=pgl...`
   - `Cookie` — from the request headers

2. Open `gemini-live.js` in this directory. Update only these two lines at the top:
   ```js
   const GAME_ID = '<extracted gameID>';
   const COOKIE  = '<extracted cookie string>';
   ```

3. Check the Google API key is set:
   ```
   echo $GOOGLE_API_KEY
   ```
   If it is empty, ask the user for it and set it: `export GOOGLE_API_KEY=<key>`

4. Kill any existing instance and start fresh:
   ```
   pkill -f gemini-live.js 2>/dev/null
   nohup node gemini-live.js > /tmp/gemini-live.log 2>&1 &
   ```

5. Confirm it connected — check `/tmp/gemini-live.log` for:
   - `[WS] Connected` — WebSocket is live
   - `[Hero] <id> | Stack: <n> | Cards: <cards>` — hero identified

6. If you see a Gemini model error (404), run this to find the right model:
   ```
   curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=$GOOGLE_API_KEY" | python3 -c "
   import json,sys
   for m in json.load(sys.stdin).get('models',[]):
       if 'generateContent' in m.get('supportedGenerationMethods',[]):
           print(m['name'],'|',m['displayName'])
   "
   ```
   Pick the latest flash model, update the `model:` line in `gemini-live.js`, restart.

7. Monitor `/tmp/gemini-live.log` while the human plays. The bot handles everything:
   - Detects hero's turn via WebSocket (`cPI` field)
   - Sends full game state + betting history to Gemini
   - Prints `🎯 GEMINI SAYS: FOLD/CALL/CHECK/RAISE X` — human clicks this
   - Tracks every bet by every player (who, when, how much, which street)
   - Saves structured data to `/tmp/session-data.json` after each hand

8. If the game ID changes (human moves to a new table), they will paste a new URL. Repeat from Step 2.

**Do not do any analysis. Just keep the bot running and the logs clean.**

---

**What gets captured automatically in `/tmp/session-data.json`:**
```
{
  "gameId": "...",
  "heroId": "...",
  "hands": [
    {
      "handNumber": 1,
      "holeCards": ["Ac", "Kd"],
      "board": ["Jh", "5c", "2d", "Qs", "7h"],
      "stackBefore": 500, "stackAfter": 480, "stackChange": -20, "outcome": "LOSS",
      "bettingTimeline": [
        { "time": "HH:MM:SS", "street": "pre-flop", "playerName": "Alex",
          "action": "RAISE", "amount": 20, "totalInPot": 20, "pot": 25 }
      ],
      "playerContributions": { "playerId": totalChips },
      "geminiCalls": [
        { "street": "pre-flop", "promptSent": "<full prompt>",
          "fullResponse": "<full Gemini response>", "decision": "CALL",
          "gameSnapshot": { "holeCards", "board", "pot", "callAmount", "stack", "opponents" } }
      ],
      "heroActions": [
        { "street": "pre-flop", "geminiDecision": "CALL",
          "actualAction": "RAISE", "amountPlayed": 40,
          "stackBefore": 500, "stackAfter": 460, "followed": false }
      ]
    }
  ]
}
```

---

# PROMPT 2 — Analyse the Session

> Give this prompt to any coding agent after the game session is over.

---

You are a coding agent. The poker session has finished. `gemini-live.js` has been stopped. Your job is to read the captured data and produce a domain expert report.

**Steps:**

1. Read the session data:
   ```
   /tmp/session-data.json   ← structured hand-by-hand data
   /tmp/gemini-live.log     ← full narrative log with all prompts and responses
   ```

2. For each hand (show latest hand first), produce a section with:

   **Hand summary table:**
   | Field | Value |
   |-------|-------|
   | Cards | hero's hole cards |
   | Board | final board |
   | Result | WIN / LOSS / BREAK EVEN and chip amount |
   | Stack | before → after |

   **Betting timeline table** — who bet how much on which street, total invested per player.

   **Gemini decisions** — full prompt sent, full response received, final decision extracted.

   **Hero vs Gemini** — where hero followed Gemini, where they overrode, what actually happened.

   **7 Domain Expert Questions** (answer each in 2–3 sentences):
   1. Who was likely bluffing — based on bet sizing and timing?
   2. How confident was the winning hand? Was the hero's hand strong enough?
   3. How much should the hero have been willing to raise?
   4. After hitting the raise limit — bluff or fold?
   5. Dominant feeling: Fear / Hope / Greed / None?
   6. How significant was the stack impact?
   7. Overall: Good / Ok / Bad play?

   **Turning point** — exact moment the hand went right or wrong.
   **Lesson** — one thing to do differently next time in the same spot.

3. After all hands, add a **Session Summary**:
   - Total hands, net stack change, win/loss record
   - Biggest single mistake across all hands
   - Pattern: what type of spots are losing the most chips?
   - Where Gemini was consistently right or wrong
   - Where overriding Gemini helped vs hurt
   - Top 3 recommendations for next session

4. Save the report to:
   ```
   /tmp/domain-expert-report.md
   ```

**The domain expert receiving this report has not seen the game. Write as if explaining everything from scratch.**

---

**Key files reference:**
| File | What it contains |
|------|-----------------|
| `gemini-live.js` | The bot (Prompt 1 runs this) |
| `/tmp/gemini-live.log` | Full live log — every event, prompt, response |
| `/tmp/session-data.json` | Structured JSON — every hand with full data |
| `/tmp/domain-expert-report.md` | Output of Prompt 2 |
| `domain-expert-prakhar.md` | The 7 domain expert questions (source) |
