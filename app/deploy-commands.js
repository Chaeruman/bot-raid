const { REST, Routes, SlashCommandBuilder } = require("discord.js");
const config = require("./config");

const commands = [
  new SlashCommandBuilder()
    .setName("start")
    .setDescription("Start a party signup (all events)")
    .addStringOption((o) =>
      o.setName("event").setDescription("Event to run").setRequired(true)
        .addChoices(
          { name: "DDN Classic",   value: "ddn_cl" },
          { name: "GDN HC",        value: "gdn_hc" },
          { name: "GDN Classic",   value: "gdn_cl" },
          { name: "SDN HC",        value: "sdn_hc" },
          { name: "SDN Core",      value: "sdn_core" },
          { name: "TKN Hell",      value: "tkn_hell" },
          { name: "Marathon GDN",  value: "marathon_gdn" },
          { name: "Marathon DDN",  value: "marathon_ddn" },
        ),
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("raid")
    .setDescription("Start a single-raid party signup")
    .addStringOption((o) =>
      o.setName("event").setDescription("Raid to run").setRequired(true)
        .addChoices(
          { name: "DDN Classic", value: "ddn_cl" },
          { name: "GDN HC",      value: "gdn_hc" },
          { name: "GDN Classic", value: "gdn_cl" },
          { name: "SDN HC",      value: "sdn_hc" },
          { name: "SDN Core",    value: "sdn_core" },
        ),
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("marathon")
    .setDescription("Start a marathon party signup")
    .addStringOption((o) =>
      o.setName("event").setDescription("Marathon to run").setRequired(true)
        .addChoices(
          { name: "Marathon GDN", value: "marathon_gdn" },
          { name: "Marathon DDN", value: "marathon_ddn" },
        ),
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("loot")
    .setDescription("Create a loot tracking panel")
    .addStringOption((o) =>
      o.setName("message_id")
        .setDescription("Message ID of an active party signup to link members and settings from")
        .setRequired(false),
    )
    .addStringOption((o) =>
      o.setName("title")
        .setDescription("Custom title (used when not linking to a party)")
        .setRequired(false),
    )
    .addBooleanOption((o) =>
      o.setName("hc")
        .setDescription("HC raid — gold split ÷7 (only used when not linking to a party)")
        .setRequired(false),
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
