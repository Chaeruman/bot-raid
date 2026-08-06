# Architecture — group bounty

Technical design for the "who can stack onto this quest, and who has claims left
to fill the party?" feature. Product scope and the data you still owe live in
[bounty-prd.md](bounty-prd.md).

Strings are English, matching the signup and loot panels this feature sits next
to and reuses. Dates keep `id-ID` formatting. See §6.6.

---

## 1. What the system actually is

**A stack builder over a weekly list, bolted onto the raid signup panel that
already exists.**

There is no solver, no scheduler, no optimizer. The two genuinely new pieces are
the dungeon dataset (which you own) and about 200 lines of grouping and rendering.
Everything else is the `/raid` panel with role caps turned off and a different
Done handler.

The rest of this document is mostly a record of things deliberately *not* built,
so nobody rebuilds them in six months.

---

## 2. Design calls

### 2.1 The credit model

The in-game mechanic, as modelled:

- Holders of the same dungeon's quest in one party **share them into a stack**.
- The stack holds at most **6** quests.
- Clearing the dungeon once **completes every quest in the stack, for every party
  member** — holders and non-holders alike.
- Each member **spends one claim per stacked quest** and **receives every stacked
  quest's reward**.

So a 4-stack in an 8-capacity dungeon: one clear, all 8 people spend 4 of their 6
claims and each receive all 4 rewards.

```js
const WEEKLY_CLAIMS = 6;

// The stack caps at the weekly claim limit for a *reason*, not a coincidence: a
// 7th stacked quest could not be claimed by anyone in the party, because nobody
// can claim more than 6 in a week. It would simply be wasted. Written as a
// derivation so the causal link survives, and so raising one raises both.
const MAX_SHARE_STACK = WEEKLY_CLAIMS;

// A 4-capacity variant can never stack more than 4: only 4 people can be in the
// party to share them. Capacity is the variant's when it sets one, else the
// nest's default.
const maxStack = (v) => Math.min(v.capacity, MAX_SHARE_STACK);
```

**A member with fewer claims left than the stack is deep wastes the difference.**
Modelled as: complete the highest-ranked `claimsLeft` of the stacked quests, waste
the rest. Whether the game instead blocks the join or pays out anyway is unknown —
the bot's response is the same either way, which is to warn loudly and let the
player decide (§6.4).

### 2.2 Depth buys time; quality buys value

This is the design's load-bearing distinction, and getting it backwards produces a
plausible-looking matcher that ranks the wrong things.

- **A claim is a claim.** What one claim pays depends only on the rarity of the
  quest it's spent on. Stacking a unique with five others does not make that
  unique worth more.
- **Stacking N quests means one dungeon clear instead of N.** That is the entire
  benefit: real-world time, not reward.

Two consequences, and they point at different metrics:

| Question | Asked by | Metric |
| --- | --- | --- |
| *What should we form a party for?* | the guild | `Σ rank` over the stack — reward delivered per clear |
| *Should I spend my claims on this?* | one player | `Σ rank ÷ stack size` — average rank per claim |

`/bounty-plan` ranks by the first and **prints the second on every row** (§6.3).
A player with 2 claims left should take a 2-stack of legendaries over a 4-stack of
uniques, and no single ranking can express that — so the design shows both numbers
rather than blending them into one score that hides the case.

Rejected: one combined score. It reads well and it silently makes the wrong call
for anyone not starting the week at 6 claims, which after the first run is
everybody.

> **Correction, recorded on purpose.** An earlier draft of this document modelled
> the mechanic as "one claim each, per run" and concluded that claims were
> abundant, that nothing bound, and that the matcher was therefore a noticeboard
> needing no ranking at all. That conclusion followed correctly from a wrong
> premise. Under the real mechanic one good run can consume a character's entire
> week, claims bind hard, and ranking is the point. Left here so the abandoned
> "claims don't matter" reasoning doesn't get rediscovered and reinstated.

### 2.3 No reset job

Reset is Saturday 08:00 WIB. A scheduled job that clears counters has a failure
mode this deployment can't avoid: Render restarts, and a restart across the reset
window either misses it or double-fires.

Instead, **documents are keyed by a derived week**. A new week means a new key;
last week's document is simply never read again. Nothing to schedule, nothing a
restart can miss. Same approach as the planner's `weekKey`, different label
format.

