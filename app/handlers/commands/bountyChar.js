const { MessageFlags } = require("discord.js");
const config = require("../../config");
const { getChars, saveChars } = require("../../state");
const { DPS_TIERS } = require("../../data/bounty");

// A roster this size already means something has gone wrong — nobody plays 40
// characters. It exists to stop a scripted loop filling the document, not to
// limit a real player: the biggest known roster is ~15.
const MAX_CHARS = 40;
const MAX_NAME = 32;

const norm = (s) => (s || "").trim().replace(/\s+/g, " ");
const same = (a, b) => a.toLowerCase() === b.toLowerCase();
const reply = (interaction, content) =>
  interaction.reply({ content: content.slice(0, 2000), flags: MessageFlags.Ephemeral });

// Invite-only, but only if you set the role. Unset means open to everyone —
// so the gate never silently locks people out of a bot that never had one.
const isHunter = (interaction) =>
  !config.bountyHunterRoleId ||
  interaction.member?.roles?.cache?.has(config.bountyHunterRoleId) === true;

const notHunter =
  "🎯 Fitur bounty khusus **Bounty Hunter**. Ajukan dulu dengan `/bounty-char apply`.";

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
    case "list":
      return listChars(interaction);
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

  if (!name) return reply(interaction, "❌ Name cannot be empty.");
  if (name.length > MAX_NAME) return reply(interaction, `❌ Name is too long (max ${MAX_NAME}).`);

  const chars = await getChars(interaction.user.id);
  const existing = chars.find((c) => same(c.name, name));

  if (mustExist && !existing)
    return reply(interaction, `❌ Tidak ada karakter **${name}**. Daftarkan dulu: \`/bounty-char add\`.`);
  if (!mustExist && existing)
    return reply(interaction, `❌ **${existing.name}** sudah terdaftar. Ubah dengan \`/bounty-char edit\`.`);

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
    if (chars.length >= MAX_CHARS) return reply(interaction, `❌ Roster is full (${MAX_CHARS}).`);
    chars.push({ name, role, dpsTier, account, ...(job ? { job } : {}) });
  }

  if (!(await saveChars(interaction.user.id, chars)))
    return reply(interaction, "⚠️ MongoDB is not configured — nothing was saved.");

  const saved = existing || chars[chars.length - 1];
  return reply(
    interaction,
    `${mustExist ? "✏️ Diubah" : "✅ Ditambah"} **${saved.name}** — ${saved.role} · ` +
      `${DPS_TIERS[saved.dpsTier]}` +
      // The account is optional now, and "akun null" is worse than no account.
      `${saved.account ? ` · akun ${saved.account}` : ""}${saved.job ? ` · ${saved.job}` : ""}`,
  );
}

async function listChars(interaction) {
  const chars = await getChars(interaction.user.id);
  if (!chars.length)
    return reply(interaction, "No characters yet. Add one with `/bounty-char add`.");

  const lines = chars.map(
    (c) =>
      `• **${c.name}** — ${c.role || "no role set"} · ` +
      `${DPS_TIERS[c.dpsTier] || "no DPS tier set"}` +
      `${c.account ? ` · akun ${c.account}` : ""}${c.job ? ` · ${c.job}` : ""}`,
  );
  return reply(interaction, `**Your characters (${chars.length})**\n${lines.join("\n")}`);
}

// Same deal as saveChar: the panel's delete arrives from a select menu, not an
// option, so the name is a parameter with the slash reader as its default.
async function removeChar(interaction, rawName = interaction.options.getString("name")) {
  const name = norm(rawName);
  const chars = await getChars(interaction.user.id);
  const idx = chars.findIndex((c) => same(c.name, name));

  if (idx === -1) return reply(interaction, `❌ No character named **${name}**.`);

  const [gone] = chars.splice(idx, 1);
  if (!(await saveChars(interaction.user.id, chars)))
    return reply(interaction, "⚠️ MongoDB is not configured — nothing was saved.");

  // This week's quests are keyed by character name and are left alone on
  // purpose: removing a character is usually a typo fix or a rename, and
  // deleting recorded claims would lose real history to a mistake.
  return reply(
    interaction,
    `🗑️ Removed **${gone.name}**. Quests already recorded this week are kept.`,
  );
}

// The bot only carries the request — the role is granted by hand, so nothing
// here needs Manage Roles.
async function applyHunter(interaction) {
  if (!config.bountyHunterRoleId)
    return reply(interaction, "Belum ada role Bounty Hunter di server ini — semua orang sudah bisa pakai.");
  if (isHunter(interaction)) return reply(interaction, "Kamu sudah Bounty Hunter. 🎯");
  if (!config.bountyAdminChannelId)
    return reply(interaction, "⚠️ `BOUNTY_ADMIN_CHANNEL_ID` belum diset — pengajuan tidak bisa dikirim.");

  const channel = await interaction.client.channels
    .fetch(config.bountyAdminChannelId)
    .catch(() => null);
  if (!channel) return reply(interaction, "⚠️ Channel admin tidak ditemukan.");

  const chars = await getChars(interaction.user.id);
  await channel.send({
    content:
      `🎯 <@${interaction.user.id}> mengajukan diri jadi **Bounty Hunter** ` +
      `(${chars.length} karakter terdaftar).
Kasih role <@&${config.bountyHunterRoleId}> kalau setuju.`,
    allowedMentions: { parse: [] },
  });

  return reply(interaction, "✅ Pengajuanmu dikirim ke admin. Tunggu role-nya dipasang.");
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
  saveChar, removeChar,
};
