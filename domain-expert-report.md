# Domain Expert Report — Agent Gamble
**Game:** PokerNow NLH · Table `pglYSBbcroTrz1BexlA9W2_DC`
**Session Date:** 2026-05-08
**AI Decision Maker:** Gemini 2.5 Flash (real-time via WebSocket)
**Hero ID:** vL7jsW8l3g (`jivstr` at the table)
**Session Start Stack:** 64 chips → rebought → 150 chips
**Session End Stack:** ~145 chips
**Net Result:** Loss (started at 64, went to 0, rebought at 150, ended ~145)

> **How it works:** Gemini reads the WebSocket feed in real time — hole cards, board, pot, all opponent bets with timing — and prints a decision. The human player clicks. This report captures every hand, what Gemini suggested, what the player did, and what happened.

---

## Key Player to Watch: `strange`

Before the hands — one opponent dominated the table all session:

| Hand | strange's action | Amount |
|------|-----------------|--------|
| Hand 1 | Pre-flop RAISE | 50 → re-raise 986 |
| Hand 5 | Pre-flop RAISE | 1,177 |
| Hand 6 | Pre-flop RAISE | 1,030 |
| Hand 7 | Pre-flop RAISE | 566 |
| Hand 8 | Pre-flop RAISE | 1,587 |

**`strange` was the dominant aggressor all session** — consistently making 3-4x pot raises pre-flop. Either running hot with premium hands or using a heavy pressure strategy to steal blinds.

---

## Session Hands — Latest First

---

### Hand 9 — 6h Qd | Board: unknown | ➖ BREAK EVEN

| Field | Value |
|-------|-------|
| Hero cards | 6h Qd (Queen-Six offsuit) |
| Gemini decision | **FOLD** |
| Stack | 145 → 145 |
| Result | BREAK EVEN — folded pre-flop |

**Betting context:** Seat posted 2 on pre-flop, Monji raised 25 on flop. Table had active aggression.

**7 Domain Expert Questions:**
1. **Bluffing?** Cannot assess — hero folded pre-flop before meaningful betting developed.
2. **Hand strength?** Q6o is a below-average hand. Against a raise, it has roughly 35-40% equity vs any two random cards, but facing a pre-flop raise it drops significantly.
3. **Willing to raise how much?** Zero — Q6o is a clear fold to any raise, especially in early/middle position.
4. **Bluff or fold after max raise?** Fold — no hand strength to support a bluff.
5. **Dominant feeling?** None — routine fold.
6. **Stack impact?** Zero chips lost. Correct fold saves chips.
7. **Overall verdict?** **Good** — disciplined fold with a weak hand.

**Turning point:** Hand never started for hero. Correct play.
**Lesson:** Q6o is a fold in most spots. Gemini got this right.

---

### Hand 8b — 7s 6h | Board: Qd As Jd | ➖ BREAK EVEN

| Field | Value |
|-------|-------|
| Hero cards | 7s 6h (Seven-Six offsuit) |
| Board (flop) | Qd As Jd |
| Gemini decision | **CHECK** (on flop) |
| Stack | 147 → 145 (-2) |
| Result | Small loss (likely blind) |

**Betting context:**
- Pre-flop: hero called 2 chips (limped in)
- Flop (Qd As Jd): Magda called, imaohw called — passive callers
- popod called 40 chips (significant bet on a dangerous board)

**7 Domain Expert Questions:**
1. **Bluffing?** popod's 40-chip call on Qd As Jd is suspicious — could be a flush draw (clubs) or a broadway draw (KT for the straight). Most players calling 40 on this board have something real.
2. **Hand strength?** 7s 6h on Qd As Jd = no pair, no draw (offsuit). Hero has essentially nothing. Checking is the only correct play.
3. **Willing to raise how much?** Zero — hero has 7-high with no draw on a Q-A-J board. Any raise is a bluff with no equity.
4. **Bluff or fold after max raise?** Fold immediately. 7-high cannot call any significant bet.
5. **Dominant feeling?** **Fear** — on a Q-A-J board with 7-6 offsuit, the hand is drawing near-dead.
6. **Stack impact?** -2 chips (blind/minimal). Negligible.
7. **Overall verdict?** **Ok** — hero checked as Gemini suggested. Losing just 2 chips with this hand is fine.

**Turning point:** Pre-flop limp with 7-6 offsuit was questionable — could have saved the blind. Once in, Gemini's CHECK was correct.
**Lesson:** 7-6 offsuit is a fold from most positions. If limping in, be ready to release the hand the moment any aggression appears.

---

