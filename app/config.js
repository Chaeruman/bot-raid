require("dotenv").config();

module.exports = {
  token: process.env.TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  threadChannelId: process.env.THREAD_CHANNEL_ID,
  forumTagHC: process.env.FORUM_TAG_HC,
  forumTagCL: process.env.FORUM_TAG_CL,
  forumTagDDN: process.env.FORUM_TAG_DDN,
  forumTagMarathonGDN: process.env.FORUM_TAG_MARATHON_GDN,
  forumTagMarathonDDN: process.env.FORUM_TAG_MARATHON_DDN,
  renderUrl: process.env.RENDER_URL,
  port: process.env.PORT || 3000,
};
