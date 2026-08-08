# PRD — group bounty

What the feature does and why. Technical design is in [bounty-arch.md](bounty-arch.md).

Unrelated to the activity planner on `feature/daily-planner`. The two features
share one thing — the character roster — and that overlap is handled in
[bounty-arch.md §2.4](bounty-arch.md).

---

## 1. Problem

**Group Bounty** is a weekly quest system in Dragon Nest Classic. Each character
gets a **Bounty Board with exactly 6 quests** and may **claim 6 times per week**.
Quests carry a rarity — magic, rare, epic, unique, legendary, rare legendary — and
only **unique and above** is worth a run:

| Rarity | Payout per claim |
| --- | --- |
| unique | 1 Potion Engrave + 1 scroll (Weapon / W-T-D / Accessory / Armor) |
| legendary | same, plus extras — **only the lvl 60 card box is worth anything** |
| rare legendary | 2 Potion Engrave + 2 scrolls |

### The mechanic everything hangs on

**Shared Bounty.** Inside a party, holders share their quests *for the same
dungeon* into a **stack**. Clearing that dungeon **once** completes every quest in
the stack — **for every party member**, holder or not. Each member spends one
claim per stacked quest and receives every stacked quest's reward.

The arithmetic is the whole feature:

> Four players hold a unique DDN quest each. They party up with four more who hold
> nothing, and clear DDN once. **All eight** walk away with 4 Potion Engraves and
> 4 scrolls, having spent 4 of their 6 claims.
>
> Alone, those same 4 claims cost 4 separate clears and pay one person.

So stacking doesn't make claims cheaper — a claim is a claim. **It collapses the
number of dungeon clears needed to spend them, and it pays everyone in the room.**
That is the entire reason to coordinate, and the reason a bot is worth building.

Three things stop it from happening today:

1. **Nobody knows who holds what.** Good quests are rare — a player holds roughly
   3 unique+ across their whole roster in a given week. Finding others holding the
   *same dungeon's* quest is guesswork in chat, and two characters on the same
   game account can't stack together — you're only logged into one at a time.
2. **Stacks stay shallow.** Without knowing who else is holding, runs happen at
   1–2 deep when 4 was available — the same rewards for four times the clears.
3. **Claims expire.** Saturday 08:00 WIB, anything unspent is gone. Most people
   finish the week with claims left because they ran out of runs to join, not out
   of quests.

The question a member asks is:

> *I pulled a legendary DDN quest. Who else has DDN, and who's got claims left to
> fill the party?*

Nothing in the bot answers that.

## 2. Users

Guild members of the existing `raid-gdn` server — the same people already using
`/raid` and the loot panel. **10–25 players today, sized to 50.** A player runs
**14–15 characters** but holds only ~3 unique+ quests across all of them in a
given week.

Assume a competent player. The bot is a **matcher and a claim ledger**, not a
tutorial. It never explains what Group Bounty is.

Strings are **English**, matching the signup panel and loot panel that already say
"Host", "Party FULL", "Cancel My Role". Dates keep `id-ID` formatting, as
everywhere else in the bot.

## 3. What already exists

The feature is mostly assembly. Reused as-is:

| Piece | Reused for |
| --- | --- |
| `/raid` signup panel, role buttons, lock/done/ping | The bounty run panel — same buttons, one template change ([arch §2.5](bounty-arch.md)) |
| `app/handlers/commands/_createEvent.js` | Creating a bounty run |
| `activeEvents` + `saveState()` in `app/state.js` | Run lifecycle and restart survival |
| `app/utils/parseItems.js` token style + `closest()` fuzzy matcher | Quest input ([arch §2.6](bounty-arch.md)) |
| `app/digest.js` Saturday 08:00 WIB window check | The Friday reminder |
| `handlers/buttons/loot/resolveItems.js` candidate-picker pattern | "did you mean this dungeon?" |

New: dungeon master data, quest and claim storage, the stack matcher, two thread
surfaces.

## 4. The core product decision

**The bot assembles the deepest stack of good quests it can find for one dungeon,
then tells everyone with claims left to get in the party.**

Two facts drive that:

