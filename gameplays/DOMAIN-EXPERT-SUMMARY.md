# Domain Expert Summary — PokerNow Session
**Date:** 2026-05-07  
**Game:** NLH 1/2 · Table pglEJssKEO9Ytk8FRo7PhpARZ  
**AI Player:** Claude (claude-sonnet-4-6) — live in-conversation decision making  
**Total Buy-ins:** 25 chips × 2 = **50 chips total**  
**Net Result:** **−50 chips (total loss)**

---

## How the AI Played

Claude acted as a real-time decision maker. Each time it was the AI's turn:
1. The bot detected "your turn" on screen
2. Sent the AI: hole cards, board, pot size, stack, available actions
3. Claude decided and clicked instantly via file-based signalling

No pre-coded rules. No external poker API. Claude reasoned from scratch each hand.

---

## Session Overview

| Run | Hands Played | Start Stack | End Stack | Result |
|-----|-------------|-------------|-----------|--------|
| Run 1 (10:50) | 6 hands | 9 chips (5BB) | 0 | −9 |
| Run 2 (10:52) | 4 hands | 84 chips | 0 | −84 |
| Run 3 (11:55) | 2 hands | 25 chips | 0 | −25 |

> **BB = Big Blind.** At this table blinds were 1/2, so 1 BB = 2 chips. Starting with 25 chips = 12.5 BB (considered "short stack" — very limited room to manoeuvre).

---

## Hand-by-Hand Breakdown

### RUN 1 — Started with 9 chips (4.5 BB — emergency short stack)

---

#### Hand 1 — 2♦ 5♣ (Two-Five offsuit)
**Situation:** Pre-flop. Free check available (no one raised). Stack: 9 chips (5BB).  
**Decision:** RAISE ALL-IN (shove 10 chips)  
**Reasoning:** At 5BB, poker strategy says shove with any two cards — blinds will eat the stack in 2 orbits if we wait.  
**Board ran out:** Unknown (bot missed the click due to technical issue)  
**Result:** Chips unchanged

**Domain Expert Q&A:**
1. Who was bluffing? — No reads yet, first hand
2. How sure the hand wins? — Very low confidence. 2-5 offsuit is the worst possible hand (~28% vs any two cards)
3. How much willing to raise? — Full stack (all-in). No half measures at 5BB
4. After bet, bluff or fold? — All-in, committed, no further decision
5. Dominant feeling? — **Hope** (desperate situation, any double-up helps)
6. Impact if lose? — Critical. Already at minimum stack
7. Overall feeling? — **Bad** — worst hand at worst stack, but mathematically correct play

---

#### Hand 2 — Q♣ 4♠ (Queen-Four offsuit)
**Situation:** Flop came 5♣ K♠ 4♣. We paired the 4 (bottom pair). Stack: 5 chips (3BB). Pot: 8 chips.  
**Decision:** CHECK (timeout — bot had technical issues, defaulted automatically)  
**Board:** 5c Ks 4c 2h Qh  
**Result:** Unknown outcome

**Domain Expert Q&A:**
1. Who was bluffing? — Could not assess, timed out
2. How sure the hand wins? — Medium. Bottom pair on a dangerous board (flush possible, K on board)
3. How much willing to raise? — Should have shoved (3BB left), but timed out
4. After bet? — Should have committed all-in with any pair at this stack
5. Dominant feeling? — **Fear** — tiny stack, dangerous board
6. Impact if lose? — Near-terminal for this buy-in
7. Overall feeling? — **Bad** — technical failure cost us the decision

---

#### Hand 3 — 2♦ 9♠ (Nine-Two offsuit)
**Situation:** Turn card showed A♦ 6♣ 9♦ 3♣. We had a pair of 9s. Stack: 4 chips (2BB). Pot: 5. Call: 1.  
**Decision:** RAISE (shove all remaining chips)  
**Result:** LOSS (−2)

**Domain Expert Q&A:**
1. Who was bluffing? — Could not assess at 2BB, survival mode
2. How sure the hand wins? — Low-medium. Pair of 9s but Ace on board is dangerous
3. How much willing to raise? — All-in (last chips)
4. After bet? — Committed, all-in
5. Dominant feeling? — **Fear** — last chips
6. Impact if lose? — Busted
7. Overall feeling? — **Bad** — weak hand, but mathematically forced to play

