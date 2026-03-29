require("dotenv").config();

const { REST, Routes, SlashCommandBuilder } = require("discord.js");

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
          { name: "GDN HC", value: "gdn_hc" },
          { name: "GDN CL", value: "gdn_cl" },
        ),
    )
    .toJSON(),
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("🔄 Registering slash commands…");

    const route = process.env.GUILD_ID
      ? Routes.applicationGuildCommands(
          process.env.CLIENT_ID,
          process.env.GUILD_ID,
        )
      : Routes.applicationCommands(process.env.CLIENT_ID);

    await rest.put(route, { body: commands });

    console.log(
      process.env.GUILD_ID
        ? `✅ Commands registered to guild ${process.env.GUILD_ID}`
        : "✅ Commands registered globally (may take up to 1 hour)",
    );
  } catch (err) {
    console.error("❌ Failed to register commands:", err);
  }
})();
