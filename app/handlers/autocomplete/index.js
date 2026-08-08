const { autocompleteBountyChar } = require("../commands/bountyChar");
const { autocompleteBountyQuest } = require("../commands/bountyQuest");

// Autocomplete cannot be deferred and must answer within 3 seconds, so every
// handler here stays to a single Mongo read. On any failure we respond with an
// empty list rather than letting the interaction time out — Discord shows the
// user "no options" instead of a stuck menu.
const autocompleteHandlers = {
  "bounty-char": autocompleteBountyChar,
  bounty: autocompleteBountyQuest,
};

async function handleAutocomplete(interaction) {
  const handler = autocompleteHandlers[interaction.commandName];
  try {
    if (handler) await handler(interaction);
    else await interaction.respond([]);
  } catch (err) {
    console.error(`❌ autocomplete (${interaction.commandName}) failed:`, err.message);
    try {
      await interaction.respond([]);
    } catch {
      /* already answered or expired */
    }
  }
}

module.exports = { handleAutocomplete };