```js
// WIB is UTC+7 and the reset is at 08:00, so shifting UTC by −1h puts the reset
// instant exactly on a Saturday 00:00 boundary. Then the week is just "which
// Saturday did we last pass". No timezone library — WIB has no DST.
function resetSaturday(now = new Date()) {
  const t = new Date(now.getTime() - 3600e3);
  const back = (t.getUTCDay() + 1) % 7;          // Sat→0, Sun→1, … Fri→6
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - back));
}
```

**The label counts Saturdays within the month, not the year** — `W1`, `W2`, … up
to `W5`:

```js
const ordinal = (sat) => Math.floor((sat.getUTCDate() - 1) / 7) + 1;
```

That formula is exact rather than approximate: Saturdays inside one month are
always 7 days apart, so date−1 divided by 7 counts them correctly whatever date
the first one lands on. August 2026's resets are the 1st, 8th, 15th, 22nd and 29th
→ W1…W5.

- Storage key: `2026-08-W1` — sorts lexicographically, so "list recent weeks" is a
  plain sort.
- Display: `W1 — 1 Aug 2026`.

A week that runs past the end of its month keeps the label of the Saturday it
started on. W5 of August ends in September and is still W5 of August.

### 2.4 The roster is shared with the activity planner

`feature/daily-planner` defines a `chars` collection with the same purpose — one
document per user holding a character array. Two rosters would mean typing 15
characters twice.

So group bounty **writes the same collection and the same document shape**, adding
one field:

```js
// collection: chars
{ _id: userId, chars: [{ name, job, dpsTier, /* planner fields, untouched */ }] }
```

`dpsTier` is `"high" | "good" | "low"`, self-declared.

Rules that keep this from becoming a coupling:

- Bounty code reads and writes **only** `name`, `job` and `dpsTier`. It never
  touches the planner's `atk`/`matk`/`crit`/`fd`/`times` fields, and it preserves
  them on update.
- `/bounty-char add` upserts by name — if the planner's `/char-add` created the
  row first, bounty fills in `dpsTier` and leaves everything else alone. In either
  order the result is the same document.
- Neither branch imports the other's modules. The contract is the document, not
  the code.

**`dpsTier` is self-declared, and there is no stat-derived alternative.** Deriving
"is this a good DPS" from raw stats needs a damage model per job per gear tier
that nobody has — it is exactly what has the planner's `app/data/jobs.js` stuck on
invented numbers. One field the player picks costs nothing and cannot go stale.

The tier exists for one purpose: **checking a proposed party can clear**, against
`minHighDps` on the dungeon row. It counts gear tier, not role — a high-tier
off-role out-damages a weak DPS-role character, so a role census would answer the
wrong question.

### 2.5 Role caps come off, party size still caps

A bounty run cannot turn away someone who would deepen the stack because "DPS is
full". Under §2.1 every seat is also a paid seat, so there is never a composition
reason to reject a body.

The existing panel enforces `role.max` in exactly one place —
`builders/buttons.js` disables a role button when it's full. `roleSelect.js`
itself never checks. So this is two conditionals, not a fork:

```js
// builders/buttons.js
const isFull = !event.stackRoles && role.users.length >= role.max;
// …and skip the "(n/max)" label suffix when stackRoles

// builders/content.js — buildRoleLines()
const slotText = event.stackRoles ? "" : (role.max > 1 ? ` (${count}/${role.max})` : "");
```

Party size is untouched: `createButtons` already hides every role button once
`Object.keys(event.users).length >= event.maxSlot`, so `maxSlot` remains the only
hard cap. Eight Healers is a legal bounty party and that is the intended
behaviour.

Rejected: a separate bounty panel builder. It would duplicate lock, cancel,
remove-member, ping and Done — five working handlers — to avoid two `if`s.

### 2.6 Quest input is tokens, not dropdowns

Structured input for one quest is dungeon + rarity + scroll + card box = four
choices. As components that's four interactions per quest; as a line of text it's
one paste for the whole week.

The loot panel already proved the pattern in this codebase, so the parser copies
its shape rather than inventing one:

```
ddn hc u wep
gdn cl leg acc box
tkn hell rl wtd
```

#### Multi-word aliases, then tokens

People say "memo 1", "dark dragon" and "rare legendary". A pure token matcher
can't see any of them, so parsing is **two passes**:

