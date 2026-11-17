require('dotenv').config();
const { Readable } = require('node:stream');
const {
  Client, GatewayIntentBits, Events, EmbedBuilder, ChannelType,
} = require('discord.js');
const {
  joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus,
  VoiceConnectionStatus, entersState,
} = require('@discordjs/voice');
const configStore = require('./config-store');
const ai = require('./ai');

if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN is required. Copy .env.example to .env and fill in your bot token.');
  process.exit(1);
}

const client = new Client({ intents: [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildVoiceStates,
] });
const replyLocks = new Set();
const voiceConnections = new Map();
const botName = process.env.ROLEPLAY_NAME || 'Fern';

client.once(Events.ClientReady, readyClient => {
  console.log(`Ready as ${readyClient.user.tag}`);
});

function isConfiguredChannel(message, settings) {
  const parentId = message.channel.isThread() ? message.channel.parentId : message.channel.id;
  return parentId === settings.textChannelId;
}

function splitMessage(text, max = 1900) {
  const chunks = [];
  while (text.length > max) {
    let at = text.lastIndexOf('\n', max);
    if (at < max * 0.55) at = text.lastIndexOf(' ', max);
    if (at < max * 0.55) at = max;
    chunks.push(text.slice(0, at));
    text = text.slice(at).trimStart();
  }
  if (text) chunks.push(text);
  return chunks;
}

async function sayInVoice(guild, voiceChannel, text) {
  if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) throw new Error('Join a regular voice channel first.');
  const existing = voiceConnections.get(guild.id);
  const connection = existing?.joinConfig.channelId === voiceChannel.id ? existing : joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
  });
  voiceConnections.set(guild.id, connection);
  connection.on(VoiceConnectionStatus.Disconnected, () => {
    voiceConnections.delete(guild.id);
    try { connection.destroy(); } catch {}
  });
  await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
  const buffer = await ai.speech(text);
  const player = createAudioPlayer();
  connection.subscribe(player);
  const resource = createAudioResource(Readable.from([buffer]), { inlineVolume: false });
  player.play(resource);
  await new Promise((resolve, reject) => {
    player.once(AudioPlayerStatus.Idle, resolve);
    player.once('error', reject);
  });
}

client.on(Events.MessageCreate, async message => {
  if (!message.guild || message.author.bot) return;
  const settings = configStore.get(message.guild.id);
  if (!settings || !isConfiguredChannel(message, settings)) return;
  const key = `${message.guild.id}:${message.channel.id}`;
  if (replyLocks.has(key)) return;
  replyLocks.add(key);
  try {
    await message.channel.sendTyping();
    let history = [];
    try {
      const recent = await message.channel.messages.fetch({ limit: 12, before: message.id });
      history = [...recent.values()].reverse()
        .filter(m => (m.author.id === client.user.id || !m.author.bot) && m.content.trim())
        .map(m => m.author.id === client.user.id
          ? { role: 'assistant', content: m.content.slice(0, 1500) }
          : { role: 'user', content: `${m.member?.displayName || m.author.username}: ${m.content.slice(0, 1500)}` });
    } catch { /* The bot can still answer if it cannot read older messages. */ }
    history.push({ role: 'user', content: `${message.member?.displayName || message.author.username}: ${message.content.slice(0, 1500)}` });
    const answer = await ai.reply(history, message.member?.displayName || message.author.username);
    for (const chunk of splitMessage(answer)) await message.channel.send(chunk);

    if (settings.autoTts && message.member?.voice?.channel) {
      try { await sayInVoice(message.guild, message.member.voice.channel, answer); }
      catch (error) { console.error('Automatic TTS failed:', error.message); }
    }
  } catch (error) {
    console.error('Chat reply failed:', error);
    await message.reply('I could not answer just now. The server owner may need to check the AI setup.').catch(() => {});
  } finally {
    replyLocks.delete(key);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  try {
    if (interaction.commandName === 'setup') {
      if (!interaction.guild) return interaction.reply({ content: 'Run this in your server.', ephemeral: true });
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
        return interaction.reply({ content: 'Choose a server text channel, or run /setup in one.', ephemeral: true });
      }
      const autoTts = interaction.options.getBoolean('auto_tts') ?? false;
      configStore.set(interaction.guild.id, { textChannelId: channel.id, autoTts });
      return interaction.reply({
        content: `🐾 ${botName} is ready in <#${channel.id}>. Messages in threads under that channel are included. Automatic voice readouts are **${autoTts ? 'on' : 'off'}**. Members can use /tts to speak any time.`,
        ephemeral: true,
      });
    }

    if (interaction.commandName === 'tts') {
      await interaction.deferReply({ ephemeral: true });
      const voiceChannel = interaction.member?.voice?.channel;
      if (!voiceChannel) return interaction.editReply('Join a voice channel first, then run /tts again.');
      const text = interaction.options.getString('text', true);
      await sayInVoice(interaction.guild, voiceChannel, text);
      return interaction.editReply(`🔊 I spoke your message in **${voiceChannel.name}**.`);
    }

    if (interaction.commandName === 'test') {
      const aiReady = Boolean(process.env.OPENAI_API_KEY);
      return interaction.reply({ content: `🤖 Bot is online. AI chat and TTS are ${aiReady ? 'configured' : 'waiting for the owner to add OPENAI_API_KEY'}.`, ephemeral: true });
    }

    if (interaction.commandName === 'help') {
      const embed = new EmbedBuilder()
        .setColor(0x8b5cf6)
        .setTitle(`🐾 ${botName} — furry roleplay chat`)
        .setDescription('Chat with the AI in the server’s chosen channel. Text in threads under that channel works too.')
        .addFields(
          { name: '/setup [channel] [auto_tts]', value: 'Server managers enable AI replies in a text channel. Automatic voice readout is optional and off by default.' },
          { name: '/tts text', value: 'Have the bot speak your text in the voice channel you are currently in.' },
          { name: '/test', value: 'Check whether bot and AI services are ready.' },
          { name: '/ping', value: 'Check response latency.' },
        )
        .setFooter({ text: 'TTS uses an external speech service. Avoid sharing private information.' });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (interaction.commandName === 'ping') {
      return interaction.reply({ content: `🏓 Pong! ${client.ws.ping} ms`, ephemeral: true });
    }
  } catch (error) {
    console.error(`/${interaction.commandName} failed:`, error);
    const message = error.message?.includes('OPENAI_API_KEY')
      ? 'The server owner needs to configure the AI API key before chat and TTS can work.'
      : 'Something went wrong. Please try again in a moment.';
    if (interaction.deferred || interaction.replied) await interaction.editReply(message).catch(() => {});
    else await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
  }
});

client.login(process.env.DISCORD_TOKEN);
