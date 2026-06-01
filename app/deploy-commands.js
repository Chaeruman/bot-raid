const { REST, Routes, SlashCommandBuilder } = require("discord.js");
const config = require("./config");

const commands = [
  new SlashCommandBuilder()
    .setName("start")
    .setDescription("Start a new party signup")
    .addStringOption((option) =>
      option
        .setName("event")
        .setDescription("Choose which event to run")
        .setRequired(true)
        .addChoices(
          { name: "DDN Classic", value: "ddn_cl" },
          { name: "GDN HC", value: "gdn_hc" },
          { name: "GDN Classic", value: "gdn_cl" },
          { name: "TKN Hell", value: "tkn_hell" },
          { name: "Marathon GDN", value: "marathon_gdn" },
          { name: "Marathon DDN", value: "marathon_ddn" },
        ),
    )
    .toJSON(),
];

const rest = new REST({ version: "10" }).setToken(config.token);

(async () => {
  try {
    console.log("🔄 Registering slash commands…");

    const route = config.guildId
      ? Routes.applicationGuildCommands(config.clientId, config.guildId)
      : Routes.applicationCommands(config.clientId);

    await rest.put(route, { body: commands });

    console.log(
      config.guildId
        ? `✅ Commands registered to guild ${config.guildId}`
        : "✅ Commands registered globally (may take up to 1 hour)",
    );
  } catch (err) {
    console.error("❌ Failed to register commands:", err);
  }
})();