- **Quality sets value per claim.** A rare legendary is worth more than a unique
  whether it's stacked with five others or run alone. Depth doesn't change it.
- **Depth sets the time cost.** A 4-stack delivers in one clear what four 1-stacks
  deliver in four. Real-world time is what stacking actually buys.

So the bot optimizes for **reward delivered per dungeon clear**, and separately
helps each player ration their 6 claims toward the best quests on offer.

Everything else in this document is bookkeeping in service of that.

**Realistically stacks will be 2–4 deep, not 6.** At 25 players holding ~3 good
quests each, spread across ~20 dungeons, and with one character per game account
per party, a full 6-stack is a jackpot rather than a target — though a character
holding two quests for the same variant now contributes both. A 3-stack is a good
week.
The bot is judged on turning 1-deep runs into 3-deep ones, not on hitting the cap.

## 5. v1 scope

### 5.1 User stories

- As a player, I register a character once with its job and DPS tier, so the bot
  can tell whether a proposed party can actually clear.
- As a player, I type my good quests for the week in one paste, and never touch
  the low-rarity ones I'm going to ignore anyway.
- As a player, I ask what's worth forming a party for and see which dungeons have
  the deepest stack of good quests behind them.
- As a player who pulled a legendary, I open a signup for it and the bot shows me
  who else can stack onto it and how many seats are still open.
- As a player with claims left and no good quests, I find out which runs need
  bodies — because I get paid exactly what the holders get paid.
- As a player, I'm warned before joining a stack deeper than my claims left, so I
  don't waste the difference.
- As a host, I close a run and every participant's claims are recorded without
  anyone typing anything.
- As a player, I have one private place that always shows my quests, my claims
  left, and what I've earned.

### 5.2 Commands

| Command | Purpose |
| --- | --- |
| `/bounty-char add\|edit\|list\|remove` | Character roster — name, job, DPS tier |
| `/bounty-quest character:<name>` | Paste this week's good quests for that character |
| `/bounty-me` | My characters, quests, claims left, rewards so far |
| `/bounty-plan` | Dungeons ranked by the stack they'd deliver |
| `/bounty-need dungeon:<name>` | Who can stack here, who has claims to spare |
| `/bounty-run dungeon:<name>` | Open a signup panel for a bounty run |
| `/bounty-board` | Post or refresh the weekly public checklist |

`/bounty-link` is **v1.1** — see §8.

### 5.3 Quest input

One modal, one paste, one line per quest. Order within a line doesn't matter:

```
ddn hc u wep
gdn cl leg acc box
tkn hell rl wtd
```

→ nest, variant, rarity, scroll category, and `box` when a lvl 60 card box is on
it. An unrecognised nest comes back with the five closest matches as buttons,
exactly like the loot panel's unresolved-item flow.

**The variant is part of the quest, not decoration.** A board names "GDN Classic",
never just "GDN", and two people holding different variants of the same nest
cannot stack — they're different clears. Omit the variant and the bot asks which
one, unless the nest only has a single variant, in which case it's assumed.

Only unique+ is expected. Lower rarities are accepted but never stacked by the
bot — which is a feature: **every stack the bot proposes is made of good quests
only.** People can still share junk in-game; the bot just won't plan around it.

**Nothing is entered after a run.** Rewards are visible on the Bounty Board before
you clear, so the payout is derived entirely from what was typed at input time.

### 5.4 The plan output

`/bounty-plan` ranks dungeons by the total reward one clear would deliver to each
party member:

```
1. Dark Dragon Nest HC — stack 4 · costs 4 claims · 4 seats open
   1× rare legendary, 3× unique     avg 3.5/claim
2. Green Dragon Nest Classic — stack 2 · costs 2 claims · 6 seats open
   2× legendary + box               avg 4.0/claim · needs 2 more high DPS
...
You have 6 claims left. 28 characters guild-wide still have claims.
```

Every row is a **variant**, never a nest — `Dark Dragon Nest HC` and
`Dark Dragon Nest I` are separate rows competing on their own merits, because
they're separate clears with separate stacks.

