const { createEvent } = require("./_createEvent");

async function handleMarathon(interaction) {
  const templateKey = interaction.options.getString("event");
  return createEvent(interaction, templateKey);
}

module.exports = { handleMarathon };