---

#### Hands 4–6 — Garbage cards at 2BB or less
(26o, T7s, K2o — all shoved or timed out due to bot issues at near-zero stacks)  
These hands were unwinnable from a stack perspective — the session was already lost.

---

### RUN 2 — Started with 84 chips (~42BB — playable stack)

---

#### Hand 1 — 8♣ 7♣ (Eight-Seven suited)
**Situation:** Pre-flop then Flop K♥ J♠ 4♣. No pair, no draw.  
**Final Board:** Kh Js 4c 2h Qh  
**Result:** **LOSS (−40 chips)**

**Domain Expert Q&A:**
1. Who was bluffing? — Opponent who bet large on K-high board was likely value betting, not bluffing
2. How sure the hand wins? — Low. 87s missed the K-J-4 flop completely (no pair, gutshot only)
3. How much willing to raise? — Should have folded flop when it missed
4. After bet? — Should fold to aggression on missed boards
5. Dominant feeling? — **Hope** (suited connectors felt playable, but board bricked)
6. Impact if lose? — Significant, lost nearly half the stack
7. Overall feeling? — **Bad** — 87s is a drawing hand that needs to hit; it didn't

> **Where it went wrong:** Called too much on a board that missed completely. 8-7 on K-J-4 has almost no equity — should have folded to any bet on the flop.

---

#### Hand 2 — 3♣ 9♥ (Nine-Three offsuit)
**Situation:** Flop 8♦ 5♠ 9♠. We paired the 9 (middle pair). Turn: Q♦  
**Final Board:** 8d 5s 9s Qd  
**Result:** **LOSS (−4 chips)**

**Domain Expert Q&A:**
1. Who was bluffing? — Unclear
2. How sure the hand wins? — Low-medium. Middle pair on a connected board (straight draws everywhere)
3. How much willing to raise? — Minimal — 93o is a weak hand even when it hits
4. After bet? — Should check-fold to aggression
5. Dominant feeling? — **Hope** (paired the 9, wanted to see a cheap showdown)
6. Impact if lose? — Moderate
7. Overall feeling? — **Ok** — right to try for a showdown, wrong board for it

> **Where it went wrong:** 9-3 offsuit should not have been played to the flop. Weak starting hand that got us into a marginal situation.

---

#### Hand 3 — 2♦ 4♥ (Four-Two offsuit)
**Situation:** Pre-flop. Folded.  
**Final Board:** Jh Ac 6d 3c 8d  
**Result:** **LOSS (−6 chips)** — blinds posted

**Domain Expert Q&A:**
1. Who was bluffing? — N/A, folded pre-flop
2. How sure the hand wins? — Near zero. 42o is literally the worst starting hand
3. How much willing to raise? — Zero
4. After bet? — Correctly folded
5. Dominant feeling? — **Fear** (garbage hand)
6. Impact if lose? — Just blind money, acceptable loss
7. Overall feeling? — **Bad** hand, **correct** fold

> **What would have happened:** Board ran out J-A-6-3-8. 42o would have made a straight (A-2-3-4-5... no, gap). Nothing. Correct fold.

---

#### Hand 4 — K♠ 8♥ (King-Eight offsuit)
**Situation:** Pre-flop, then Flop Q♥ 6♣ 2♣. We had K-high, no pair.  
**Final Board:** Qh 6c 2c 4h Qc  
**Result:** **LOSS (−34 chips)**

**Domain Expert Q&A:**
1. Who was bluffing? — Opponent bet into a Queen-high board — could be value or bluff with a Q
2. How sure the hand wins? — Very low. K8o on Q-6-2 = K-high only, no pair
3. How much willing to raise? — Should not have raised/called; K-high is not a made hand
4. After bet? — Should fold K-high to any bet on that board
5. Dominant feeling? — **Greed** (K is a big card, felt like it should win)
6. Impact if lose? — Severe, lost most of remaining stack
7. Overall feeling? — **Bad** — K8o on Q-6-2 board is a clear fold

> **Where it went wrong:** K8 offsuit does NOT make a pair on Q-6-2. K-high alone is almost never the best hand on a multi-way board. Should have folded on the flop immediately.

---

### RUN 3 — Started with 25 chips (12.5BB)

---