Both numbers are shown on purpose. **Stack depth** is what the guild optimizes —
it's reward per clear. **Average rank per claim** is what an individual optimizes
when rationing a 6-claim budget. A player with 2 claims left should take row 2
over row 1, and the display has to make that visible rather than hiding it behind
a single ranking.

`/bounty-need <dungeon>` drills into one row and names the characters.

The plan **groups, it does not schedule.** A player runs one character at a time,
so any real timetable depends on who's online — which the bot doesn't know and
isn't going to ask. Ordering the evening is left to humans.

### 5.5 The bounty run panel

`/bounty-run <dungeon>` opens the existing raid signup with these differences:

- **Role caps are off.** Roles label who's coming; they never block. You cannot
  turn away someone who can deepen the stack because "DPS is full".
- **The embed shows the stack** — which quests are in it, current depth, and
  therefore what each member pays and receives.
- **Joining warns you if the stack is deeper than your claims left.** A member
  with 2 claims joining a 4-stack wastes 2. The warning is loud and it still lets
  them join; it's their call.
- **A "needs" advisory** for composition: `Missing: Healer, MC · needs 1 more high
  DPS`. Advisory only — it never blocks a join.
- **Done records claims.** Every party member gets every stacked quest recorded
  and spends that many claims.

The run is thread-less. On Done the signup message is edited into a summary of
what the party earned, then the event is dropped from `activeEvents`.

### 5.5b Party formation — options under discussion

The signup built in phase 5 works but reads as machinery to anyone who wasn't in
its design. Options for replacing it are collected here; none is chosen yet.

#### Idea 1 — locked channel, one board, role-slot assignment

A channel where members cannot type. The host posts one board message carrying a
control per raid (`CL` = GDN Classic, `H` = GDN HC to start — two only, not all
20 variants). A member picks the control for a quest they hold and supplies just
**role + scroll category** — nothing else, because the board already says which
nest and variant.

The bot then answers with a **recommended party in raid layout**, re-rendered on
every new entry:

```
Susunan rekomendasi party — GDN Classic
DPS   @bazul   (Legendary — Weapon)
FU    @Ol      (Unique — Weapon)
SM    @Azka    (Legendary — WTD)
…
```

Rules the host stated:

- **Party layout is fixed, same as `/raid`.** People are assigned to role slots,
  not listed flat.
- **6 holders per party max**, so 8 entries split 6 + 2 across two parties.
- **On a role collision**, only `EL`/`Acro` are treated as droppable — the
  displaced player takes a slot as **same job but high DPS**, or as plain **DPS**.
  That is why DPS carries 3 slots.

What it buys: no command to learn, no dungeon alias to type, no `/bounty-plan` to
read. One click and two fields.

What it drops, and what still needs deciding, is in §5.5c.

### 5.5c Open questions on Idea 1

1. **Rarity** — the description says role + scroll only, but the sample output
   shows `(Legendary — Weapon)`. Is rarity entered too, or inferred?
2. **Characters** — the sketch is one entry per *person*. A player runs 14-15
   characters and may hold a GDN CL quest on three of them. One entry each, or
   one per person?
3. **Claims** — per-character claim tracking (§1) needs a character to attach to.
   If entries are per person, the 6-claim budget has nothing to count against.
4. **Role source** — `role` already lives on the character (§5.2). If the entry
   is per character, the bot knows the role and the member only types rarity +
   scroll.
5. **Scale** — two controls work for two raids. 20 variants do not fit one board;
   likely one board per nest, or controls only for variants people hold.

### 5.6 The two thread surfaces

| Surface | Where | Lifetime |
| --- | --- | --- |
| **Public weekly checklist** | A new thread per week in `BOUNTY_CHANNEL_ID`, named `Bounty W1 — 1 Aug 2026` | One per week, browsable forever |
| **Private personal view** | One private thread per person in `BOUNTY_ME_CHANNEL_ID` | Created once, reused forever |

The public thread gets a plain-text message per completed run — never a full
roster dump, which wouldn't fit a message anyway.

