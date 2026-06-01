const { createEvent } = require("./_createEvent");

async function handleRaid(interaction) {
  const templateKey = interaction.options.getString("event");
  return createEvent(interaction, templateKey);
}

module.exports = { handleRaid };
