// The bounty panel: one message that shows a player everything the bot knows
// about them, with every action as a button. It replaces reading `/bounty-me`
// and a roster listing and then typing a third command to change anything.
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
  UserSelectMenuBuilder,
  ButtonStyle,
  ModalBuilder,
  LabelBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
} = require("discord.js");
const {
  getChars, getBountyWeek,
  linkedTo, incomingLinks, bountyLinkRequests,
  requestLink, cancelLink, approveLink, unlink,
} = require("./state");
const { weekKey, questLabel, tally } = require("./bounty");
const { DPS_TIERS, ROLES, SCROLL } = require("./data/bounty");
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

// Pure, and exported: the roster is the part of the panel worth checking, and
// buildPanel cannot be exercised without a database.
function describeRoster(chars, byChar = {}) {
  const lines = [];
  const total = { potion: 0, box: 0, scroll: {} };
  let open = 0;
  let done = 0;

  // Grouped by game account, because that is the question the roster answers:
  // characters on one account cannot run at the same time. With the account as
  // a heading it stops being repeated on every line.
  //
  // One group is not a grouping, so a roster with a single account — or none
  // recorded yet — gets no headings at all.
  const byAccount = new Map();
  for (const c of chars) {
    const key = c.account || "";
    if (!byAccount.has(key)) byAccount.set(key, []);
    byAccount.get(key).push(c);
  }
  const headed = byAccount.size > 1;

  for (const [account, members] of byAccount) {
    if (headed) lines.push("", `\`account ${account || "—"}\``);
    members.forEach((c, i) => {
      const charWeek = byChar[c.name];
      const board = charWeek?.board || [];
      // A blank line between characters, but not straight after a heading.
      if (!headed || i > 0) lines.push("");
      lines.push(`**${c.name}** · ${c.role || "no role"} · ${DPS_TIERS[c.dpsTier] || "no DPS tier"}`);

      if (!board.length) return lines.push("_no quest_");

      // No claim count. Joining a 3-stack spends 3 claims even on a character
      // holding nothing, and a party formed outside the panel never tells the
      // bot — so the number is always too high, which is the direction that
      // makes someone plan a run they cannot claim.
      board.forEach((q) => {
        lines.push(`${q.runId ? "✓" : "○"} ${questLabel(q)}`);
        if (q.runId) done++;
        else open++;
      });
      const t = tally(charWeek);
      total.potion += t.potion;
      total.box += t.box;
      for (const [k, n] of Object.entries(t.scroll)) total.scroll[k] = (total.scroll[k] || 0) + n;
    });
  }

  return { lines, earned: renderTally(total), open, done };
}