```js
// 1. Collapse known phrases to their canonical token. Longest phrase first, so
//    "memo 1" wins before the bare "1" alias for variant `i` can claim it.
for (const [canon, phrase] of PHRASES) line = line.split(phrase).join(canon);
// 2. Tokenize and match by membership, as parseStructural() does.
```

`PHRASES` is built once at module load from every multi-word alias across all four
vocabularies, sorted by word count descending. About five lines, and it removes
the single-word restriction everywhere rather than just where it hurt.

Worth stating plainly: an earlier draft of this design mandated single-word
aliases and *simultaneously* listed `rare legendary` as a rarity alias. The rule
was wrong, not the alias.

#### Resolution order

- **Order-independent token membership** — each token is tested against alias
  sets, never matched positionally. `u wep hc ddn` parses the same as `ddn hc u wep`.
- **Nest**: aliases from `app/data/dungeons.js`. Unknown token → the five closest
  by edit distance, scored against **aliases** rather than display names, since
  `ddnn` is one edit from `ddn` and nowhere near the string `Desert Dragon Nest HC`.
- **Variant**: the shared `VARIANTS` vocabulary — `cl`, `norm`, `hc`, `hell`,
  `chal`, `i`…`iv` and digit forms — **plus any per-variant `aliases` on that
  nest**, which is how DDN's `i` also answers to `memo 1`.
- **Rarity**: `u`/`uniq`/`unique`, `leg`/`legend`/`legendary`, `rl`/`rleg`/`rare
  legendary`.
- **Scroll**: `wep`/`weapon`, `wtd`, `acc`/`accessory`, `arm`/`armor`.
- **Card box**: `box`/`cardbox`/`card`.

#### Ambiguity is answered in text, not with a picker

Every failure names what's missing and the exact words that would fix it —
`which Desert Dragon Nest? add a variant: Classic, HC, Memoria 1…` — rather than
opening a resolve flow like the loot panel's unresolved-item buttons.

The loot panel earns its picker: a raid produces a dozen item lines and retyping
one is real friction. A bounty week is 1-3 lines, so a stateful resolve flow
would be more machinery than the thing it saves. If quest volume ever rises,
`state.js` already has the `pendingResolutions` map this would need.

Two inferences fill in what wasn't typed, and neither ever guesses:

- **Missing variant** → the nest's variants are offered as buttons, unless the
  nest has exactly one, which is assumed silently.
- **Missing nest** → if the variant alias maps to exactly one `nest:variant`
  among *enabled* nests, the nest is inferred. `memo 1 u wep` needs no `ddn`;
  `core u wep` resolves to SDN. `hc u wep` is ambiguous across three nests, so it
  asks.

  **Pure ordinals are excluded from inference.** DDN is the only nest using
  `i`–`iv`, so a bare `1` would otherwise resolve silently to DDN Memoria 1 — a
  stray digit becoming a real quest. Digits and roman numerals are positional
  labels, not names: they identify a variant *once the nest is known* and never
  imply one. `memo 1` still infers, because the alias is `memo 1`, not `1`.

#### Where aliases may and may not collide

Variant words repeat across nests by design — `hc` means HC everywhere — so
uniqueness is scoped, not global:

| Rule | Scope |
| --- | --- |
| Nest aliases unique | across all nests |
| Nest aliases disjoint from rarity / scroll / card-box words | global |
| Two variants sharing an alias | forbidden **within one nest**, fine across nests |
| Nest inference from a variant alias | fires only when unique among enabled nests, and never for a pure ordinal |
| `enabled: false` nests | excluded from parsing, inference, autocomplete and the plan |

A nest aliased `hc` would swallow the variant word and silently mis-parse every
line mentioning it. `_bountyTest.js` asserts the whole rule set (§8) — this is the
class of bug that produces a wrong answer rather than an error, so it has to be a
check rather than a convention.

Rejected: `CharName:` section headers to enter several characters in one paste.
A player holds ~3 good quests across a whole roster per week, so the modal is 1–3
lines and a per-character command is already short. Revisit if boards ever come
back full.

### 2.7 A run tracks characters, the panel tracks users

`activeEvents` keys everything by Discord user id. Bounty needs to know **which
character** joined, because claims are per character and a player has 15.

Resolved at join time, in a `handlers/bounty/resolveChar.js` reached from a single
`if (event.bounty)` branch in `roleSelect.js`:

