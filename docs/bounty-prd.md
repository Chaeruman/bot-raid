# PRD — group bounty

What the feature does and why. Technical design is in [bounty-arch.md](bounty-arch.md).

---

## 1. Problem

**Group Bounty** is a weekly quest system in Dragon Nest Classic. Each character
gets a **Bounty Board with exactly 6 quests** and may **claim 6 times per week**.
Only **unique and above** is worth a run:

| Rarity | Payout per claim |
| --- | --- |
| unique | 1 Potion Engrave + 1 scroll (Weapon / W-T-D / Accessory / Armor) |
| legendary | same, plus extras — **only the lvl 60 card box is worth anything** |
| rare legendary | 2 Potion Engrave + 2 scrolls |

### The mechanic everything hangs on

**Shared Bounty.** Inside a party, holders share their quests *for the same
dungeon* into a **stack**. Clearing that dungeon **once** completes every quest
in the stack — **for every party member**, holder or not. Each member spends one
claim per stacked quest and receives every stacked quest's reward.

> Four players hold a unique DDN quest each. They party with four who hold
> nothing and clear DDN once. **All eight** leave with 4 Potion Engraves and 4
> scrolls, having spent 4 of their 6 claims.

So stacking doesn't make claims cheaper — **it collapses how many clears you need
to spend them, and it pays everyone in the room.**

What stops that happening: nobody knows who holds what. A player holds roughly 3
unique+ across a whole roster, and finding others with the *same variant's* quest
is guesswork in chat.

## 2. Users

Guild members of the existing `raid-gdn` server. **10–25 players today, sized to
50.** A player runs 14–15 characters but holds ~3 unique+ quests in a week.

Strings are Indonesian for bounty surfaces, English for the raid panels they sit
on. Dates keep `id-ID` formatting.

## 3. What it actually is

**A noticeboard plus a bounty-aware signup panel.** There is no matcher, no
planner, no separate bounty run — those were built and deleted (see §7).

```
/bounty-char add     once           name, role, DPS tier, game account
/bounty              Saturday       paste this week's quests, per character
/bounty-me           any time       my quests, claims left, rewards
```

Everything else is the board and the buttons already on `/raid`.

## 4. The three surfaces

### 4.1 The weekly board — `#bounty-board`

One message, posted at reset, edited all week, deleted and replaced at the next
reset. **Read-only: no buttons, no menus.**

```
📋 BOUNTY BOARD
Most Wanted Dungeon
Green Dragon Nest Classic — 4 bounty
@Chaeruman
　• Chelssea (2 quest) — Rare Legendary + card box · Weapon | Legendary · Weapon
　• Bolabola — Unique · Weapon
@Bazul
　• healcok — Unique · W/T/D

Dungeon Lainnya
Desert Dragon Nest Memoria 1 — 1 bounty
…
minggu ke-1 Agustus 2026
```

Grouped by **player**, then by character — one person with three characters is
one block, not three lines repeating a mention. A character holding two quests
for one nest is **one line**, because clearing once completes both.

### 4.2 The signup panel — bounty-aware

`/raid`, `/start`, `/marathon`, `/memo`, `/nest` take an optional
**`closed_to_bounty`**.

**Open (default).** Role buttons as always. Clicking one asks which character you
brought, but only if you hold quests here on more than one — otherwise it seats
you silently.

**Bounty-only.** Nine role buttons collapse to one `🎯 Join party (bounty)`. The
character you pick decides the slot, per-role caps come off, and only people who
recorded a bounty **this week** may take a seat — including the filler seats,
since a member without the quest still gets paid. A host-only toggle flips a
panel between the two modes live.

Either way the panel shows what is stacked:

```
🎯 Stack 3/6 · khusus bounty
```

### 4.3 Marking done

**Closing the run is the only thing that marks a quest claimed.** The host
presses Done; every participant's bounty is closed out using the character they
named on join. Nobody presses anything extra.

## 5. Rules the bot enforces

| Rule | Why |
| --- | --- |
| A character's quests for one variant all go in the same run | Clearing once completes every one of them |
| One character per **game account** per run | You're logged into one at a time. Not per Discord user — a second account may be played by someone else |
| Stack caps at `min(party size, 6)` | The 6 is the weekly claim limit; a 7th stacked quest is claimable by nobody |
| A marathon's two clears share **one** cap | Same weekly claim budget — 6 per variant would promise 12 claims that don't exist |
| Two characters of the same job both holding a quest → the bot never picks | A guess claims a quest that was never run, and the player has no way to notice |

## 6. Access

`BOUNTY_HUNTER_ROLE_ID` makes the feature invite-only: `/bounty-char apply`
posts a request to an admin channel and the role is granted **by hand**, so the
bot needs no Manage Roles. **Unset means open to everyone** — turning the gate on
later never silently locks out people already using it.

## 7. Built and deleted

Recorded so nobody rebuilds them.

| Deleted | Why |
| --- | --- |
| `/bounty-plan`, `/bounty-need` | The board shows the same thing, with no command to learn |
| `/bounty-run` and its proposed-party panel | `closed_to_bounty` on the real signup does it without a second panel type |
| The matcher — `buildPlan`, `buildStacks`, `fillerCandidates`, run ranking | It ranked runs nobody asked it to rank. The board answers "who else has GDN CL?", which was the actual question |
| Bounty request — tag holders, tick ✅, "buat party sekarang" | Two surfaces for forming one party |
| Per-variant stack caps | Wrong: the 6 is a weekly claim budget, shared across a marathon's clears |

## 8. Data you own

`app/data/dungeons.js` — nests, their variants, aliases, capacity, `minHighDps`.
Field docs are in the file header. The one field with a correctness trap is
`aliases`; `_bountyTest.js` asserts the whole rule set.

## 9. Known weaknesses

- **Manual entry is the weak link.** A quest not typed in doesn't exist.
- **Marking depends on the host pressing Done.** No Done, nothing is marked —
  same as the loot panel, which the guild already never forgets.
- **Claims are trusted.** Claiming outside a bot-tracked run leaves the count
  wrong until someone says so.
- **A full 6-stack is rare.** At ~25 players holding ~3 good quests across ~20
  variants, a 3-stack is a good week. The bot is judged on turning 1-deep runs
  into 3-deep ones.