// Characters with nothing recorded still appear — this is the roster view as
// well as the week view, and "which of my characters did I forget" is exactly
// the question it exists to answer.
async function buildPanel(ownerId) {
  const [chars, doc] = await Promise.all([getChars(ownerId), getBountyWeek(ownerId, weekKey())]);
  const byChar = doc?.chars || {};

  const { lines, earned, open, done } = describeRoster(chars, byChar);
  lines.unshift(`<@${ownerId}>`);
  if (!chars.length) lines.push("", "Belum ada karakter. Mulai dari **➕ Add Character**.");

  // The invite waits HERE rather than arriving as a message. A DM can be closed
  // and a public post would announce someone's second account to the guild —
  // the one thing a second account is usually for.
  for (const from of incomingLinks(ownerId))
    lines.push("", `🔗 <@${from}> mengajak link akun. Roster kalian jadi satu.`);
  if (bountyLinkRequests[ownerId])
    lines.push("", `🔗 Menunggu persetujuan <@${bountyLinkRequests[ownerId]}>.`);

  const group = linkedTo(ownerId).filter((id) => id !== ownerId);
  if (group.length) lines.push("", `🔗 Ter-link: ${group.map((id) => `<@${id}>`).join(" · ")}`);
  if (earned) lines.push("", `**Earned this week:** ${earned}`);

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
    components: panelRows(ownerId, chars.length > 0, open, done),
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
// The link row only exists when there is something to decide, so the panel does
// not carry a button for a once-in-a-lifetime action every day of the year.
function linkRow(ownerId) {
  const pending = incomingLinks(ownerId);
  if (pending.length)
    return new ActionRowBuilder().addComponents(
      BUTTON(ownerId, `approve:${pending[0]}`, "✅ Accept link", ButtonStyle.Success),
      BUTTON(ownerId, `decline:${pending[0]}`, "✖️ Decline", ButtonStyle.Secondary),
    );
  if (bountyLinkRequests[ownerId])
    return new ActionRowBuilder().addComponents(
      BUTTON(ownerId, "cancel", "🔗 Cancel invite", ButtonStyle.Secondary),
    );
  if (linkedTo(ownerId).length > 1)
    return new ActionRowBuilder().addComponents(
      BUTTON(ownerId, "unlink", "🔓 Unlink account", ButtonStyle.Danger),
    );
  return new ActionRowBuilder().addComponents(
    BUTTON(ownerId, "link", "🔗 Link account", ButtonStyle.Secondary),
  );
}

const panelRows = (ownerId, hasChars, open = 0, done = 0) => [
  new ActionRowBuilder().addComponents(
    BUTTON(ownerId, "add", "➕ Add Character", ButtonStyle.Success),
    BUTTON(ownerId, "edit", "✏️ Edit", ButtonStyle.Secondary, !hasChars),
    BUTTON(ownerId, "remove", "🗑️ Remove", ButtonStyle.Secondary, !hasChars),
    // Moved off the quest row to make room there. Five is the limit, and the
    // row that only touches quests is the one worth keeping whole.
    BUTTON(ownerId, "refresh", "🔄 Refresh Panel", ButtonStyle.Secondary),
  ),
  new ActionRowBuilder().addComponents(
    BUTTON(ownerId, "quest", "🎯 Add quest", ButtonStyle.Primary, !hasChars),
    BUTTON(ownerId, "replace", "♻️ Edit quest", ButtonStyle.Secondary, !hasChars),
    // Nothing open means nothing to finish, and nothing finished means nothing
    // to take back — a live button for either would only ever say "none".
    BUTTON(ownerId, "done", "✅ Mark done", ButtonStyle.Secondary, !open),
    BUTTON(ownerId, "undo", "↩️ Undo", ButtonStyle.Secondary, !done),
    // Deleting is the only one that destroys anything, so it is the only red
    // button here — and it offers open quests only, same list as Mark done.
    BUTTON(ownerId, "drop", "🗑️ Remove quest", ButtonStyle.Danger, !open),
  ),
  linkRow(ownerId),
];

// ── Modals ───────────────────────────────────────────────────────────────────

const pick = (id, label, options, required = true) =>
  new LabelBuilder().setLabel(label).setStringSelectMenuComponent(
    new StringSelectMenuBuilder()
      .setCustomId(id)
      .setRequired(required)
      .setPlaceholder(required ? "Select" : "Optional")
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
    ? [pick("account", "Game account", accounts.map((a) => ({ label: a, value: a })), false)]
    : []),
  text("accountNew", accounts.length ? "…or type new account" : "Game account (optional)", false, "e.g. 1, 2, alt"),
];

const accountsOf = (chars) => [...new Set(chars.map((c) => c.account).filter(Boolean))];

const addModal = (ownerId, chars) =>
  modal(ownerId, "add", "Add Character",
    text("name", "Character name", true, "ChelseaQT"),
    pick("role", "Role", roleOpts()),
    pick("dps", "DPS tier", dpsOpts()),
    ...accountFields(accountsOf(chars)));

// Every field but the character is optional: leaving one alone keeps its old
// value, which is what makes this an edit rather than a re-entry.
const editModal = (ownerId, chars) =>
  modal(ownerId, "edit", "Edit Character",
    pick("char", "Character", charOpts(chars)),
    pick("role", "New role", roleOpts(), false),
    pick("dps", "New DPS tier", dpsOpts(), false),
    ...accountFields(accountsOf(chars)));

const linkModal = (ownerId) =>
  new ModalBuilder()
    .setCustomId(`${PREFIX}link:${ownerId}`)
    .setTitle("Link account")
    .setLabelComponents(
      new LabelBuilder()
        .setLabel("Your other Discord account")
        .setDescription("Mereka yang memutuskan — undangannya menunggu di panel mereka.")
        .setUserSelectMenuComponent(new UserSelectMenuBuilder().setCustomId("who")),
    );