1. **Stack contributors first** — the joiner's characters holding an unclaimed
   good quest for this exact variant. Exactly one (the common case) auto-picks
   silently.
2. **Otherwise** — their characters with claims left, most claims first.
3. More than one candidate → ephemeral select menu, using the existing
   pending-ephemeral machinery in `state.js`.
4. None at all → they still join; an ephemeral note says they'll earn nothing.

The result lands on the event as `event.users[userId] = { slot, subRole, charName,
questId }`, where `questId` is the quest they contributed, or null.

One player can only field one character per run, which falls out for free —
`event.users` is keyed by user id. That is also a hard constraint on the grouper
(§6.3): a player holding the same quest on three characters cannot stack them
together and genuinely needs three runs.

### 2.8 Two thread surfaces, both lazy

| | Public weekly | Private personal |
| --- | --- | --- |
| Parent | `BOUNTY_CHANNEL_ID` | `BOUNTY_ME_CHANNEL_ID` |
| Type | Public thread | `ChannelType.PrivateThread`, `invitable: false` |
| Created | First bounty activity of the week | First `/bounty-quest` ever, per user |
| Name | `Bounty W1 — 1 Aug 2026` | `Bounty — <display name>` |
| Content | One plain message per completed run | **One message per week, edited in place** |

Both thread id maps live in the existing `state` document — tiny, bounded by
50 users, and persisted by the `saveState()` call that already runs after every
mutation:

```js
bountyThreads     = { [userId]: threadId }    // permanent, per person
bountyWeekThreads = { [weekKey]: threadId }   // one per week
```

**Private threads rather than per-user channels.** Same privacy, but no permission
overwrites to create and maintain, and no pressure on the 500-channel guild limit.
Private threads have needed no server boost since 2022.

Threads auto-archive after 7 days maximum. This is harmless: sending to an
archived-but-unlocked thread revives it, and the Friday reminder touches every
active thread weekly anyway. The writer calls `setArchived(false)` first and
ignores the failure if it was already open — one line, and it removes any
dependence on the auto-revive behaviour. No keep-alive job.

**The public thread never dumps the roster.** At 50 players a full listing blows
past the 2000-character message limit immediately, so it gets one message per
completed run and nothing else. `/bounty-board` re-posts the current summary on
demand.

### 2.9 Rewards are derived, never entered

Bounty Board rewards are visible before you clear, so everything needed is already
captured at input time. One table:

```js
// app/data/bounty.js
const RARITY = {
  unique:         { rank: 3, potion: 1, scroll: 1 },
  legendary:      { rank: 3, potion: 1, scroll: 1 },
  rare_legendary: { rank: 5, potion: 2, scroll: 2 },
};
const rankOf = (q) => RARITY[q.rarity].rank + (q.box ? 1 : 0);
```

| Quest | Rank |
| --- | --- |
| rare legendary | 5 |
| legendary + card box | 4 |
| unique | 3 |
| legendary, no box | 3 |

Legendary without the lvl 60 box pays exactly what unique pays, so it ranks
exactly the same. The `+1` for `box` is written generically rather than special-
cased to legendary — one less branch, and it costs nothing if a box ever appears
elsewhere.

**`rank` is per quest, and a party member's payout is the sum over the stack.**
That sum is `Σ rank`, the guild-side ranking metric of §2.2; dividing by stack
size gives the player-side one. Both fall out of this one table, which is why
there is no second scoring system anywhere in the design.

Rarities below unique parse and store but are never stacked by the matcher. They
aren't worth a run, and excluding them from the data would mean rejecting input
someone deliberately typed.

The reward tally is a read-only sum over stored quests. **Nothing spends it, owes
it, or trades it** — it's a scoreboard, per the PRD's non-goals.

---

## 3. Dependencies

**Zero new ones.** `discord.js` and `mongodb` are already in `package.json`.

| Temptation | Why not |
| --- | --- |
| `node-cron` / `croner` | The Friday reminder is `setInterval` + a window check + a persisted timestamp, copied from `digest.js`. That's 12 lines and it already survives restarts. |
| A knapsack / assignment solver for the 6-claim budget | The budget is 6 units and rows are ranked by value per unit. Greedy is not an approximation here — with a budget this small it *is* the answer, and the player makes the final call anyway. |
| `luxon` / `date-fns-tz` | One fixed offset, no DST (§2.3). |
| A cache layer | The dataset is a module-level array; the week's documents are ~50 small docs. |