The private thread holds **one message per week per person**, edited in place as
they add quests and finish runs, always showing claims left. It's created the
first time someone uses `/bounty-quest` and reused every week after. Private
threads rather than per-user channels: same privacy, no permission overwrites to
maintain, and no pressure on the 500-channel guild limit at 50 users.

### 5.7 Friday reminder

One ping before reset, naming **claims left** rather than quests — under Model Y
an unspent claim is the thing that actually expires, and someone with 4 claims and
no good quests can still gain 4 rewards by filling a seat. Same `setInterval` +
window-check + persisted-timestamp pattern as the existing digests, behind its own
env kill switch.

### 5.8 Explicitly out of v1

| Not building | Build it when |
| --- | --- |
| Bounty Order reroll advice | Never asked for — it's a solo decision |
| Scheduling / time slots | Player availability is modelled, which it isn't |
| Optimising a player's 6 claims across the whole week | Evidence people want it. Ranking each run by rank-per-claim already gets most of the benefit for none of the machinery |
| Auto role assignment in a party | Evidence that manual role buttons aren't enough |
| Linking bounty scrolls to loot-panel prices | Someone wants bounty and loot income in one view |
| Rarities below unique influencing anything | Never — they're not worth a run |

## 6. Non-goals

- **Not a scheduler.** It groups people; it doesn't decide when they play.
- **Not authoritative.** The bot cannot read the game. Every quest and every claim
  is what someone told it.
- **Not a replacement for `/raid`.** Bounty runs are their own panel; the Saturday
  raid schedule is untouched.
- **Not a reward economy.** Reward tracking is a read-only tally. Nothing spends,
  trades, or is owed off the back of it.

## 7. Data you still owe

**This is the only thing blocking implementation.** One file,
`app/data/dungeons.js`, plain CommonJS, edited by commit like `luckyZone.js`.

### 7.1 The unit is a variant, not a nest

A quest names "GDN Classic", never "GDN". Holders of different variants **cannot
stack** — different clears — and **clearing a harder variant does not satisfy an
easier one's quest.** Every variant stands completely alone.

So the thing the matcher pools on is the pair `nest:variant` (`gdn:hc`). Nests are
written as one row with variants nested inside, so the name and aliases are typed
once rather than once per variant.

### 7.2 Fields

Per nest:

| Field | Meaning | Example |
| --- | --- | --- |
| `key` | Stable id, never displayed. Half of the storage key | `"ddn"` |
| `name` | Display name | `"Dark Dragon Nest"` |
| `aliases` | **What people actually type.** Multi-word is fine — `"dark dragon"` works | `["ddn", "dark", "dark dragon"]` |
| `capacity` | Default party size for every variant, `4` or `8` | `8` |
| `variants` | The variants that can appear as bounty quests | see below |
| `enabled` | Hide the whole nest without deleting it | `true` |

Per variant, keyed by a name from the shared `VARIANTS` vocabulary:

| Field | Meaning | Example |
| --- | --- | --- |
| `minHighDps` | How many **high-tier** characters this variant needs to clear | `2`–`4` |
| `capacity` | Optional — only when this variant differs from the nest default | `4` |
| `label` | Optional — when a nest names its variants its own way | `"Memoria 1"` |
| `aliases` | Optional — extra words for this variant, scoped to this nest | `["memo 1", "memo1"]` |

**Variants are not uniform within a nest.** DDN Memoria is 4-player while DDN
Classic and HC are 8-player, and it has its own naming — so it overrides
`capacity`, `label` and `aliases` all three. The capacity override matters: it
caps Memoria stacks at 4 quests instead of 6.

`maxStack` is derived, never stored: `min(capacity, 6)`. A 4-capacity nest stacks
at most 4 quests, because only 4 people can be in the party to share them.

### 7.3 What to be careful about

**`aliases` is the highest-leverage field**, and the only one with a correctness
trap. Nest aliases must be unique across all nests and must not collide with a
rarity, scroll or card-box word — a nest aliased `hc` would swallow the variant
token. Variant aliases are looser: they repeat across nests on purpose (`hc` means
HC everywhere) and only have to be unique *within* a nest. The reserved list is in
the file header and `_bountyTest.js` asserts the whole rule set, so a collision
fails a check instead of quietly routing a week of quests to the wrong nest.

