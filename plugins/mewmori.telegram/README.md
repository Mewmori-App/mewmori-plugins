# Telegram for Mewmori

Text your own Telegram bot from your phone, and the cat passes the message on at your Mac.

The plugin talks to one bot you create yourself, through Telegram's official Bot API, and accepts exactly one private chat after an explicit pairing step. Messages never pass through a Mewmori server.

## Setup

Mewmori walks you through it on one screen:

1. Open BotFather, send `/newbot`, and pick a name and a username. The plugin suggests both.
2. Copy the token BotFather sends back and press **Paste token** in Mewmori. The token goes to the Keychain.
3. Open the bot from the link or by scanning the QR code with your phone, and press **Start**.

The first private chat that sends the right one-time code becomes the only accepted chat. Disconnecting in Mewmori removes the token, the pairing, the history and the plugin's local state.

## What the cat does

A message from the paired chat becomes a `notice`: the cat says "From Telegram: …" when its planner gives the topic a turn. If several messages arrive while the cat is busy, it says only the newest one, and a message older than an hour is dropped as stale.

## Permissions and data

- `notices`: asks the cat to say the incoming message.
- `activities`: adds incoming messages and connection status to Mewmori's encrypted history.
- `network`: connects only to `api.telegram.org`.
- `secureStorage`: receives the bot token from Mewmori's Keychain-backed setting.

The plugin stores only the paired numeric chat ID, the Telegram update offset and the temporary pairing code in its private data directory. The token is never written there. Incoming messages are untrusted text: they do not become the cat's memories, tasks or automations, and they never reach a model prompt.