---

## 4. Data

### 4.1 Static game data lives in code

`app/data/dungeons.js`, plain CommonJS, edited by commit exactly like
`luckyZone.js` — versioned, reviewable, diffable. A Mongo-backed admin UI for data
that changes once a patch would be pure overhead.

```js
// Shared variant vocabulary — first entry is the default display label.
const VARIANTS = { classic: ["Classic", "classic", "cl"],
                   hc:      ["HC", "hc", "hardcore"], /* … */ };

// One row per nest; variants nested inside. A variant may override the nest's
// capacity, relabel itself, and add nest-scoped aliases.
{ key: "ddn", name: "Dark Dragon Nest", aliases: ["ddn", "dark", "dark dragon"],
  capacity: 8,
  variants: {
    classic: { minHighDps: 2 },
    hc:      { minHighDps: 4 },
    i:       { minHighDps: 3, capacity: 4, label: "Memoria 1",
               aliases: ["memo 1", "memo1"] } },
  enabled: true }
```

**Variants are not uniform within a nest.** DDN Memoria is 4-player while DDN
Classic and HC are 8-player, and Memoria has its own naming. So `capacity`,
`label` and `aliases` are all overridable per variant, with the nest row supplying
defaults. The capacity override is load-bearing rather than cosmetic — it caps
Memoria stacks at 4 quests instead of 6 (§2.1).

Field meanings are in [bounty-prd.md §7](bounty-prd.md). `maxStack` is derived,
never stored (§2.1).

**The addressable unit is `nest:variant`** — `"gdn:hc"` — because a quest names a
specific variant and holders of different variants can't stack. Nests are the
*storage* shape only, to avoid retyping name and aliases six times; every lookup,
pool key and display row flattens to a variant. One `flatten()` at module load
produces the variant list the rest of the code uses, so no caller ever walks the
nested structure.

**There is no subsumption.** Clearing HC does not satisfy a Classic quest, so
there is no `satisfies` list, no variant ordering, and no cross-variant matching
anywhere. Recorded because "harder difficulty counts for easier" is a common
enough game convention that someone will eventually assume it holds here.

### 4.2 User data in Mongo

Two collections, both using the fire-and-forget `replaceOne` + `upsert: true`
pattern already established by `recordSalaryPaid` in
[`app/state.js:70`](../app/state.js) — errors logged and swallowed.

```js
// collection: chars — SHARED with the activity planner, see §2.4
{ _id: userId, chars: [{ name, job, dpsTier }] }

// collection: bountyWeek — one document per user per week
{ _id: `${userId}:${weekKey}`,
  owners: [userId],            // array, not a scalar — see below
  weekKey,                     // indexed; the whole week is one find()
  chars: {
    [charName]: {
      board:  [{ id, dungeon, rarity, scroll, box, runId }],  // own quests; runId ⇒ contributed
      shares: [{ dungeon, rarity, scroll, box, runId }],      // received from a stack
    },
  },
  threadMsgId }                // the message edited in the private thread
```

One completed run writes **`stackSize` entries per party member**, not one — a
member's own contributed quest gets `runId` set on its `board` row, and every
other quest in the stack lands in `shares`. That is the only shape consequence of
Model Y, and it's why `shares` was an array from the start.

**There is no claim counter.** The count is derivable, so it cannot drift out of
sync with the thing it counts:

```js
const claimsUsed = (c) => c.board.filter((q) => q.runId).length + c.shares.length;
const claimsLeft = (c) => Math.max(0, WEEKLY_CLAIMS - claimsUsed(c));
```

**`owners` is an array from day one** even though v1 only ever puts one id in it.
That is the entire storage change `/bounty-link` needs (PRD §8), so shipping it
now means the deferred feature migrates no documents later. It costs two
characters of JSON.

`bountyWeek` grows by one small document per active user per week and is never
read after its week passes. At 50 users that's a rounding error next to the
existing `salaryLog`; if it ever matters, a TTL index on an added `createdAt`
retires old weeks with no application code.

### 4.3 State-document additions

```js
bountyThreads, bountyWeekThreads,   // §2.8
bountyReminderLastSent              // Friday reminder, same shape as digestLastSent
```

`saveState()` gains these three keys in its `replaceOne`. Nothing else in
`state.js` changes.

### 4.4 What is not persisted

