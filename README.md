# Furry Roleplay Discord Bot

A Discord.js bot that offers friendly furry roleplay chat in a configured text channel and its threads, plus optional text-to-speech in voice chat for members who prefer typing.

## Commands

- `/setup [channel] [auto_tts]` — Server managers enable AI replies in a text channel. Replies in threads under that channel are included. `auto_tts` defaults to off.
- `/tts text` — Reads your supplied text in the voice channel you have joined.
- `/test` — Reports whether the bot and AI credentials are set up.
- `/help` — Shows the command guide.
- `/ping` — Shows Discord gateway latency.

## Setup

1. Create a Discord application and bot in the Discord Developer Portal. Under **Bot**, enable **Message Content Intent** and **Server Members Intent** is not needed. Invite it with `bot` and `applications.commands` scopes. Give it View Channels, Send Messages, Read Message History, Send Messages in Threads, Connect, and Speak permissions.
2. Copy `.env.example` to `.env`. Fill in `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, and `OPENAI_API_KEY`. The AI key is used for both replies and speech generation.
3. Install Node.js 20 or newer, then run `npm install`.
4. Register slash commands with `npm run register`. To register just in a test server, put its ID in `DISCORD_GUILD_ID`; remove it later for global registration.
5. Start the bot with `npm start`.
6. In Discord, a server manager runs `/setup` in the chosen channel. Members can chat by posting normally in that channel or one of its threads. Members join voice and use `/tts` when they want their typed words spoken.

## Deploy on Render

This is a **background worker**, which is the correct Render service type for a Discord bot that stays connected to Discord and does not serve a website.

1. Put this project folder at the root of a GitHub repository. Keep `render.yaml` at the repository root.
2. In Render, choose **New + → Blueprint**, connect that repository, and select **Apply**.
3. In the Blueprint prompts, enter `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, and `OPENAI_API_KEY`. These are secrets; do not put real values in the repository. Keep the optional `DISCORD_GUILD_ID` empty for global commands, or set it locally in `.env` while testing in one server.
4. Render installs packages, registers the slash commands, and starts the bot. Global commands can take a while to appear in Discord.
5. Invite the bot with the `bot` and `applications.commands` scopes. Grant View Channels, Send Messages, Read Message History, Send Messages in Threads, Connect, and Speak permissions. Enable **Message Content Intent** in the Discord Developer Portal.
6. After the deploy is live, a server manager runs `/setup` in the text channel. The Blueprint includes a persistent disk for saved server settings.

The worker uses Render's paid `0.5c-512mb` compute plan because persistent disks are available on paid services. You can remove the `disk` block to use ephemeral storage, but saved `/setup` settings will then be lost whenever Render replaces or restarts the worker.

## Notes

- Chat is general-audience furry roleplay, not explicit roleplay. Adjust `ROLEPLAY_PERSONA` to change the character style.
- Automatic TTS is disabled by default. If enabled with `/setup`, bot replies are spoken only when the member who triggered the reply is in a voice channel.
- Audio uses Discord voice and an external speech API. The bot does not listen to or transcribe people in voice chat.
- Keep bot and AI API keys private. Do not commit `.env`.
