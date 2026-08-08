// The bounty panel: one message that shows a player everything the bot knows
// about them, with every action as a button. It replaces reading `/bounty-me`
// and `/bounty-char list` and then typing a third command to change anything.
//
// It has NO opinion about where it lives. `buildPanel` returns a message
// payload, so the same panel works as an ephemeral reply today and as a pinned
// message inside a private thread later — that is the whole reason it is a
// module of its own rather than part of a command handler.
const {
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  ButtonStyle,
  ModalBuilder,
  LabelBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
} = require("discord.js");
const { getChars, getBountyWeek } = require("./state");
const { weekKey, questLabel, claimsLeft, tally } = require("./bounty");
const { WEEKLY_CLAIMS, DPS_TIERS, ROLES, SCROLL } = require("./data/bounty");
const { weekLabelId } = require("./bountyBoard");

const PREFIX = "bounty-panel:"; // + <action>:<ownerId>

// Discord caps a select at 25 options; a roster over that loses its tail here
// rather than failing to open at all.
const MAX_OPTS = 25;

const ephemeral = (interaction, content) =>
  interaction.reply({ content, flags: MessageFlags.Ephemeral });

// ── Render ───────────────────────────────────────────────────────────────────

function renderTally(t) {
  const parts = [];
  if (t.potion) parts.push(`${t.potion}× Potion Engrave`);
  for (const [key, n] of Object.entries(t.scroll)) if (n) parts.push(`${n}× ${SCROLL[key]?.label || key} scroll`);
  if (t.box) parts.push(`${t.box}× card box`);
  return parts.join(" · ");
}

// Characters with nothing recorded still appear — this is the roster view as
// well as the week view, and "which of my characters did I forget" is exactly
// the question it exists to answer.
async function buildPanel(ownerId) {
  const [chars, doc] = await Promise.all([getChars(ownerId), getBountyWeek(ownerId, weekKey())]);
  const byChar = doc?.chars || {};

  const lines = [`<@${ownerId}>`];
  const total = { potion: 0, box: 0, scroll: {} };

  for (const c of chars) {
    const charWeek = byChar[c.name];
    const board = charWeek?.board || [];
    lines.push(
      "",
      `**${c.name}** · ${c.role || "belum ada role"} · ${DPS_TIERS[c.dpsTier] || "belum ada tier"}` +
        (c.account ? ` · akun ${c.account}` : ""),
    );

    if (!board.length) lines.push("_belum ada quest_");
    else {
      board.forEach((q) => lines.push(`${q.runId ? "✓" : "○"} ${questLabel(q)}`));
      lines.push(`_sisa ${claimsLeft(charWeek)}/${WEEKLY_CLAIMS} claim_`);
      const t = tally(charWeek);
      total.potion += t.potion;
      total.box += t.box;
      for (const [k, n] of Object.entries(t.scroll)) total.scroll[k] = (total.scroll[k] || 0) + n;
    }
  }

  if (!chars.length) lines.push("", "Belum ada karakter. Mulai dari **➕ Karakter**.");
  const earned = renderTally(total);
  if (earned) lines.push("", `**Dapat minggu ini:** ${earned}`);

  // An embed, not message content: 15 characters with their quests runs past
  // the 2000-char message limit, and truncation here would silently drop a
  // character from the one place someone checks their own data. 4096 holds a
  // full roster with room over.
  return {
    embeds: [
      new EmbedBuilder()
        .setTitle("🎯 Bounty")
        .setColor(0xe67e22)
        .setDescription(lines.join("\n").slice(0, 4096))
        // The week is on the panel because the panel outlives the week it was
        // drawn in. Stale is then visible rather than silent.
        .setFooter({ text: weekLabelId() }),
    ],
    components: panelRows(ownerId, chars.length > 0),
    // The owner is named so the panel says whose it is; pinging them on every
    // redraw would be a notification per button press.
    allowedMentions: { parse: [] },
  };
}