### Hand 8 — 4s Kd | Board: Ac 2d 7s Kh 9d | ➖ BREAK EVEN

| Field | Value |
|-------|-------|
| Hero cards | 4s Kd (King-Four offsuit) |
| Board | Ac 2d 7s Kh 9d |
| Gemini decision | **FOLD** pre-flop |
| Stack | 147 → 147 |
| Result | BREAK EVEN — folded correctly |

**Betting context:**
- imaohw BET 200 pre-flop (all-in or near it)
- strange RAISE 1,587 pre-flop

**7 Domain Expert Questions:**
1. **Bluffing?** Unlikely either player was bluffing — imaohw went all-in and strange re-raised massive. Both represent premium holdings (AA, KK, AK).
2. **Hand strength?** K4o would have made two pair on this board (K and nothing useful). But facing a 200-chip shove AND a 1,587 re-raise pre-flop, K4o is a massive underdog.
3. **Willing to raise how much?** Zero — K4o cannot call 200 pre-flop let alone a 1,587 re-raise.
4. **Bluff or fold?** Fold. Clear spot.
5. **Dominant feeling?** None — cold, rational fold.
6. **Stack impact?** Zero chips lost.
7. **Overall verdict?** **Good** — Gemini correctly folded K4o against two pre-flop monsters.

**Turning point:** Correct fold pre-flop. The board showed A-K which would have been dangerous for K4o anyway — opponent likely had AA.
**Lesson:** K4o is a fold to any significant pre-flop raise. Gemini was right.

---

### Hand 7 — Jd Kd | Board: Tc 5h 4c 7h Td | ➖ BREAK EVEN

| Field | Value |
|-------|-------|
| Hero cards | Jd Kd (King-Jack suited diamonds) |
| Board | Tc 5h 4c 7h Td |
| Gemini decision | **RAISE 8** pre-flop |
| Stack | 149 → 147 (-2) |
| Result | Small loss |

**Betting context:**
- Wasason BET 30 pre-flop
- strange RAISE 566 pre-flop
- Gemini said RAISE 8 — a tiny 8-chip raise into a 566-chip re-raise environment

**7 Domain Expert Questions:**
1. **Bluffing?** strange's 566 pre-flop raise is either a massive value bet (AA/KK) or a squeeze play. Given strange's pattern all session, likely applying maximum pressure.
2. **Hand strength?** Jd Kd is a strong hand — top 15% of starting hands. It has good equity (flush draw potential, high card strength). Against strange's range it is still often dominated (AK, QQ+).
3. **Willing to raise how much?** With KJs at ~75BB, a 3-bet to ~90-100 chips is reasonable. Gemini's RAISE 8 was completely wrong — too small to be meaningful.
4. **Bluff or fold after max raise?** Facing strange's 566 raise, the real decision is call or fold. KJs can call vs a wide range but is risky against this particular player's aggression.
5. **Dominant feeling?** **Hope** — KJs is a hand you want to play. Gemini's instinct to raise was right, amount was badly wrong.
6. **Stack impact?** -2 chips (minor). Hero likely folded or lost the blind only.
7. **Overall verdict?** **Bad** — RAISE 8 into a 566-chip raise made no sense. Should have been FOLD or a proper 3-bet size.

**Turning point:** Gemini suggested RAISE 8 which is incoherent sizing. The hand should have been a clear FOLD (facing 566 raise, 75BB stack) or a proper 3-bet to ~100+.
**Lesson:** Bet sizing matters. A raise must be large enough to accomplish something — 8 chips into 566 is noise. Gemini needs to be aware of the bet it is responding to, not just pot size.

---

### Hand 6 — (cards not tracked) | Board: 5h As 2c Kd Td | ➖ BREAK EVEN

| Field | Value |
|-------|-------|
| Hero cards | Not captured |
| Board | 5h As 2c Kd Td |
| Stack | 150 → 150 |
| Result | BREAK EVEN |

**Betting context:**
- Ttt72638 BET 2
- popod RAISE 20
- strange RAISE 1,030 (again — massive pressure)

**7 Domain Expert Questions:**
1. **Bluffing?** strange's 1,030 raise (again) is the story. This is consistent with either AA/KK or a bully-the-table strategy. popod's 20-chip raise is likely a genuine hand (AK, KQ, KJ type).
2. **Hand strength?** Unknown without hero's cards. The board is A-K high — strong hands beat this easily.
3. **Willing to raise?** Likely zero — hero sat out this hand (cards not tracked = folded pre-flop).
4. **Bluff or fold?** Fold was the implicit outcome.
5. **Dominant feeling?** Prudence — recognizing strange's pattern and stepping aside.
6. **Stack impact?** Zero.
7. **Overall verdict?** **Ok** — correct to fold against massive pre-flop raises without a premium hand.

