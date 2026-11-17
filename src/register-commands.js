require('dotenv').config();
const { REST, Routes, SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_CLIENT_ID) {
  console.error('Set DISCORD_TOKEN and DISCORD_CLIENT_ID before registering commands.');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('setup').setDescription('Set the furry roleplay chat channel and optional automatic voice replies.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(o => o.setName('channel').setDescription('Text channel for chat (defaults to this channel)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addBooleanOption(o => o.setName('auto_tts').setDescription('Speak bot replies in the chatting member’s voice channel (off by default)')),
  new SlashCommandBuilder()
    .setName('tts').setDescription('Speak your message in your current voice channel.')
    .addStringOption(o => o.setName('text').setDescription('What you want the bot to say').setRequired(true).setMaxLength(1000)),
  new SlashCommandBuilder().setName('test').setDescription('Check that the bot and AI chat are ready.'),
  new SlashCommandBuilder().setName('help').setDescription('Show bot commands and setup instructions.'),
  new SlashCommandBuilder().setName('ping').setDescription('Check the bot response time.'),
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
const route = process.env.DISCORD_GUILD_ID
  ? Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID)
  : Routes.applicationCommands(process.env.DISCORD_CLIENT_ID);

rest.put(route, { body: commands })
  .then(() => console.log(`Registered ${commands.length} slash commands${process.env.DISCORD_GUILD_ID ? ' for the test server' : ' globally'}.`))
  .catch(error => { console.error('Command registration failed:', error); process.exitCode = 1; });
