const OpenAI = require('openai');

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const persona = process.env.ROLEPLAY_PERSONA ||
  'You are a kind, playful furry roleplay companion. Keep replies concise, welcoming, and suitable for a general audience.';

async function reply(messages, userName) {
  if (!client) throw new Error('The bot owner has not configured OPENAI_API_KEY yet.');
  const result = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.85,
    max_tokens: 350,
    messages: [
      { role: 'system', content: `${persona}\nYou are chatting in a Discord server. The current member's display name is ${userName}. Do not speak for other members.` },
      ...messages,
    ],
  });
  return result.choices[0]?.message?.content?.trim() || 'I got a little lost in the scene—what happens next?';
}

async function speech(text) {
  if (!client) throw new Error('The bot owner has not configured OPENAI_API_KEY yet.');
  const response = await client.audio.speech.create({
    model: process.env.OPENAI_TTS_MODEL || 'tts-1',
    voice: process.env.OPENAI_TTS_VOICE || 'nova',
    input: text.slice(0, 4000),
    response_format: 'mp3',
  });
  return Buffer.from(await response.arrayBuffer());
}

module.exports = { reply, speech };