**Lesson:** `strange` is not to be engaged without a top-5 hand (AA, KK, QQ, AKs). The bot needs better opponent profiling.

---

### Hand 5 — (cards not tracked) | BREAK EVEN

| Field | Value |
|-------|-------|
| Hero cards | Not captured |
| Stack | 150 → 150 |

**Betting context:** ChunkinIt BET 4, strange RAISE 1,177.

Same pattern. Hero folded correctly to the massive raise.

---

### Hand 4 — (cards not tracked) | Board: Td 8c 9s Kh 5s | ➖ BREAK EVEN

| Field | Value |
|-------|-------|
| Hero cards | Not captured |
| Stack | 150 → 150 |

**Betting context:** TayoKM BET 209 (all-in or near it) pre-flop. Another big shove.

Hero folded. Correct.

---

### Hand 3 — (cards not tracked) | Board: Kc Kh Jd 5h 4s | ➖ BREAK EVEN

| Field | Value |
|-------|-------|
| Hero cards | Not captured (folded pre-flop) |
| Stack | 150 → 150 |

Passed the hand. Board was K-K-J — would need a very strong hand to play.

---

### Hand 2 — 6c Ac | Board: Kd Kh 2d 2c Qd | ➖ BREAK EVEN

| Field | Value |
|-------|-------|
| Hero cards | 6c Ac (Ace-Six suited clubs) |
| Board | Kd Kh 2d 2c Qd |
| Gemini decision | **FOLD** pre-flop |
| Stack | 150 → 150 |
| Result | BREAK EVEN |

**Betting context:**
- strange BET 2
- TayoKM RAISE 50

**7 Domain Expert Questions:**
1. **Bluffing?** TayoKM's 50-chip raise could be legitimate (KQ, KJ) or a squeeze. Not clearly a bluff.
2. **Hand strength?** Ac 6c is a playable hand — suited ace has flush draw potential. But facing a 50-chip raise (25BB), calling opens risk against K-heavy boards like this one.
3. **Willing to raise how much?** With Ac 6c at 75BB, calling the 50-chip raise is reasonable. Gemini's FOLD is too tight — A6s has equity.
4. **Bluff or fold?** N/A — Gemini folded.
5. **Dominant feeling?** Gemini played **Fear** here — folded a suited ace too quickly.
6. **Stack impact?** Zero chips lost by folding.
7. **Overall verdict?** **Ok** — conservative but defensible. The board (K-K-2-2-Q) would have been very difficult for A6. Gemini's fold avoided a tricky spot.

**Turning point:** If hero had called, they would have faced K-K on the board — a nearly unplayable texture for A6.
**Lesson:** A6s is borderline vs a 25BB raise. Folding is conservative but safe. Against this table's aggression, fold is fine.

---

### Hand 1 — (rebuy hand) | Board: 7h Ad Jh 5s 4c | ➖ BREAK EVEN

| Field | Value |
|-------|-------|
| Hero cards | Not captured |
| Stack | 0 → 150 (rebuy happened) |
| Gemini decision | **ALLIN** |
| Result | BREAK EVEN — hero rebought, 150 chips received |

**Betting context:** Massive pre-flop war:
- Alex rader BET 2 → RAISE 98 → effectively all-in
- strange RAISE 50 → RAISE 986

Gemini said ALLIN when stack was 0 — this was a phantom call on an empty stack. The rebuy brought 150 chips.

**Note:** This hand's data is unreliable due to the rebuy mid-hand confusing the stack tracking.

---

### Hand 0 — Ks Jd | Board: 6d 3s 8d 7c 2s | ❌ LOSS −44

| Field | Value |
|-------|-------|
| Hero cards | Ks Jd (King-Jack offsuit) |
| Board | 6d 3s 8d → 7c → 2s |
| Gemini decision | **CHECK** on flop |
| Stack | 44 → 0 (−44) |
| Result | **LOSS** — all chips lost |

**Betting context:**
- Flop (6d 3s 8d): strange CALL, Seat CALL — passive calls (pot was 82)
- Alex rader bet 49 on flop (large bet into 82-chip pot = overbet)
- Hero was already at 22BB (very short stack)

