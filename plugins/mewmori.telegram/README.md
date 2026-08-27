# Telegram for Mewmori

Connect one user-owned Telegram bot to Mewmori through Telegram's official Bot API. The plugin accepts exactly one private chat after an explicit pairing code.

## Setup

1. Create a bot with Telegram's official BotFather.
2. Install this plugin in Mewmori and enter the bot token in the secret setting.
3. Start the connection and copy the one-time pairing command shown by Mewmori.
4. Send that exact command to your bot from the private chat you want to pair.

The first private chat that submits the correct code becomes the only accepted chat. Reinstall the plugin to remove its connection, secret, history, and local state before pairing another chat.

## Permissions and data

- `activities`: adds incoming messages and connection status to Mewmori's encrypted integration history.
- `commands`: accepts a manually reviewed reply from Mewmori.
- `network`: connects only to `api.telegram.org`.
- `secureStorage`: receives the bot token from Mewmori's Keychain-backed secret setting.

The plugin stores only the paired numeric chat ID, Telegram update offset, and temporary pairing code in its private data directory. The bot token is never written there. Incoming messages do not automatically create memories, tasks, or automations. Sending a reply requires a separate user action after reviewing the draft.
