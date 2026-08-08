const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

function isMTDestroyer(event) {
  const mt = event.roles["MT"];
  if (!mt) return false;
  return mt.users.some((uid) => event.users[uid]?.subRole === "Destroyer");
}

function createButtons(event, viewerId = null) {
  const isHost = viewerId === event.hostId;
  const destroyerActive = isMTDestroyer(event);

  // Role buttons disappear entirely while locked, or once the party is full
  // (not just disabled) — same treatment either way.
  const partyFull = Object.keys(event.users).length >= event.maxSlot;
  const roleRows = [];

  // Bounty-only: one Join button instead of nine role buttons. The character you
  // pick decides the slot, so there is nothing to choose here.
  if (event.closedToBounty) {
    if (!event.locked && !partyFull)
      roleRows.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("bounty-join")
            .setLabel("🎯 Join party (bounty)")
            .setStyle(ButtonStyle.Primary),
        ),
      );
  } else if (!event.locked && !partyFull) {
    let row = new ActionRowBuilder();
    let count = 0;

    if (event.jobs) {
      // Memo party: buttons pick a job label, position (P1-P4) is auto-assigned.
      event.jobs.forEach((job, idx) => {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`memojob_${idx}`)
            .setLabel(job)
            .setStyle(ButtonStyle.Primary),
        );

        count++;
        if (count % 5 === 0) {
          roleRows.push(row);
          row = new ActionRowBuilder();
        }
      });
    } else {
      for (const [slotKey, role] of Object.entries(event.roles)) {
        // Bounty parties drop the per-role caps: a quest holder is never turned
        // away because "FU is full". maxSlot still caps the party.
        const isFull = !event.stackRoles && role.users.length >= role.max;

        let label;
        if (slotKey === "MC") {
          label = destroyerActive ? "Barba" : "MC";
        } else if (event.stackRoles) {
          label = role.label || slotKey;
        } else if (role.max > 1) {
          label = `${role.label || slotKey} (${role.users.length}/${role.max})`;
        } else {
          label = role.label || slotKey;
        }

        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`role_${slotKey}`)
            .setLabel(label)
            .setStyle(isFull ? ButtonStyle.Success : ButtonStyle.Primary)
            .setDisabled(isFull),
        );

        count++;
        if (count % 5 === 0) {
          roleRows.push(row);
          row = new ActionRowBuilder();
        }
      }
    }

    if (row.components.length > 0) roleRows.push(row);
  }

  // Control rows
  const controlRow1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("cancel_my_role")
      .setLabel("❌ Cancel My Role")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("toggle_lock")
      .setLabel(event.locked ? "🔓 Unlock Party" : "🔒 Lock Party")
      .setStyle(event.locked ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(!isHost),
    new ButtonBuilder()
      .setCustomId("remove_member")
      .setLabel("🗑️ Remove Member")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!isHost || Object.keys(event.users).length === 0),
  );

  if (event.poolKeys?.length) {
    controlRow1.addComponents(
      new ButtonBuilder()
        .setCustomId("bounty-open")
        .setLabel(event.closedToBounty ? "🔓 Buka untuk semua" : "🎯 Khusus bounty")
        .setStyle(event.closedToBounty ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(!isHost),
    );
  }

  const controlRow2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("cancel_run")
      .setLabel("🛑 Cancel Run")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!isHost),
    new ButtonBuilder()
      .setCustomId("done_run")
      .setLabel("✅ Done")
      .setStyle(ButtonStyle.Success)
      .setDisabled(!isHost),
  );

  const rows = [...roleRows, controlRow1, controlRow2];

  // Once full, role buttons are gone — replace that space with ping buttons
  // so the host can rally everyone.
  if (partyFull) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("party_ping")
          .setLabel("📢 Ping Party (custom)")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(!isHost),
        new ButtonBuilder()
          .setCustomId("party_up")
          .setLabel("🎉 Party Up")
          .setStyle(ButtonStyle.Success)
          .setDisabled(!isHost),
      ),
    );
  }

  return rows;
}

module.exports = { createButtons, isMTDestroyer };
