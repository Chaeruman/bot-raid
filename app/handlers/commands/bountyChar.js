const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const config = require("../../config");
const { getChars, saveChars, bountyApplications, saveState } = require("../../state");
const { DPS_TIERS } = require("../../data/bounty");

// A roster this size already means something has gone wrong — nobody plays 40
// characters. It exists to stop a scripted loop filling the document, not to
// limit a real player: the biggest known roster is ~15.
const MAX_CHARS = 40;
const MAX_NAME = 32;

const norm = (s) => (s || "").trim().replace(/\s+/g, " ");
const same = (a, b) => a.toLowerCase() === b.toLowerCase();
// allowedMentions off across the board: these messages name roles and people
// to identify them, never to summon them.
const reply = (interaction, content) =>
  interaction.reply({
    content: content.slice(0, 2000),
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });

// Invite-only, but only if you set the role. Unset means open to everyone —
// so the gate never silently locks people out of a bot that never had one.
const isHunter = (interaction) =>
  !config.bountyHunterRoleId ||
  interaction.member?.roles?.cache?.has(config.bountyHunterRoleId) === true;

const notHunter =
  "🎯 Fitur bounty khusus **Bounty Hunter**. Pencet **🎯 Create My Thread** di channel bounty buat mengajukan.";

async function handleBountyChar(interaction) {
  switch (interaction.options.getSubcommand()) {
    case "apply":
      return applyHunter(interaction);
    case "add":
      if (!isHunter(interaction)) return reply(interaction, notHunter);
      return saveChar(interaction, false);
    case "edit":
      if (!isHunter(interaction)) return reply(interaction, notHunter);
      return saveChar(interaction, true);
    case "remove":
      return removeChar(interaction);
  }
}

// A slash command reads options; a modal reads fields. Both hand `saveChar` the
// same plain object, so the write below never learns which one it came from.
const fromOptions = (interaction) => ({
  name: interaction.options.getString("name"),
  role: interaction.options.getString("role"),
  account: interaction.options.getString("account"),
  job: interaction.options.getString("job"),
  dpsTier: interaction.options.getString("dps"),
});

// `add` and `edit` are the same write with opposite expectations about whether
// the name already exists. Two subcommands rather than one upsert because
// nobody discovers "add an existing name to change it" from a command list —
// and it lets the SCHEMA say which fields are required, instead of the handler.
//
// `values` defaults to the slash reader, so the command path is unchanged and a
// caller that has its own values just passes them.
async function saveChar(interaction, mustExist, values = fromOptions(interaction)) {
  const name = norm(values.name);
  const role = values.role;
  const accountTyped = norm(values.account);
  const job = norm(values.job);
  const dpsTier = values.dpsTier;

  if (!name) return reply(interaction, "❌ Nama karakter tidak boleh kosong.");
  if (name.length > MAX_NAME) return reply(interaction, `❌ Nama kepanjangan (maks ${MAX_NAME} huruf).`);

  const chars = await getChars(interaction.user.id);
  const existing = chars.find((c) => same(c.name, name));

  if (mustExist && !existing)
    return reply(interaction, `❌ Tidak ada karakter **${name}** — mungkin baru dihapus.`);
  if (!mustExist && existing)
    return reply(interaction, `❌ **${existing.name}** sudah terdaftar — ubah karakternya, jangan tambah lagi.`);

  // Reuse the existing spelling when it only differs by case or spacing —
  // "Akun 1" and "akun 1" splitting into two accounts is a silent wrong answer,
  // and the whole point of the field is telling accounts apart.
  const account = accountTyped
    ? chars.map((c) => c.account).find((a) => a && same(a, accountTyped)) || accountTyped
    : null;

  if (existing) {
    // Assign in place rather than replacing the object: this document is shared
    // with the activity planner, and its stat fields on this character have to
    // survive untouched (docs/bounty-arch.md §2.4).
    // Only what was actually passed. Leaving a field out keeps its old value —
    // that is what makes this an edit rather than a re-entry.
    existing.name = name;
    if (role) existing.role = role;
    if (dpsTier) existing.dpsTier = dpsTier;
    if (account) existing.account = account;
    if (job) existing.job = job; // don't wipe the planner's class on edit
  } else {
    if (chars.length >= MAX_CHARS) return reply(interaction, `❌ Roster penuh (maks ${MAX_CHARS} karakter).`);
    chars.push({ name, role, dpsTier, account, ...(job ? { job } : {}) });
  }

  if (!(await saveChars(interaction.user.id, chars)))
    return reply(interaction, "⚠️ Database tidak tersambung — tidak ada yang tersimpan.");

  const saved = existing || chars[chars.length - 1];
  return reply(
    interaction,
    `${mustExist ? "✏️ Diubah" : "✅ Ditambah"} **${saved.name}** — ${saved.role} · ` +
      `${DPS_TIERS[saved.dpsTier]}` +
      // The account is optional now, and "akun null" is worse than no account.
      `${saved.account ? ` · akun ${saved.account}` : ""}${saved.job ? ` · ${saved.job}` : ""}`,
  );
}

