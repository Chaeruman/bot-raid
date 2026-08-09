const { REST, Routes, SlashCommandBuilder } = require("discord.js");
const config = require("./config");
const { ROLES } = require("./data/bounty");
const templates = require("./templates");

// Generated, never a second hand-kept list. "SDN HC" survived in /start and
// /raid for weeks after its template was gone, and picking it looked up nothing
// at all — a menu entry cannot drift from the thing it opens if it IS the thing.
const choicesFor = (...kinds) =>
  Object.entries(templates)
    .filter(([, t]) => kinds.includes(t.kind))
    .map(([value, t]) => ({ name: t.label, value }));

const commands = [
  new SlashCommandBuilder()
    .setName("start")
    .setDescription("Start a party signup (all events)")
    .addStringOption((o) =>
      o
        .setName("event")
        .setDescription("Event to run")
        .setRequired(true)
        .addChoices(...choicesFor("raid", "nest", "marathon")),
    )
    .addBooleanOption((o) =>
      o
        .setName("closed_to_bounty")
        .setDescription("Khusus bounty hunter? Tombol role diganti satu tombol Join"),
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
        .addChoices(...choicesFor("raid")),
    )
    .addBooleanOption((o) =>
      o
        .setName("closed_to_bounty")
        .setDescription("Khusus bounty hunter? Tombol role diganti satu tombol Join"),
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
        .addChoices(...choicesFor("marathon")),
    )
    .addBooleanOption((o) =>
      o
        .setName("closed_to_bounty")
        .setDescription("Khusus bounty hunter? Tombol role diganti satu tombol Join"),
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("memo")
    .setDescription("Start a DDN Memo party signup")
    .addStringOption((o) =>
      o
        .setName("tipe")
        .setDescription("Kombinasi memo yang mau dijalankan")
        .setRequired(true)
        .addChoices(
          { name: "Memo 1", value: "1" },
          { name: "Memo 2", value: "2" },
          { name: "Memo 3", value: "3" },
          { name: "Memo 4", value: "4" },
          { name: "Memo 2 & 4", value: "2,4" },
          { name: "Memo 3 & 4", value: "3,4" },
          { name: "Semua (1-4)", value: "1,2,3,4" },
        ),
    )
    .addBooleanOption((o) =>
      o
        .setName("closed_to_bounty")
        .setDescription("Khusus bounty hunter? Tombol role diganti satu tombol Join"),
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
        .addChoices(...choicesFor("nest")),
    )
    .addBooleanOption((o) =>
      o
        .setName("closed_to_bounty")
        .setDescription("Khusus bounty hunter? Tombol role diganti satu tombol Join"),
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("kirim-gaji")
    .setDescription("Lihat & tandai lunas gaji member di semua loot panel terbuka yang seller-nya kamu")
    .addIntegerOption((o) =>
      o
        .setName("budget")
        .setDescription("Gold di char ini — bot saranin maks 3 orang yang paling pas dibayar dari budget ini")
        .setRequired(false)
        .setMinValue(1),
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("gaji-saya")
    .setDescription("Lihat total gaji yang sudah kamu terima")
    .addStringOption((o) =>
      o
        .setName("range")
        .setDescription("Rentang waktu (default: minggu ini)")
        .setRequired(false)
        .addChoices(
          { name: "Minggu ini (sejak reset Sabtu)", value: "week" },
          { name: "Bulan ini", value: "month" },
          { name: "Semua", value: "all" },
        ),
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("lz")
    .setDescription("Lihat Lucky Zone hari ini")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("lz-now")
    .setDescription("Co-Leader: kirim Lucky Zone hari ini ke LZ_CHANNEL_ID sekarang (manual trigger)")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("digest-now")
    .setDescription("Co-Leader: kirim weekly digest sekarang (manual trigger, misal kalau kelewat jadwal)")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("soundboard-list")
    .setDescription("Co-Leader: lihat nama + ID soundboard custom server ini (buat setup fitur voice)")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("state")
    .setDescription("Co-Leader: view active events & loot panels in state")
    .addStringOption((o) =>
      o
        .setName("filter")
        .setDescription("Filter panel (default: semua)")
        .setRequired(false)
        .addChoices(
          { name: "Semua", value: "all" },
          { name: "Stale/gone saja (thread archived, locked, atau hilang)", value: "stale" },
        ),
    )
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

  // ── Group Bounty ────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName("bounty-char")
    .setDescription("Manage your Group Bounty characters")
    .addSubcommand((s) =>
      s
        .setName("add")
        .setDescription("Daftarkan karakter baru")
        .addStringOption((o) =>
          o.setName("name").setDescription("Nama karakter di game").setRequired(true).setMaxLength(32),
        )
        .addStringOption((o) =>
          o
            .setName("role")
            .setDescription("Party role — sama dengan tombol di signup raid")
            .setRequired(true)
            .addChoices(...ROLES.map((r) => ({ name: r, value: r }))),
        )
        .addStringOption((o) =>
          o
            .setName("dps")
            .setDescription("Gear tier — dipakai mengecek party sanggup clear")
            .setRequired(true)
            .addChoices(
              { name: "High DPS", value: "high" },
              { name: "Good DPS", value: "good" },
              { name: "Low DPS", value: "low" },
            ),
        )
        .addStringOption((o) =>
          o
            .setName("account")
            .setDescription("Akun game — karakter satu akun tidak bisa jalan barengan")
            .setRequired(true)
            .setAutocomplete(true)
            .setMaxLength(16),
        )
        .addStringOption((o) =>
          o.setName("job").setDescription("In-game class (optional)").setMaxLength(32),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("edit")
        .setDescription("Ubah karakter yang sudah ada — isi yang mau diganti saja")
        .addStringOption((o) =>
          o
            .setName("name")
            .setDescription("Karakter mana")
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addStringOption((o) =>
          o
            .setName("role")
            .setDescription("Party role baru")
            .addChoices(...ROLES.map((r) => ({ name: r, value: r }))),
        )
        .addStringOption((o) =>
          o
            .setName("dps")
            .setDescription("Gear tier baru")
            .addChoices(
              { name: "High DPS", value: "high" },
              { name: "Good DPS", value: "good" },
              { name: "Low DPS", value: "low" },
            ),
        )
        .addStringOption((o) =>
          o.setName("account").setDescription("Pindah akun game").setAutocomplete(true).setMaxLength(16),
        )
        .addStringOption((o) => o.setName("job").setDescription("In-game class").setMaxLength(32))
    )
    .addSubcommand((s) =>
      s
        .setName("remove")
        .setDescription("Remove a character from your roster")
        .addStringOption((o) =>
          o.setName("name").setDescription("Character name").setRequired(true).setAutocomplete(true),
        ),
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("bounty")
    .setDescription("Record this week's bounty quests — pick the character in the form")
    .addBooleanOption((o) =>
      o
        .setName("replace")
        .setDescription("Replace this character's unclaimed quests instead of adding to them"),
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("bounty-me")
    .setDescription("Your bounty quests, claims left, and what you've earned this week")
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
