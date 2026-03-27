require("dotenv").config();

const { REST, Routes } = require("discord.js");
const { clientId, guildId, token } = require("./config");

if (!token || !clientId || !guildId) {
  throw new Error("ENV belum lengkap!");
}

const commands = [
  {
    name: "start",
    description: "Mulai raid",
    options: [
      {
        name: "event",
        type: 3, // STRING
        description: "Pilih event",
        required: true,
        choices: [
          { name: "GDN HC", value: "gdn_hc" },
          { name: "GDN CL", value: "gdn_cl" },
        ],
      },
    ],
  },
];

const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commands,
  });
  console.log("Slash command berhasil didaftarkan!");
})();
