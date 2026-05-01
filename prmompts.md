Build a local Node.js application using Playwright that automates play on PokerNow.club. The system must intercept WebSocket data for state tracking, use the Gemini API for strategic decisions, and log every move as a full state snapshot into a local game_log.json for a GitHub Pages replay UI.

1. Game Context & Technical Stack:

    Game Type: Pot Limit Omaha Hi (PLO HI) — Crucial: The agent has 4 hole cards.

    Intelligence: Gemini API (via @google/generative-ai SDK).

    Automation: Playwright (Headed mode for initial testing).

    Data Source: socket.io WebSocket interception.

2. WebSocket Interception (The "Eyes"):
Monitor wss://[www.pokernow.com/socket.io/](https://www.pokernow.com/socket.io/).

    Event registered: Capture the networkUsername and unique ID to identify the "Hero" seat.

    Event gc (Game Context): This is the primary state provider. Maintain a master gameState object by merging these updates.

    Event action: Use this to track the betting flow and opponent moves.

    Parsing: Socket.io frames start with prefixes like 42. Write a parser to strip these and handle the underlying JSON.

3. DOM Selectors & Automation (The "Hand"):
Use these verified selectors from the site's source code for execution:

    Turn Detection: div.table-player.you-player.decision-current. Only trigger the AI loop if this element is present.

    Action Buttons:

        Fold: button.action-button.fold

        Check: button.action-button.check

        Call/Bet: button.action-button.call (Handle dynamic text like "Call 10" or "Bet 2").

        Raise/Open: button.action-button.raise

    Betting Logic: If the decision is RAISE, click the raise button, locate the numeric input field, clear it, type the suggested_amount, and press Enter.

    Humanization: Apply a randomized delay of 2–5 seconds before performing any DOM action.

4. Intelligence Integration (Gemini):
When it is Hero's turn, send a prompt to Gemini 1.5:

    System Prompt: "You are a Pro PLO HI Analyst. You are playing Pot Limit Omaha (4 hole cards). Provide GTO-based advice."

    Input State: Current hole cards, board texture, pot size, stack sizes, and the last 5 logs for context.

    Required Output: Strict JSON: {"decision": "FOLD|CHECK|CALL|RAISE", "amount": number, "reasoning": "string"}.

5. Rich Logging for Replay UI:
Every time a move is made (automated or manual), append a State-Complete Snapshot to game_log.json:

    Include the full gameState (all players, stacks, cards, pot).

    Include ai_metadata: The exact prompt sent, the raw reasoning from Gemini, and the suggested move.

    Include actual_action: What the script successfully clicked in the DOM.

6. Implementation Details:

    Use an atomic write or a stream for game_log.json to prevent data loss.

    Maintain a "Turn Lock" to ensure Gemini is only called once per turn.

    Provide a clean console output showing: [Turn Detected] -> [Gemini Reasoning] -> [Action Executed].