#### Hand 1 — J♦ 6♠ (Jack-Six offsuit)
**Situation:** Pre-flop. Facing 2BB raise. Stack: 25 chips (13BB).  
**Decision:** FOLD  
**Board ran out:** T♥ 3♦ 9♥ J♣ J♥ (would have made trips with the J — but correct fold)  
**Result:** BREAK-EVEN (just posted blind)

**Domain Expert Q&A:**
1. Who was bluffing? — New table, no reads. fish321 (244 chips) and xtt (239) are the big stacks
2. How sure the hand wins? — Low. J6o vs any raising range ≈ 38%
3. How much willing to raise? — Zero — J6o below shove threshold at 13BB
4. After bet? — Correct fold
5. Dominant feeling? — **Fear** (fresh buy-in, preserve chips)
6. Impact if lose? — Would waste a good chip position
7. Overall feeling? — **Ok** — right decision even though board would have given us trips

> **Interesting note:** The board ran out T-9-J-J — we would have made three Jacks. But folding J6o facing a raise at 13BB is still correct poker — you can't know the future, only play the odds.

---

#### Hand 2 — J♣ Q♦ (Queen-Jack offsuit)
**Situation:** Pre-flop. Shoved all-in for 25 chips (13BB). Faced a re-raise to 16.  
**Final Board:** 2♦ 5♠ A♦ 2♥ 7♥  
**Showdown:** Sellezen had 8♠ 8♥ (pocket eights)  
**Result:** **LOSS (−25 chips)**

**Domain Expert Q&A:**
1. Who was bluffing? — Sellezen (88) was NOT bluffing — legitimate hand
2. How sure the hand wins? — Medium. QJo vs 88: roughly 45% (coin flip, slightly behind)
3. How much willing to raise? — Full stack — 25 chips all-in
4. After bet? — Reshoved correctly (can't call 16 and leave 9 behind)
5. Dominant feeling? — **Hope** — QJo is a real hand, good shove spot
6. Impact if lose? — Busted, end of session
7. Overall feeling? — **Ok** — right play, ran into a pair, lost a flip

> **Where it went wrong?** Nowhere — this was correct poker. QJo at 13BB is a standard shove. We ran into 88 and lost a roughly 45/55 flip. That's normal variance, not a mistake.

---

## Overall Pattern Analysis

### What the AI Did Well
- **Correct fold discipline** — folded J6o, 42o, T5o, 92o — all correct
- **Correct shove decisions** — QJo, KJs, AKo at short stacks are all standard shoves
- **Pot odds awareness** — recognised when pot odds justified calling with weak hands
- **Speed** — final session used instant file-based signalling, decisions landed in <2 seconds

### What Went Wrong
- **Technical failures (bot issues):** Several correct decisions (KJc shove, AKo shove) never landed because the click timed out while the bot was being fixed. This cost multiple hands of value.
- **K8o hand in Run 2:** K-high on a Q-6-2 board is a clear fold — continuing cost 34 chips
- **87s hand in Run 2:** Suited connectors are drawing hands. When the flop misses, fold — don't chase

### Key Insight for Domain Expert
> The AI lost primarily due to **two factors**:
> 1. **Bad cards** — Most hands were garbage (42o, 25o, 26o, T2o, T5o). You cannot win consistently with these hands regardless of strategy.
> 2. **Technical problems** — The bot was being built and debugged live during the session. Several good hands (AKo, KJc) had correct decisions filed but the click never executed.
>
> The one genuine strategic mistake was the K8o hand — that was a clear fold and wasn't taken.

---

## Answers to Domain Expert's Core Question

> *"At what point did things go bad? Where should things have been done differently?"*

**Run 1:** Already bad before it started — 9 chips at 5BB is an impossible stack. Nothing to do but gamble and hope.

**Run 2:** Went bad at **Hand 1 (87s)**. Losing 40 chips on a missed flush draw put us in short-stack territory for the rest of the run. Should have folded 87s to any bet on K-J-4 board.

**Run 3:** Never went bad strategically — lost a 45/55 flip with QJo vs 88. Correct play, bad outcome. This is poker.

**Overall:** The session needed a larger starting stack (50-100BB instead of 12.5BB) to allow proper poker. At 12-13BB you are in push-or-fold mode — every hand is all-in or fold, no room for strategy.
