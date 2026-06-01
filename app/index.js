const { Client, GatewayIntentBits, MessageFlags } = require("discord.js");
const config = require("./config");
const { handleCommand } = require("./handlers/commands");
const { handleButton } = require("./handlers/buttons");
const { handleSelectMenu } = require("./handlers/selectMenus");
const { handleModal } = require("./handlers/modals");
const keepAlive = require("./utils/keepAlive");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on("clientReady", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(
    `📌 Thread channel: ${config.threadChannelId || "NOT SET — will use current channel"}`,
  );
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand())
      return await handleCommand(interaction);
    if (interaction.isStringSelectMenu())
      return await handleSelectMenu(interaction);
    if (interaction.isButton())
      return await handleButton(interaction);
    if (interaction.isModalSubmit())
      return await handleModal(interaction);
  } catch (err) {
    console.error(err);
    try {
      const reply = {
        content: "❌ Something went wrong.",
        flags: MessageFlags.Ephemeral,
      };
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply(reply);
      } else if (interaction.deferred) {
        await interaction.editReply(reply);
      }
    } catch {
      /* ignore */
    }
  }
});

client.on("error", console.error);
process.on("unhandledRejection", console.error);

keepAlive.start();
client.login(config.token);
