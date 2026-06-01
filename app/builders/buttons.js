const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

function isMTDestroyer(event) {
  const mt = event.roles["MT"];
  if (!mt) return false;
  return mt.users.some((uid) => event.users[uid]?.subRole === "Destroyer");
}

function createButtons(event, viewerId = null) {
  const isHost = viewerId === event.hostId;
  const destroyerActive = isMTDestroyer(event);

  const roleRows = [];
  let row = new ActionRowBuilder();
  let count = 0;

  for (const [slotKey, role] of Object.entries(event.roles)) {
    const isFull = role.users.length >= role.max;

    let label;
    if (slotKey === "MC") {
      label = destroyerActive ? "Barba" : "MC";
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
        .setDisabled(event.locked || isFull),
    );

    count++;
    if (count % 5 === 0) {
      roleRows.push(row);
      row = new ActionRowBuilder();
    }
  }

  if (row.components.length > 0) roleRows.push(row);

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

  return [...roleRows, controlRow1, controlRow2];
}

module.exports = { createButtons, isMTDestroyer };