const BUTTON = (ownerId, action, label, style, disabled) =>
  new ButtonBuilder()
    .setCustomId(`${PREFIX}${action}:${ownerId}`)
    .setLabel(label)
    .setStyle(style)
    .setDisabled(!!disabled);

// Everything except "add" needs a character to act on, so an empty roster
// leaves exactly one thing to press.
const panelRows = (ownerId, hasChars) => [
  new ActionRowBuilder().addComponents(
    BUTTON(ownerId, "add", "➕ Karakter", ButtonStyle.Success),
    BUTTON(ownerId, "edit", "✏️ Ubah", ButtonStyle.Secondary, !hasChars),
    BUTTON(ownerId, "remove", "🗑️ Hapus", ButtonStyle.Secondary, !hasChars),
  ),
  new ActionRowBuilder().addComponents(
    BUTTON(ownerId, "quest", "🎯 Catat quest", ButtonStyle.Primary, !hasChars),
    BUTTON(ownerId, "replace", "♻️ Ganti quest", ButtonStyle.Secondary, !hasChars),
    BUTTON(ownerId, "refresh", "🔄 Refresh", ButtonStyle.Secondary),
  ),
];

// ── Modals ───────────────────────────────────────────────────────────────────

const pick = (id, label, options, required = true) =>
  new LabelBuilder().setLabel(label).setStringSelectMenuComponent(
    new StringSelectMenuBuilder()
      .setCustomId(id)
      .setRequired(required)
      .setPlaceholder(required ? "Pilih" : "Biarkan kosong kalau tidak diubah")
      .addOptions(options.slice(0, MAX_OPTS)),
  );

const text = (id, label, required = true, placeholder) =>
  new LabelBuilder().setLabel(label).setTextInputComponent(
    new TextInputBuilder()
      .setCustomId(id)
      .setStyle(TextInputStyle.Short)
      .setRequired(required)
      .setMaxLength(32)
      .setPlaceholder(placeholder || ""),
  );

const roleOpts = () => ROLES.map((r) => ({ label: r, value: r }));
const dpsOpts = () => Object.entries(DPS_TIERS).map(([value, label]) => ({ label, value }));
const charOpts = (chars) =>
  chars.map((c) => ({
    label: c.name.slice(0, 100),
    value: c.name.slice(0, 100),
    description: `${c.role || "?"} · ${DPS_TIERS[c.dpsTier] || "?"}`.slice(0, 100),
  }));

const modal = (ownerId, action, title, ...labels) =>
  new ModalBuilder().setCustomId(`${PREFIX}${action}:${ownerId}`).setTitle(title).setLabelComponents(...labels);

// The account only tells characters apart once there are two of them, so on a
// first character it is pure friction — a required free-text field that nothing
// can yet be inconsistent with. It is optional everywhere.
//
// Once accounts exist it becomes a picker, because that is where typos start
// costing something: "chelssea" and "Chelsea" are two accounts to the bot, and
// two accounts means the bot thinks those characters can run at the same time.
// Typing is still how a NEW account is made — the same rule the slash
// command's autocomplete had, since autocomplete was never a whitelist.
const accountFields = (accounts) => [
  ...(accounts.length
    ? [pick("account", "Akun game", accounts.map((a) => ({ label: a, value: a })), false)]
    : []),
  text("accountNew", accounts.length ? "…atau ketik akun baru" : "Akun game (boleh kosong)", false, "misal: 1, 2, alt"),
];

const accountsOf = (chars) => [...new Set(chars.map((c) => c.account).filter(Boolean))];

const addModal = (ownerId, chars) =>
  modal(ownerId, "add", "Tambah karakter",
    text("name", "Nama karakter", true, "ChelseaQT"),
    pick("role", "Role", roleOpts()),
    pick("dps", "DPS tier", dpsOpts()),
    ...accountFields(accountsOf(chars)));

