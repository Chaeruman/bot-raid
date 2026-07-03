const { REST, Routes, SlashCommandBuilder } = require("discord.js");
const config = require("./config");

const commands = [
  new SlashCommandBuilder()
    .setName("start")
    .setDescription("Start a party signup (all events)")
    .addStringOption((o) =>
      o
        .setName("event")
        .setDescription("Event to run")
        .setRequired(true)
        .addChoices(
          { name: "DDN Classic", value: "ddn_cl" },
          { name: "DDN HC", value: "ddn_hc" },
          { name: "GDN HC", value: "gdn_hc" },
          { name: "GDN Classic", value: "gdn_cl" },
          { name: "SDN HC", value: "sdn_hc" },
          { name: "Marathon GDN", value: "marathon_gdn" },
          { name: "Marathon DDN", value: "marathon_ddn" },
        ),
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("raid")
    .setDescription("Start a single-raid party signup")
    .addStringOption((o) =>
      o
        .setName("event")
        .setDescription("Raid to run")
        .setRequired(true)
        .addChoices(
          { name: "DDN HC", value: "ddn_hc" },
          { name: "DDN Classic", value: "ddn_cl" },
          { name: "GDN HC", value: "gdn_hc" },
          { name: "GDN Classic", value: "gdn_cl" },
          { name: "SDN HC", value: "sdn_hc" },
        ),
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("marathon")
    .setDescription("Start a marathon party signup")
    .addStringOption((o) =>
      o
        .setName("event")
        .setDescription("Marathon to run")
        .setRequired(true)
        .addChoices(
          { name: "Marathon GDN", value: "marathon_gdn" },
          { name: "Marathon DDN", value: "marathon_ddn" },
        ),
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("loot")
    .setDescription("Create a standalone loot tracking panel")
    .addStringOption((o) =>
      o
        .setName("title")
        .setDescription("Label for the loot panel")
        .setRequired(true),
    )
    .addStringOption((o) =>
      o
        .setName("tim")
        .setDescription("Scope to a team — auto-fills members from that role (must have the role)")
        .setRequired(false)
        .addChoices(
          { name: "Tim 1", value: "1" },
          { name: "Tim 2", value: "2" },
        ),
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("nest")
    .setDescription("Start a nest party signup")
    .addStringOption((o) =>
      o
        .setName("event")
        .setDescription("Raid to run")
        .setRequired(true)
        .addChoices({ name: "TKN Hell", value: "tkn_hell" }),
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("kirim-gaji")
    .setDescription("Lihat & tandai lunas gaji member di semua loot panel terbuka yang seller-nya kamu")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("state")
    .setDescription("Co-Leader: view active events & loot panels in state")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Co-Leader: clear an active event or loot panel from state")
    .addStringOption((o) =>
      o
        .setName("id")
        .setDescription("Message ID of the event/panel (from /state)")
        .setRequired(true),
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("loot-action")
    .setDescription("Run a loot-panel action by panel ID (ID is in the panel footer)")
    .addStringOption((o) =>
      o
        .setName("id")
        .setDescription("Loot panel ID (shown in the panel footer)")
        .setRequired(true),
    )
    .addStringOption((o) =>
      o
        .setName("action")
        .setDescription("What to do")
        .setRequired(true)
        .addChoices(
          { name: "Set Seller", value: "seller" },
          { name: "Type Items", value: "type-items" },
          { name: "Browse Item", value: "browse" },
          { name: "Remove Item", value: "remove-item" },
          { name: "Price All (bulk)", value: "set-price" },
          { name: "Price One", value: "price-item" },
          { name: "Add Gold", value: "add-gold" },
          { name: "Remove Gold", value: "remove-gold" },
          { name: "Mark Paid", value: "mark-paid" },
          { name: "Add Member", value: "add-member" },
          { name: "Remove Member", value: "remove-member" },
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
