# raid-gdn Discord Bot

## What this is
Dragon Nest raid party signup bot. Players click role buttons to join a party; host locks/closes the run; bot creates a forum thread for loot tracking.

## Stack
- Node.js, discord.js v14
- State persisted to `state.json` (project root) via `saveState()` in `app/state.js`; loaded on startup in `app/index.js`
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
5. ✅ Persistence — `saveState()` writes `activeEvents`+`activeLootPanels` to `state.json` synchronously after every mutation; loaded on startup via `Object.assign` in `index.js`

## Conventions
- Plain CommonJS (`require`/`module.exports`), no TypeScript
- `interaction.deferUpdate()` then `message.edit()` for button handlers that update the panel
- `MessageFlags.Ephemeral` for host-only feedback replies
- Locale: Indonesian (`id-ID`), timezone: Asia/Jakarta (WIB)
- Call `saveState()` after every mutation to `activeEvents` or `activeLootPanels`
- `closeLoot` deletes the panel from `activeLootPanels` before calling `saveState()` — closed panels are never kept in `state.json`