**Write aliases the way people speak, including phrases.** `"memo 1"`,
`"dark dragon"` and `"rare legendary"` all work — the parser collapses known
phrases before matching, longest first.

**A variant alias unique guild-wide also identifies its nest.** Since `"memo 1"`
means DDN I and nothing else, `memo 1 u wep` parses with no `ddn` on the line.
Ambiguous ones like `hc` still ask.

**The shared variant vocabulary comes free**, so TKN, PKN and ABN all get `hell`
and `challenge` without aliases of their own. Only add to `VARIANTS` when a
genuinely new variant *name* appears; a nest calling an existing variant something
different wants `label` + `aliases` instead, the way Memoria does.

**`minHighDps` counts gear tier, not role** — a high-tier off-role out-damages a
weak DPS-role character, so a role census would answer the wrong question.

**`type` was dropped.** It was display grouping that nothing read; with variants
to fill in, a dead field isn't worth your typing.

The list will run long once variants are counted, which is fine — every picker
uses slash-command autocomplete, not a dropdown ([arch §5](bounty-arch.md)).

## 8. Roadmap

**No phase is built before its data exists.**

| Phase | Contents | Status |
| --- | --- | --- |
| 1 | `app/data/dungeons.js` | ⏳ **Blocked on §7** |
| 2 | Roster — `/bounty-char`, week key, storage | v1 |
| 3 | Quest input — `/bounty-quest`, parser, `/bounty-me` | v1 |
| 4 | Matcher — `/bounty-plan`, `/bounty-need` | v1 |
| 5 | Runs — `/bounty-run`, stack-aware panel, Done → claims | v1 |
| 6 | Threads — public weekly, private personal, `/bounty-board` | v1 |
| 7 | Friday reminder | v1 |
| 8 | `/bounty-link` — alt-account sharing, DM confirmation | **v1.1** |

Phases 2–7 ship together. A roster with no quests and a matcher with no runs are
each useless alone.

`/bounty-link` is deferred rather than dropped: a player with two Discord accounts
shares one roster. The flow is `/bounty-link @other` → the bot **DMs the target
for confirmation** → on accept, both accounts control the same characters. Consent
is the whole feature, so it isn't worth rushing into v1. The storage shape in
[arch §4.2](bounty-arch.md) already carries an owner list rather than a single
owner id, so adding it later touches no existing documents.

## 9. Success criteria

v1 works if, after a few weeks:

1. **Stacks get deeper.** Runs that used to happen at 1–2 quests happen at 3–4.
   This is the headline number — it's reward per clear.
2. **Claims stop expiring.** People finish the week at 0 claims left instead of 3,
   because the bot told them where the open seats were.
3. **Nobody asks "who has DDN?" in chat** — they run `/bounty-need`.
4. **The private thread is read.** It's the cheapest surface to maintain and the
   one that tells a player whether their week is done.

It has failed if people enter quests and then form parties in chat anyway — which
would mean the matcher's output isn't trusted or isn't visible where the
conversation happens.

## 10. Known weaknesses

Stated up front so they aren't discovered as surprises:

- **Manual entry is the weak link.** The bot cannot read the game. A quest not
  typed in doesn't exist, and a run closed without pressing Done leaves claims
  wrong until someone fixes them.
- **Claims are trusted, not enforced.** If someone claims outside a bot-tracked
  run, their remaining count is wrong until they say so. This matters more under
  Model Y than it would have otherwise: claims left gates the warning on every
  join, so a wrong count produces wrong advice rather than just a wrong tally.
- **What happens at the cap is assumed.** A member with 2 claims left joining a
  4-stack is modelled as completing 2 and wasting 2. If the game instead blocks
  the join, or completes all 4 anyway, the warning text is wrong — the behaviour
  isn't, since the bot warns and then lets them decide either way.
- **A player can only field one character per run.** The matcher enforces it, but
  it means a player holding the same quest on three characters cannot stack them
  together, and no amount of grouping avoids that.
- **A full 6-stack will be rare.** See §4 — the honest target is 3.