The plan. It's derived from `dungeons.js` plus one `find({ weekKey })` in a few
milliseconds, so it's recomputed per interaction rather than cached in
`activeEvents`-style state. Nothing to invalidate.

---

## 5. Discord is the actual constraint

| Limit | Value | Consequence |
| --- | --- | --- |
| Select menu options | 25 | Variant selection blows past 25 immediately → **autocomplete instead** |
| Autocomplete suggestions | 25 shown, filtered from any size | How `/bounty-run`, `/bounty-need`, `/bounty-quest character:` all pick |
| Modal text inputs | 5 | Quest paste is one paragraph input — no pressure |
| Message content | 2000 chars | Public thread posts one run per message, never a roster (§2.8) |
| Embed description | 4096 chars | `/bounty-plan` is 2 lines per variant, and variants outnumber nests several-fold — so the list is **capped at the top 15 rows**, with `/bounty-need` for the rest. Not optional once variants exist |
| Buttons per row / rows | 5 / 5 | Role rows already paginate in `createButtons` |
| Private thread boost req. | none since 2022 | §2.8 is free |
| Thread auto-archive | 7 days max | Posting un-archives; no keep-alive job (§2.8) |

The one real consequence: **every variant picker is autocomplete, never a select
menu.** Once nests are flattened by variant the list is comfortably past 25 rows,
and a select menu would silently truncate — dropping real content with no error.
Autocomplete filters from an unbounded list and only ever *displays* 25.

---

## 6. Runtime shape

### 6.1 Commands

| Command | Behaviour |
| --- | --- |
| `/bounty-char add\|edit\|list\|remove` | Upsert into the shared `chars` document (§2.4) |
| `/bounty-quest character:<autocomplete> [replace]` | Opens the paste modal for that character. The confirmation carries a character select so the next character is one click, not a retyped command. `replace:true` swaps that character's **unclaimed** quests — claimed ones are history and survive it, and a paste where nothing parsed replaces nothing |
| `/bounty-me` | Ephemeral: quests, claims left, reward tally |
| `/bounty-plan` | Ephemeral: dungeons ranked, §6.3 |
| `/bounty-need dungeon:<autocomplete>` | Ephemeral: stack contributors + who has claims to spare |
| `/bounty-run dungeon:<autocomplete>` | Creates the signup event, §6.4 |
| `/bounty-board` | Posts/refreshes the weekly public summary |

`/bounty-char add` uses slash options rather than a modal — three fields, and it
matches the planner's `/char-add`.

### 6.2 File layout

No new patterns. Handlers follow the existing structure exactly:

```
app/data/dungeons.js          master data
app/data/bounty.js            RARITY table, constants, rankOf()
app/bounty.js                 pure logic: weekKey, parser, stack builder, renderers
app/handlers/commands/bounty*.js
app/handlers/modals/bountyQuest.js
app/handlers/selectMenus/bounty/       character picker
app/handlers/bounty/resolveChar.js     §2.7
app/handlers/bounty/finishRun.js       §6.5
app/bountyReminder.js         Friday ping, on the digest.js pattern
app/_bountyTest.js            §8
```

`app/bounty.js` holds every pure function — no Discord objects, no Mongo — so the
whole matcher is testable with plain `node`, exactly like `app/planner.js`.

Two shared files get a branch and nothing more: `roleSelect.js` (§2.7) and
`doneRun.js` (§6.5). Two builders get a conditional (§2.5).

### 6.3 The matcher

Input: `find({ weekKey })` over `bountyWeek`, plus `dungeons.js`.

**Step 1 — candidate quests per variant**, unclaimed and `rank ≥ 3`. The pool key
is `nest:variant`, so `gdn:cl` and `gdn:hc` are separate pools that never mix:

```js
pool["gdn:hc"] = [{ userId, charName, questId, rank, rarity, scroll, box, dpsTier }]
```

**Step 2 — build stacks.** Greedy, highest rank first, one character per player
per run (§2.7). Quests that don't fit spill into the next run for that variant:

```js
function buildStacks(pool, variant) {
  const cap = maxStack(variant);
  const stacks = [];
  let rest = [...pool].sort((a, b) => b.rank - a.rank);
  while (rest.length) {
    const stack = [], taken = new Set();
    rest = rest.filter((q) => {
      if (stack.length >= cap || taken.has(q.userId)) return true;  // defer to next run
      stack.push(q); taken.add(q.userId); return false;
    });
    stacks.push(stack);
  }
  return stacks;
}
```

