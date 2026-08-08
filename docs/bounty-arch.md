# Architecture — group bounty

Technical design. Product scope is in [bounty-prd.md](bounty-prd.md).

---

## 1. What the system is

**A weekly quest ledger, a noticeboard that renders it, and four branches inside
the raid signup that already existed.**

```
app/data/dungeons.js   nests, variants, aliases          ← you own this
app/data/bounty.js     constants, reward table
app/bounty.js          week key, variant index, parser, claims   (pure)
app/bountyBoard.js     the weekly board
app/bountyJoin.js      everything the signup panel needs
app/_bountyTest.js     147 checks, plain `node`
```

`bounty.js` has no Discord and no Mongo, so all of it runs under
`node app/_bountyTest.js`.

## 2. Design calls

### 2.1 The credit model

- Holders of the same variant's quest in one party **share them into a stack**.
- Clearing once **completes every quest in the stack, for every party member.**
- Each member **spends one claim per stacked quest** and **receives every
  stacked quest's reward.**

```js
const WEEKLY_CLAIMS = 6;
// The stack caps at the weekly claim limit for a reason, not a coincidence: a
// 7th stacked quest could not be claimed by anyone, so it is simply wasted.
const MAX_SHARE_STACK = WEEKLY_CLAIMS;
```

**One cap per run, even when the run clears two variants.** A marathon's GDN HC
and GDN CL spend from the same weekly budget, so `min(maxSlot, 6)` covers both.
Showing 6 each was tried and reverted — it promises 12 claims that don't exist.

### 2.2 Exclusivity is per game account

Two characters on one account cannot share a party — you're logged into one at a
time. Two on *different* accounts can, even when one person owns both, because
someone else may be fielding the second.

`chars[].account` is a free-text label. Characters with none all count as one
account, which is the conservative reading and matches how the roster behaved
before the field existed.

### 2.3 No reset job

Reset is Saturday 08:00 WIB. A scheduled job has a failure mode this deployment
can't avoid: Render restarts, and a restart across the window either misses or
double-fires.

Instead **documents are keyed by a derived week**. A new week is a new key; last
week's is never read again.

```js
// WIB is UTC+7 and the reset is 08:00, so shifting UTC by −1h puts that instant
// on a Saturday 00:00 boundary. No timezone library — WIB has no DST.
const t = new Date(now.getTime() - 3600e3);
const back = (t.getUTCDay() + 1) % 7;              // Sat→0 … Fri→6
// Saturdays in one month are 7 days apart, so this counts them exactly.
const ordinal = Math.floor((sat.getUTCDate() - 1) / 7) + 1;
```

Storage `2026-08-W1`; display `W1 — 1 Aug 2026`, or `minggu ke-1 Agustus 2026`
on the board. The **board itself** uses the same key: when `bountyBoard.weekKey`
no longer matches, the old message is deleted and a new one posted — so a
restart across reset can neither miss nor duplicate it.

### 2.4 The roster is shared with the activity planner

`feature/daily-planner` defines the same `chars` collection. Bounty reads and
writes **only** `name`, `role`, `dpsTier`, `account`, and preserves every other
field — so whichever feature creates a character first, the other fills in its
own part of the same document. Neither branch imports the other's modules; the
contract is the document.

`dpsTier` is self-declared. Deriving it from stats needs a damage model per job
per gear tier that nobody has — exactly what has the planner's `jobs.js` stuck
on invented numbers.

### 2.5 The addressable unit is `nest:variant`

A quest names "GDN Classic", never "GDN". Holders of different variants cannot
stack, and **clearing a harder variant does not satisfy an easier one's quest** —
there is no subsumption anywhere in this data, deliberately, because "harder
counts for easier" is a common enough convention that someone will assume it.

Nests are the *storage* shape only, so a name and its aliases are typed once.
`flattenVariants()` at module load produces the list everything downstream uses.

### 2.6 Parsing

`ddn hc u wep` — nest, variant, rarity, scroll, optional `box`. Order never
matters; tokens are tested against alias sets, not positions.

Aliases may be phrases (`memo 1`, `rare legendary`), which a token matcher can't
see, so parsing is two passes: collapse known phrases to one token (longest
first), then match by membership.

Four vocabularies share one token space, so they must not overlap — a nest
aliased `hc` would swallow the variant word and silently mis-parse every line
mentioning it. `_bountyTest.js` asserts the whole rule set, because the failure
mode is a wrong answer rather than an error.

**Pure ordinals never infer a nest.** DDN is the only nest using `i`–`iv`, so a
bare `1` would otherwise resolve to DDN Memoria 1 — a typo becoming a real quest.
`memo 1` still infers, because the alias is `memo 1`, not `1`.

Ambiguity is answered in text — `which Desert Dragon Nest? add a variant:
Classic, HC, Memoria 1…` — not with a picker. A bounty week is 1–3 lines, so a
stateful resolve flow costs more than the retype it saves.

### 2.7 Character before seat

