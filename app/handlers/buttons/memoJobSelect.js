const { updateMessage } = require("../../builders/content");
const { saveState } = require("../../state");

async function handleMemoJobSelect(interaction, event) {
  const idx = Number(interaction.customId.replace("memojob_", ""));
  const job = event.jobs?.[idx];
  if (job === undefined) return;

  const userId = interaction.user.id;
  const existing = event.users[userId];

  if (existing) {
    // Already in the party — switch job, keep the same position.
    event.users[userId] = { slot: existing.slot, subRole: job };
  } else {
    const found = Object.entries(event.roles).find(([, r]) => r.users.length < r.max);
    if (!found) return; // party filled between render and click — no-op

    const [slotKey, slot] = found;
    slot.users.push(userId);
    event.users[userId] = { slot: slotKey, subRole: job };
  }

  saveState();
  await updateMessage(interaction.message, event);
  // Tell the joiner if this run clears a bounty they hold, and give them the
  // one button that marks it done.
  if (event.poolKeys?.length)
    await require("../../bountyJoin").onJoin(interaction, event).catch(() => {});
}

module.exports = { handleMemoJobSelect };
