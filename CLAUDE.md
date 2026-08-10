# raid-gdn Discord Bot

## What this is
Dragon Nest raid party signup bot. Players click role buttons to join a party; host locks/closes the run; bot creates a forum thread for loot tracking.

## Stack
- Node.js, discord.js v14
- State persisted to MongoDB (`MONGODB_URI`/`MONGODB_DB_NAME`, `balance` collection, `_id: "state"` doc) via `saveState()` in `app/state.js`; loaded on startup in `app/index.js`
- Deployed on Render (keepAlive ping via `app/utils/keepAlive.js`)

## Key files
- `app/index.js` — Discord client, interaction router
- `app/state.js` — in-memory store: `activeEvents`, `activeLootPanels`, `cooldowns`
- `app/templates.js` — raid event definitions (roles, maxSlot, hcGoldSplit, etc.)
- `app/constants.js` — COOLDOWN (3000ms), HOST_ONLY_BUTTONS
- `app/builders/content.js` — `updateMessage()`, `buildThreadTitle/Content()`
- `app/builders/buttons.js` — `createButtons()`, `isMTDestroyer()`
- `app/handlers/commands/_createEvent.js` — shared event creation logic
- `app/handlers/buttons/roleSelect.js` — role join/switch logic
- `app/handlers/buttons/doneRun.js` — closes run, creates forum thread, creates loot panel in thread

## Handler routing
`index.js` routes to handlers by interaction type. Each handler folder has an `index.js` that dispatches by `customId` or command name.

## Event data shape
```js
{
  messageId, hostId, label, title, maxSlot,
  noThread, forumTagKey, hcGoldSplit, subruns,
  roles: { SLOT_KEY: { max, label, users: [], hideIfEmpty, subRoles, subRoleAsLabel } },
  users: { userId: { slot, subRole } },
  locked
}
```

## Known issues / task backlog
1. ✅ Interaction ack bug — `roleSelect.js` never acks the interaction (needs `deferUpdate()`)
2. ✅ Stale-event guard — if `activeEvents[messageId]` is undefined, reply with clear ephemeral message
3. ✅ MT sub-role flow — fully wired; fixed double-deferUpdate in roleSelect.js that broke all non-MT role buttons
4. ✅ Loot panel — handlers fully wired under `handlers/buttons/loot/` and `handlers/selectMenus/loot/`; panel state uses a single `items[]` array (no `raidItems`/`mailItems` split, no `source` field); stamp fee counted from sold items only; gold splits ÷8 into shared pool and ÷7 as per-person add with excluded-member lines
5. ✅ Persistence — `saveState()` writes `activeEvents`+`activeLootPanels` to MongoDB (fire-and-forget) after every mutation; loaded on startup via `Object.assign` in `index.js`

## Versioning
- Semantic Versioning; single source = `version` in `package.json`, re-exported by `app/version.js`.
- Surfaced in the boot log and in `/state`.
- Bump with `npm run release:patch|minor|major` (creates commit + `vX.Y.Z` tag).
- Before bumping, move the `[Unreleased]` items in `CHANGELOG.md` into a new dated version section.

## Parse-failure log
- Both parsers (`utils/parseItems.js` for loot, `bounty.js` for quests) record
  lines they couldn't read via `recordParseFail()` in `app/state.js`.
- One document per DISTINCT line in the `parseFails` collection, `$inc`-ed on
  repeat — bounded by the number of distinct mistakes, not by traffic, and
  self-sorting by what's worth fixing first. No TTL index, no cleanup job.
- `outcome`: `failed` (line dropped) vs `needs_pick` (a shortlist was offered).
  A `needs_pick` line repeated often is a default the parser should be making.
- Read back with `/parse-fails` (Co-Leader); `clear:true` empties it after a
  batch has been acted on. Also mirrored to stdout, so Render logs have it even
  when Mongo is down.

## Weekly digest
- `app/digest.js` posts a top-10 salary leaderboard to `DIGEST_CHANNEL_ID` every Saturday 08:00 WIB.
- Off by default — gated behind `DIGEST_ENABLED=true` env var (kill-switch, no redeploy needed to disable).
- Runs in-process via `setInterval` (no new Render service, no cron dependency); `digestLastSent` persisted in state to survive restarts.

## Conventions
- Plain CommonJS (`require`/`module.exports`), no TypeScript
- `interaction.deferUpdate()` then `message.edit()` for button handlers that update the panel
- `MessageFlags.Ephemeral` for host-only feedback replies
- Locale: Indonesian (`id-ID`), timezone: Asia/Jakarta (WIB)
- Call `saveState()` after every mutation to `activeEvents` or `activeLootPanels`
- `closeLoot` deletes the panel from `activeLootPanels` before calling `saveState()` — closed panels are never kept in MongoDB