Clicking a role picks a ROLE — the panel only ever stored `{ slot, subRole }`.
So `askBeforeSeat()` runs **before** seating: when the joiner holds quests on
more than one character, the picker seats them once they say which. Dismissing
the menu means not joining, which is the point — the panel never holds a seat the
bot cannot attribute.

The answer lives on the seat as `bountyChar`, and `bountyQuests` records how many
of that character's quests actually fit the stack. Quests past the cap were
shared with nobody, so they are neither counted nor marked done.

**The bot never picks between two characters of the same job.** A guess claims a
quest that was never run, and the player has no way to notice.

### 2.8 Bounty-only parties

`closedToBounty` swaps nine role buttons for one Join and turns `stackRoles` on,
so per-role caps stop binding — a quest holder is never turned away for "FU is
full". `maxSlot` still caps the party.

Entry requires **any** bounty recorded this week, not one for this nest: under
the share mechanic a member without the quest still gets paid, so the filler
seats have to be reachable.

### 2.9 Closing the run is the only write

`doneRun` calls `markPartyDone()` before the event is dropped. It marks each
member's named character, falling back to a guess only when unambiguous, and
names anyone left over rather than picking for them.

Everything else in the feature only reads. That is why a missing Done leaves the
board stale — an accepted cost, since the same button is what creates the loot
panel and the guild never forgets it.

### 2.10 Panel and preview

Signup panels go to `#public-raid` (8 slots) or `#public-nest` (4), routed by
`maxSlot` so memo and nest follow without a list. Unset env vars keep the panel
where the command was typed.

The command channel keeps a **live preview** — same embed, no buttons, plus a
jump link. Sync lives in `updateMessage()`, the one function all ~8 handlers
already call, so none of them can forget it. A preview that was deleted or lost
is forgotten rather than taking the panel down with it; `closePreview()` retires
it on Done and Cancel.

## 3. Dependencies

**Zero new ones.** Temptations declined: `node-cron` (the board is `setInterval`
+ a key comparison), a matcher/solver library (§5), `luxon` (one fixed offset, no
DST).

## 4. Data

```js
// collection: chars — SHARED with the activity planner (§2.4)
{ _id: userId, chars: [{ name, role, dpsTier, account, job }] }

// collection: bountyWeek — one document per user per week
{ _id: `${userId}:${weekKey}`, owners: [userId], weekKey,
  chars: { [charName]: {
    board:  [{ poolKey, rarity, scroll, box, runId }],  // runId ⇒ claimed
    shares: [{ poolKey, rarity, scroll, box, runId }],  // received from a stack
  } } }

// in the single state doc
bountyBoard = { messageId, weekKey }
```

**There is no claim counter.** The board holds exactly 6 and the cap is exactly
6, so the count is derived and cannot drift from what it counts:

```js
claimsUsed = board.filter((q) => q.runId).length + shares.length;
```

`owners` is an array from day one even though only one id goes in it — that is
the entire storage change alt-account sharing would need.

## 5. Deleted, and why

The first three iterations of this feature are gone. Recorded so the reasoning
isn't rediscovered and reinstated:

| Deleted | Reason |
| --- | --- |
| The matcher (`buildPlan`, `buildStacks`, `fillerCandidates`, value/quality ranking) | It ranked runs against a scarce-claim budget. The real question was "who else has GDN CL?", which the board answers by listing |
| `/bounty-plan`, `/bounty-need`, `/bounty-run` | Superseded by the board and by `closed_to_bounty` |
| Bounty request (tag holders → ✅ → create party) | A second way to form the same party |
| Per-variant stack caps | §2.1 — the 6 is a weekly claim budget, not a per-clear one |
| A per-person "sudah beres" button, and `bountyRuns` state | Done marks the whole party; the map existed only so the button survived the panel closing |

One correction worth keeping: an early draft modelled the mechanic as "one claim
each per run" and concluded claims were abundant and nothing bound. That followed
correctly from a wrong premise — under the real mechanic one good run can consume
a character's entire week.

## 6. Verification

```bash
node app/_bountyTest.js
```

147 checks, weighted toward failures that are silent rather than loud:

1. Week boundary — 07:59 and 08:00 WIB Saturday land in different weeks
2. Week label — August 2026's five resets map to W1…W5; a week spanning into
   September keeps its August label
3. Parser — order-independent, phrases win over their fragments, every failure
   names what's missing
4. Alias rule set — nest aliases unique and disjoint from rarity/scroll/box
   words; every variant key exists; bare ordinals never infer a nest
5. Rank table, claim accounting, reward tally
6. `seatUser` — switching slots keeps the named bounty character
7. Bounty-only panel — one Join, no role buttons, toggle only where poolKeys exist
8. Stack cap — counts quests not people, one cap across a marathon's variants
9. Preview — the join link is on the preview only, and a lost preview is
   forgotten rather than thrown

The script prints the variant table afterwards, which is the fastest way to see a
data change without deploying.
