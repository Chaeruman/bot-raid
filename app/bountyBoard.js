// Bounty board — Idea 1 (docs/bounty-prd.md §5.5b).
//
// A locked channel, one pinned board, one button per raid. A member clicks and
// gives rarity + scroll; the bot already knows their role from the character
// sheet, so it can answer with a party in raid layout instead of a flat list.
//
// Pure logic only — no Discord, no Mongo. Checked by app/_boardTest.js.

const ROLES = require("./templates").gdn_cl.roles;
const { RARITY, SCROLL } = require("./data/bounty");

// Fill order. MT/MC/SM/Healer are one-of-a-kind and the run fails without them,
// so they claim slots before DPS soaks people up. Ice Stacker and Acro fill last
// because they are the two the host said can be given up when slots run short.
const ROLE_ORDER = ["MT", "MC", "SM", "HEALER", "FU", "DPS", "ICE", "ACRO", "SUPPORT"];

// Character sheets store the role LABEL ("Ice Stacker"), templates key it ("ICE").
const KEY_BY_LABEL = Object.fromEntries(
  Object.entries(ROLES).map(([key, r]) => [r.label || key, key]),
);

const roleKeyOf = (label) => KEY_BY_LABEL[label] || null;

// Assign one party's worth of entries to raid role slots.
//
// entries: [{ userId, charName, role, dpsTier, rarity, scroll, box }]
// Returns { slots, overflow } — overflow needs a party of its own.
function assignRoles(entries, capacity = 8, roles = ROLES) {
  const slots = new Map(ROLE_ORDER.map((k) => [k, []]));
  const collided = [];
  const overflow = [];
  let placed = 0;

  // 1. Everyone into their own role while a slot is free.
  for (const key of ROLE_ORDER) {
    for (const e of entries.filter((x) => roleKeyOf(x.role) === key)) {
      if (placed < capacity && slots.get(key).length < (roles[key]?.max ?? 0)) {
        slots.get(key).push(e);
        placed++;
      } else collided.push(e);
    }
  }

  // 2. A collision goes to a DPS slot, but only if the player is high DPS —
  //    the host's rule, and the reason DPS carries 3 slots.
  for (const e of collided) {
    const dps = slots.get("DPS");
    if (placed < capacity && e.dpsTier === "high" && dps.length < (roles.DPS?.max ?? 0)) {
      dps.push({ ...e, movedFrom: e.role });
      placed++;
    } else overflow.push(e);
  }

  // 3. Anyone whose role isn't on the sheet at all can't be placed.
  for (const e of entries) if (!roleKeyOf(e.role)) overflow.push(e);

  return { slots, overflow, placed };
}

const questText = (e) =>
  e.rarity
    ? `${RARITY[e.rarity]?.label || e.rarity}${e.box ? " + card box" : ""} · ` +
      `${SCROLL[e.scroll]?.label || e.scroll}`
    : "numpang";

// One party, in raid layout. Empty slots are shown so the host can see what the
// party is still missing — that's the whole point of using the raid shape.
function renderParty(assigned, roles = ROLES) {
  const lines = [];
  for (const key of ROLE_ORDER) {
    const filled = assigned.slots.get(key) || [];
    const label = roles[key]?.label || key;
    if (!filled.length) {
      if (!roles[key]?.hideIfEmpty) lines.push(`\`${label.padEnd(11)}\` —`);
      continue;
    }
    for (const e of filled) {
      lines.push(
        `\`${label.padEnd(11)}\` <@${e.userId}> **${e.charName}** — ${questText(e)}` +
          (e.movedFrom ? ` _(moved from ${e.movedFrom})_` : ""),
      );
    }
  }
  return lines.join("\n");
}

module.exports = { assignRoles, renderParty, roleKeyOf, questText, ROLE_ORDER, ROLES };