Highest rank first means the best quests land in the **first** stack — the run most
likely to actually happen.

**Step 3 — score each stack:**

```js
const value   = stack.reduce((s, q) => s + q.rank, 0);   // reward per party member
const cost    = stack.length;                            // claims per party member
const quality = value / cost;                            // average rank per claim
```

**Step 4 — rank variants by `value`, print `quality` on every row.** §2.2 is the
argument for showing both; the code does not blend them. Rows are variants, so
`Dark Dragon Nest HC` and `Dark Dragon Nest I` compete independently.

**Step 5 — seats and advisories:**

```js
seatsOpen  = variant.capacity - stack.length
highDpsGap = max(0, variant.minHighDps - stack.filter(q => q.dpsTier === "high").length)
fillerPool = characters with claimsLeft >= cost, owner not already in the stack
```

`highDpsGap` prints `needs 2 more high DPS`. It is **advisory, never a gate** — it
does not reorder the plan, block a run, or stop anyone joining. Same "state the
reason, let the human decide" pattern the planner uses for its reset warning.

`fillerPool` is filtered by `claimsLeft >= cost` because a filler short on claims
wastes the difference (§2.1) — they're still allowed to join, they're just not
*recommended* into a seat that will burn value.

It also returns **one entry per player, not per character.** A player fields one
character per run, so listing all 15 of theirs would bury the list; the best one
is kept, ranked by DPS tier first (that's what closes a `highDpsGap`) then by
claims left. And it reads the **whole** `chars` collection rather than just the
week's quest documents — a character who entered no quests still holds all 6
claims and is precisely who should be taking a seat.

### 6.4 Creating and joining a run

`/bounty-run` calls `createEvent()` with a new `bounty` template — `GDN_ROLES`,
`noThread: true`, `stackRoles: true`, `maxSlot: variant.capacity` — and attaches:

```js
event.bounty = { poolKey, weekKey }     // poolKey = "gdn:hc"
```

`labelOverride` on `createEvent()` carries the variant name into the title, so the
panel reads `Bounty — Green Dragon Nest HC` and nobody joins the wrong difficulty.

That one field is what every branch in `roleSelect.js`, `doneRun.js` and the
builders tests for. The stack itself is **not** copied onto the event: it's
derived from `event.users[*].questId` on every render, so it can't go stale when
someone joins or leaves.

The embed gains a bounty block above the role lines: the stacked quests, current
depth, what each member pays and receives, seats open, and the `highDpsGap`
advisory.

**On join, if `claimsLeft < stack.length`, the joiner gets a loud ephemeral
warning** naming how many claims they'd waste — and joins anyway if they want.
The warning re-evaluates as the stack grows, so someone who joined a 2-stack that
became a 4-stack is warned on the next render rather than silently overcommitted.

### 6.5 Finishing a run

`doneRun.js` gets an early `if (event.bounty) return finishBountyRun(...)`, ahead
of all forum-thread and loot-panel logic. The stack is derived once, then for
**each** user in `event.users`, for **each** quest in the stack:

1. The user's own contributed quest → set `runId` on that `board` row.
2. Every other quest in the stack → push a `shares` entry.
3. If the character has fewer claims left than the stack is deep, record only the
   highest-ranked `claimsLeft` of them and name the shortfall in the summary.

Then, in order: edit the signup message into a reward summary; post one plain
message to the public weekly thread; edit each participant's private-thread
message; `delete activeEvents[messageId]`; `saveState()`.

Deleting before saving mirrors `closeLoot.js` — a finished run is never left in
MongoDB.

### 6.6 Language

English, on the same principle as the planner: **simple English, one word per
concept, no synonyms.** Readers are Indonesian speakers, and consistent vocabulary
helps a non-native reader more than good translation does. Dates use `id-ID`
formatting via `toLocaleDateString`, as everywhere else in the bot.

No i18n layer, no locale files. Strings stay inline in their handlers, matching
house style.

| Use | Never |
| --- | --- |
| `quest` | mission, bounty quest, task |
| `board` | bounty board, quest list |
| `nest` | dungeon (when a nest is meant), instance |
| `variant` | difficulty, mode, tier, stage |
| `stack` | share pool, group, chain |
| `claim` (verb and noun) | complete, turn in, redeem |
| `claims left` | remaining claims, quota |
| `run` | clear (as a verb), do |
| `seat` | slot, spot |
| `weekly reset` | reset day, rollover |
| `card box` | box lvl 60, cardbox |
| `scroll` | scroll item |
| `Potion Engrave` | potion, engrave potion |
| `high DPS` / `good DPS` / `low DPS` | DPS tier names other than these three |
| `character` | char, toon, alt |
| `job` | class |

Adding a term to a string means adding it here first.

Note what is *absent*: there is no user-facing word for "holder" or "filler". Under
§2.1 everyone in the party pays the same and receives the same, so a vocabulary
that splits the party into two classes would describe a distinction the mechanic
doesn't have. Internally the code says `contributor` for someone whose quest is in
the stack; no string does.

---

## 7. Not built, and when to build it

| Deferred | Build it when |
| --- | --- |
| `/bounty-link` alt-account sharing | v1.1. Storage already supports it (§4.2) — it needs the DM consent flow, not a migration |
| Whole-week claim optimisation across all runs | Evidence people want it. Ranking by rank-per-claim (§2.2) gets most of the benefit with none of the machinery, and the player decides anyway |
| Scheduling runs in time | Player availability is modelled, which it isn't and probably shouldn't be |
| Bounty Order reroll advice | Never asked for; it's a solo decision |
| Auto role assignment | Evidence that manual role buttons aren't enough |
| Bounty scrolls priced against the loot panel | Someone wants bounty and loot income in one view |
| Stat-derived `dpsTier` | Never here — §2.4 |

---

## 8. Verification

Repo convention is a standalone assert script run with plain `node`, matching the
existing `app/_*Test.js` files. One file, covering what would otherwise break
silently:

```bash
node app/_bountyTest.js
```

1. **Week boundary** — Saturday 07:59 WIB and 08:00 WIB produce different keys
2. **Week label** — August 2026 resets (1, 8, 15, 22, 29) map to W1…W5; a week
   spanning into September keeps its August label
3. **Parser** — token order doesn't matter; `box` is optional; a line missing its
   variant asks rather than guessing, except where the nest has exactly one
3b. **Multi-word aliases** — `memo 1 u wep` resolves to `ddn:i` with no nest
   token; `rare legendary` parses as one rarity; the longest phrase wins, so
   `memo 1` is never shredded into the bare `1` alias for variant `i`
4. **Alias rule set** — nest aliases unique across nests and disjoint from
   rarity/scroll/card-box words; no two variants of one nest share an alias; every
   variant key used by a nest exists in `VARIANTS`. This is the guard against a
   typo silently routing a week of quests to the wrong nest or difficulty — the
   failure mode is a wrong answer, not an error, so it has to be a check
4b. **Inference guards** — a bare `1` or `iii` never infers a nest, while
   `core`, `mutant` and `memo 1` do; a disabled nest is invisible to parsing,
   inference, autocomplete and the plan
5. **Pool keys never mix variants** — `gdn:cl` and `gdn:hc` quests never land in
   the same stack, and clearing HC leaves a Classic quest unclaimed (no
   subsumption, §4.1)
6. **Rank table** — rare legendary > legendary+box > unique = legendary
7. **`maxStack`** — 4-capacity caps the stack at 4, 8-capacity at 6; a variant's
   own `capacity` overrides the nest default, so DDN Memoria caps at 4 while DDN
   HC on the same nest row caps at 6
8. **Stack builder** — never puts two characters of the same player in one stack;
   a player holding the same quest on 3 characters produces 3 stacks
9. **Stack builder** — 14 candidates at an 8-capacity variant produce stacks of
   6, 6, 2
10. **Scoring** — `value` = Σ rank, `cost` = depth, `quality` = value ÷ cost; a
    2-stack of legendary+box out-qualities a 4-stack of uniques while ranking
    below it on `value` (the exact case §2.2 exists to keep visible)
11. **`claimsUsed`** — one finished run adds `stackSize` entries per member, not
    one; `claimsLeft` never goes negative
12. **Cap behaviour** — a character with 2 claims left in a 4-stack records the
    2 highest-ranked quests and reports 2 wasted
13. **Reward tally** — sums potions and scrolls per category across board and
    shares
14. **`stackRoles`** — 8 characters can take the same role; `maxSlot` still caps
    the party at 8

The script prints a sample plan afterwards, which is also the fastest way to see a
rendering change without deploying.