// Same deal as saveChar: the panel's delete arrives from a select menu, not an
// option, so the name is a parameter with the slash reader as its default.
async function removeChar(interaction, rawName = interaction.options.getString("name")) {
  const name = norm(rawName);
  const chars = await getChars(interaction.user.id);
  const idx = chars.findIndex((c) => same(c.name, name));

  if (idx === -1) return reply(interaction, `❌ Tidak ada karakter **${name}**.`);

  const [gone] = chars.splice(idx, 1);
  if (!(await saveChars(interaction.user.id, chars)))
    return reply(interaction, "⚠️ Database tidak tersambung — tidak ada yang tersimpan.");

  // This week's quests are keyed by character name and are left alone on
  // purpose: removing a character is usually a typo fix or a rename, and
  // deleting recorded claims would lose real history to a mistake.
  return reply(
    interaction,
    `🗑️ **${gone.name}** dihapus. Quest yang sudah tercatat minggu ini tetap disimpan.`,
  );
}

const applied = () =>
  "Your request will be reviewed by the admin because you're not holding a " +
  `<@&${config.bountyHunterRoleId}> role. Please wait until the admin approves the request.`;

// The bot only carries the request — the role is granted by hand, so nothing
// here needs Manage Roles.
//
// Reached from the slash command AND from pressing a bounty button without the
// role: a door that refuses you and then tells you to go type a command is the
// step this whole feature spent its time removing.
async function applyHunter(interaction) {
  if (!config.bountyHunterRoleId)
    return reply(interaction, "Belum ada role Bounty Hunter di server ini — semua orang sudah bisa pakai.");
  if (isHunter(interaction)) {
    delete bountyApplications[interaction.user.id];
    return reply(interaction, "Kamu sudah Bounty Hunter. 🎯");
  }
  if (!config.bountyAdminChannelId)
    return reply(interaction, "⚠️ `BOUNTY_ADMIN_CHANNEL_ID` belum diset — pengajuan tidak bisa dikirim.");

  // Pressing the button again is the natural thing to do while waiting, and it
  // must not put a second copy in front of the admins.
  if (bountyApplications[interaction.user.id]) return reply(interaction, applied());

  const channel = await interaction.client.channels
    .fetch(config.bountyAdminChannelId)
    .catch(() => null);
  if (!channel) return reply(interaction, "⚠️ Channel admin tidak ditemukan.");

  // No character count: the gate stops a non-hunter registering any, so it was
  // always "(0 karakter terdaftar)" — a number that could only ever say one
  // thing is not information.
  //
  // Fetching a channel needs no permission; sending does. Unwrapped, a missing
  // Send Messages here reached the applicant as "Something went wrong" — a
  // dead end for them and no clue for whoever has to fix it.
  const sent = await channel
    .send({
      content:
        `🎯 <@${interaction.user.id}> mengajukan diri jadi Bounty Hunter.
Kasih role <@&${config.bountyHunterRoleId}> kalau setuju.`,
      // The decision lives on the request itself, so nobody has to go find the
      // role list and remember who asked.
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`bounty-hunter:approve:${interaction.user.id}`)
            .setLabel("✅ Approve")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`bounty-hunter:decline:${interaction.user.id}`)
            .setLabel("✖️ Decline")
            .setStyle(ButtonStyle.Secondary),
        ),
      ],
      allowedMentions: { parse: [] },
    })
    .catch((err) => {
      console.error(`❌ applyHunter → ${config.bountyAdminChannelId}:`, err.message);
      return null;
    });

  if (!sent)
    return reply(
      interaction,
      "⚠️ Bot tidak bisa kirim ke channel admin — mintakan izin **Send Messages** di sana. " +
        "Sementara ini, minta role Bounty Hunter langsung ke admin.",
    );

  bountyApplications[interaction.user.id] = true;
  saveState();
  return reply(interaction, applied());
}

// Two options want it: `name` on remove, `account` on add. Discord autocomplete
// is a suggestion list, not a whitelist — typing an account that isn't listed
// simply creates it, so there is no "add an account" command to build.
async function autocompleteBountyChar(interaction) {
  const focused = interaction.options.getFocused(true);
  const typed = String(focused.value || "").toLowerCase();
  const chars = await getChars(interaction.user.id);

  // `name` on add doubles as "pick one to edit"; on remove it is the only way in.
  const values =
    focused.name === "account"
      ? [...new Set(chars.map((c) => c.account).filter(Boolean))]
      : chars.map((c) => c.name);

  return interaction.respond(
    values
      .filter((v) => v.toLowerCase().includes(typed))
      .slice(0, 25)
      .map((v) => ({ name: v.slice(0, 100), value: v.slice(0, 100) })),
  );
}

module.exports = {
  handleBountyChar, autocompleteBountyChar, isHunter, notHunter,
  // For the panel, which drives the same two writes from buttons.
  saveChar, removeChar, applyHunter,
};