const removeModal = (ownerId, chars) =>
  modal(ownerId, "remove", "Remove Character", pick("char", "Character", charOpts(chars)));

// ── Routing ──────────────────────────────────────────────────────────────────

// The buttons sit on a message anyone with Manage Threads can see, and Discord
// scopes no permission to a button. Without this check a moderator pressing
// "Tambah karakter" on someone else's panel would write to their OWN roster
// while the panel redrew the other person's — nothing leaks, and nothing makes
// sense either.
// The owner is the LAST segment, never the second: some actions carry an
// argument ("approve:<whoever asked>"), and reading position 2 would have made
// the guard compare against the wrong person entirely.
function owner(interaction) {
  const parts = interaction.customId.split(":");
  return {
    action: parts.slice(1, -1).join(":"),
    ownerId: parts[parts.length - 1],
    mine: interaction.user.id === parts[parts.length - 1],
  };
}

async function handlePanelButton(interaction) {
  const { action, ownerId, mine } = owner(interaction);
  if (!mine) return ephemeral(interaction, "Ini panel orang lain — bikin punyamu sendiri dengan `/bounty-me`.");

  // The panel may be sitting in a thread that archived itself. Editing a
  // message in one fails, so the panel would look fine and refuse to change.
  await require("./bountyThread").wake(interaction.channel);

  if (action === "refresh") return interaction.update(await buildPanel(ownerId));

  // Linking. Approving is the ONLY one that needs the other person, and it is
  // the invited account pressing it — which is the whole consent story.
  const [verb, arg] = action.split(":");
  if (verb === "done" || verb === "undo" || verb === "drop") {
    const mark = require("./handlers/selectMenus/bountyMark");
    const { rows, count } = await mark.buildMarkRows(ownerId, verb);
    if (!count) return ephemeral(interaction, mark.LIST[verb].empty);
    return interaction.reply({
      content: mark.LIST[verb].prompt,
      components: rows,
      flags: MessageFlags.Ephemeral,
    });
  }
  if (verb === "link") return interaction.showModal(linkModal(ownerId));
  if (verb === "cancel" || verb === "unlink" || verb === "decline" || verb === "approve") {
    if (verb === "cancel") cancelLink(ownerId);
    else if (verb === "unlink") unlink(ownerId);
    else if (verb === "decline") cancelLink(arg);
    else approveLink(arg, ownerId);
    return interaction.update(await buildPanel(ownerId));
  }

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
  await require("./bountyThread").wake(interaction.channel);

  if (action === "link") {
    // A Collection, not an array — `[0]` on it is always undefined, which read
    // as "you picked nobody" however carefully you picked.
    const to = interaction.fields.getSelectedUsers("who")?.first();
    const problem = to ? requestLink(ownerId, to.id) : "Belum pilih akun.";
    await interaction.update(await buildPanel(ownerId));
    if (problem) return interaction.followUp({ content: `❌ ${problem}`, flags: MessageFlags.Ephemeral });
    // Best effort only. The invite already waits on their panel, so a closed DM
    // costs a notification and nothing else.
    await to
      .send(`🔗 <@${ownerId}> mengajak link akun bounty. Buka panelmu (\`/bounty-me\`) buat setuju atau tolak.`)
      .catch(() => {});
    return interaction.followUp({
      content: `🔗 Undangan menunggu di panel <@${to.id}>.`,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  }

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

  // The same person can have two panels open: this one, and the permanent one
  // in their thread. Whichever was not just updated is now showing stale data
  // in the place they go to trust it.
  await require("./bountyThread")
    .refreshThread(interaction.client, ownerId, interaction.message?.id)
    .catch((err) => console.error(`❌ refreshThread (${ownerId}):`, err.message));

  if (proxy.box.content)
    return interaction.followUp({ content: proxy.box.content, flags: MessageFlags.Ephemeral });
}

module.exports = {
  buildPanel, handlePanelButton, handlePanelModal, PREFIX,
  // Pure functions of (ownerId, roster) — the modal shape depends on the
  // roster, so that relationship is worth checking directly.
  addModal, editModal, describeRoster, panelRows,
};