**7 Domain Expert Questions:**
1. **Bluffing?** Alex rader's 49-chip bet into a 82-chip pot on 6-3-8 rainbow-ish board is a polarising bet — either a strong pair (88, 66, 33) or a complete bluff. Given the passive calls by strange and Seat, Alex may have been betting into weakness.
2. **Hand strength?** Ks Jd on 6d 3s 8d = two overcards, no pair, no flush draw. Hero had K-J with no connection to this board. Equity was roughly 25-30% (needing to hit K or J on later streets).
3. **Willing to raise how much?** With 22BB and K-J on a missed flop, the right play was fold-or-shove. A check-shove (if someone bets) or a probe bet to take it down. Gemini's CHECK was passive — gave free cards.
4. **Bluff or fold after max raise?** Should have folded to Alex rader's 49-chip bet. Hero had no made hand and only ~25% equity.
5. **Dominant feeling?** **Hope** — hoping to hit K or J. But with 22BB, hope is a losing strategy. Should have been rational fold.
6. **Stack impact?** −44 chips — total bust of this stack. Very significant. Required a rebuy.
7. **Overall verdict?** **Bad** — Gemini said CHECK on K-J with no board connection at 22BB. Should have been FOLD to Alex's bet. The stack was too short to play speculative hands.

**Turning point:** Alex rader's 49-chip bet on the flop. With K-J and no pair on 6-3-8, the correct response was FOLD. Checking gave Alex a free pass and hero's chips followed.
**Lesson:** At 20BB or less, K-J offsuit with no board connection is a fold to any significant bet. Gemini's CHECK allowed the hand to continue with poor equity. Short-stack play requires much tighter post-flop discipline.

---

## Previous Sessions Summary
*(From earlier session on 2026-05-07 — Claude was the decision maker, not Gemini)*

| Session | Start Stack | End Stack | Result | Hands |
|---------|------------|-----------|--------|-------|
| Run 1 (10:50) | 9 chips (4.5BB) | 0 | −9 | 6 hands |
| Run 2 (10:52) | 84 chips | 0 | −84 | 4 hands |
| Run 3 | 25 chips | 0 | −25 | 2 hands |

**Key hands from earlier sessions:**
- **8c 7c** (pre-flop): Folded. Would have made Full House (2s on board) — missed opportunity but correct fold
- **3c 9h**: Lost -4 chips. Called pre-flop, didn't connect
- **Pattern**: Claude (earlier AI) consistently played too short-stacked to recover, and the starting stacks were critically low (4-42BB)

---

## Overall Analysis

### What Went Wrong

**1. Short stack play (critical)**
The session started with 64 chips (32BB) and was quickly at 22BB before the first real hand. At ≤20BB, poker strategy changes fundamentally — you cannot play speculative hands post-flop. Gemini was not always aware of this constraint.

**2. Gemini's bet sizing was broken in Hand 7**
RAISE 8 into a 566-chip raise is a category error. Gemini computed a raise amount without referencing the actual raise it was responding to. This needs fixing in the prompt.

**3. Passive play with short stack (Hand 0)**
With K-J at 22BB and no board connection on the flop, checking gave opponents free cards. At that stack size, the play is check-fold to any bet, not check-call.

**4. `strange` dominated the table**
Across 9 hands, `strange` raised pre-flop massively in at least 5 of them (566 to 1,587 chips). The bot had no memory or profiling of this. Every new hand, Gemini evaluated in isolation without knowing `strange` is the table bully.

### What Went Right

- **Folding K4o, Q6o, 6h-2d etc.** — Gemini correctly identified weak hands and folded against massive aggression
- **Recognizing `strange`'s raises as danger signals** — in most hands, Gemini folded correctly to the 1,000+ chip raises
- **Stack preservation** — from 150 chips, hero only lost ~5 chips over 8 hands (excluding Hand 0 which was at the old 44-chip stack)

### Top 3 Recommendations for Domain Expert Review

1. **Opponent profiling**: `strange` raised 500-1,500 chips pre-flop in 5 consecutive hands. The bot should flag this pattern and tighten hero's calling range dramatically vs this player. Only AA/KK should engage with `strange` pre-flop.

2. **Short-stack rule enforcement**: Below 25BB, no speculative calls. Below 15BB, only push-fold poker. The prompt to Gemini should enforce this explicitly based on stack size in BBs.

3. **Bet sizing context**: When Gemini says RAISE, it must reference the current bet it is responding to. RAISE 8 into a 566-chip raise is worse than folding — it leaks chips and provides information without any fold equity.

---

*Report generated from `/tmp/gemini-live.log` and `/tmp/session-data.json` — 2026-05-08*
*AI decision maker: Gemini 2.5 Flash via Google Generative AI API*