// Every field but the character is optional: leaving one alone keeps its old
// value, which is what makes this an edit rather than a re-entry.
const editModal = (ownerId, chars) =>
  modal(ownerId, "edit", "Ubah karakter",
    pick("char", "Karakter", charOpts(chars)),
    pick("role", "Role baru", roleOpts(), false),
    pick("dps", "DPS tier baru", dpsOpts(), false),
    ...accountFields(accountsOf(chars)));

const removeModal = (ownerId, chars) =>
  modal(ownerId, "remove", "Hapus karakter", pick("char", "Karakter", charOpts(chars)));

// ── Routing ──────────────────────────────────────────────────────────────────

// The buttons sit on a message anyone with Manage Threads can see, and Discord
// scopes no permission to a button. Without this check a moderator pressing
// "Tambah karakter" on someone else's panel would write to their OWN roster
// while the panel redrew the other person's — nothing leaks, and nothing makes
// sense either.
function owner(interaction) {
  const [, action, ownerId] = interaction.customId.split(":");
  return { action, ownerId, mine: interaction.user.id === ownerId };
}

async function handlePanelButton(interaction) {
  const { action, ownerId, mine } = owner(interaction);
  if (!mine) return ephemeral(interaction, "Ini panel orang lain — bikin punyamu sendiri dengan `/bounty-me`.");

  if (action === "refresh") return interaction.update(await buildPanel(ownerId));
  if (action === "quest" || action === "replace")
    return require("./handlers/commands/bountyQuest").openQuestModal(interaction, action === "replace");

  // Add needs the roster too, for the account picker.
  const chars = await getChars(ownerId);
  if (action === "add") return interaction.showModal(addModal(ownerId, chars));

  // A select with zero options throws, and a panel drawn before the last
  // character was deleted still has these enabled.
  if (!chars.length) return ephemeral(interaction, "Belum ada karakter.");
  return interaction.showModal(
    action === "edit" ? editModal(ownerId, chars) : removeModal(ownerId, chars),
  );
}

// saveChar and removeChar answer the interaction themselves, but the panel has
// to be redrawn from that SAME interaction — and an interaction can only be
// answered once. So they get a stand-in whose reply is captured, and the order
// of delivery is decided here: panel first, their message after it.
const capture = (interaction) => ({
  user: interaction.user,
  member: interaction.member,
  box: {},
  reply(o) {
    this.box.content = o.content;
  },
});

// The modal's shape depends on the roster — the account picker only exists once
// there is an account to pick — so asking for a field has to be allowed to come
// back empty instead of throwing.
const one = (interaction, id) => {
  try {
    return interaction.fields.getStringSelectValues(id)[0] || null;
  } catch {
    return null;
  }
};

async function handlePanelModal(interaction) {
  const { action, ownerId, mine } = owner(interaction);
  if (!mine) return ephemeral(interaction, "Ini panel orang lain.");

  const { saveChar, removeChar } = require("./handlers/commands/bountyChar");
  const proxy = capture(interaction);

  if (action === "remove") await removeChar(proxy, one(interaction, "char"));
  else
    await saveChar(proxy, action === "edit", {
      name: action === "edit" ? one(interaction, "char") : interaction.fields.getTextInputValue("name"),
      role: one(interaction, "role"),
      dpsTier: one(interaction, "dps"),
      // Typed wins over picked: typing is how a new account is made, so doing
      // both can only mean the new one.
      account: interaction.fields.getTextInputValue("accountNew") || one(interaction, "account"),
    });

  await interaction.update(await buildPanel(ownerId));
  if (proxy.box.content)
    return interaction.followUp({ content: proxy.box.content, flags: MessageFlags.Ephemeral });
}

module.exports = {
  buildPanel, handlePanelButton, handlePanelModal, PREFIX,
  // Pure functions of (ownerId, roster) — the modal shape depends on the
  // roster, so that relationship is worth checking directly.
  addModal, editModal,
};
