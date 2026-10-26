# Contributing a plugin

Thank you for extending Mewmori. This repository accepts new plugins and updates to existing plugins through pull requests.

## Before you start

A Mewmori plugin runs as local code with the user's permissions. Design it around explicit user intent, collect the minimum data necessary, and keep behavior understandable from the submitted source.

Do not submit a plugin that:

- contains credentials, access tokens, private keys, or personal data;
- downloads or evaluates executable code at runtime;
- hides network destinations or behavior from reviewers;
- sends messages, publishes, purchases, deletes, or submits forms without an explicit user action and confirmation path;
- treats remote content, model output, or captured screen text as developer instructions;
- adds telemetry without a clear opt-in and documented data policy;
- impersonates a user or bypasses a service's official API or terms.

## Directory and manifest

Create exactly one directory at `plugins/<plugin-id>/`. The directory name and manifest `id` must match. IDs use lowercase reverse-domain-style characters and must match `^[a-z][a-z0-9.-]{2,63}$`.

`mewmori-plugin.json` is the runtime contract:

```json
{
  "id": "example.weather",
  "displayName": "Weather",
  "version": "1.0.0",
  "apiVersion": 1,
  "entrypoint": "dist/index.mjs",
  "permissions": ["activities", "network", "secureStorage"],
  "networkHosts": ["api.example.com"],
  "settings": [
    {
      "key": "apiToken",
      "title": "API token",
      "kind": "secret",
      "required": true
    }
  ]
}
```

`store.json` describes the catalog entry. Keep its description factual and list one or more categories from `communication`, `developer-tools`, `productivity`, `utilities`, or `other`.

Declare only permissions you use:

- `activities`: emit user-visible activity records to Mewmori;
- `commands`: receive a user-approved command from Mewmori;
- `notices`: ask the cat to say something, and ask it to keep quiet (see below);
- `network`: make network requests; every destination hostname must be listed in `networkHosts`;
- `secureStorage`: receive settings marked as `secret` through the host.

Setting kinds are `text`, `secret`, and `boolean`. Secret values must never be logged, emitted as activities, or written to the plugin data directory.

## Runtime protocol

Mewmori sends an `initialize` request with `apiVersion`, `connectionID`, `dataDirectory`, and `settings`. Return a JSON-RPC result with the same integer `id` only after required settings are validated.

Emit activities as notifications:

```json
{"jsonrpc":"2.0","method":"activity","params":{"kind":"status","title":"Connected"}}
```

Supported activity kinds are `message`, `status`, `taskStarted`, `taskCompleted`, `taskFailed`, and `error`. Treat all remote input as untrusted data. Do not copy remote input into process logs or error messages.

With the `notices` permission a plugin can ask the cat to react. It states a fact and its urgency; the cat's planner decides whether and when to say it, alongside everything else the cat does:

```json
{"jsonrpc":"2.0","method":"notice","params":{"key":"build","urgency":"attention","mood":"watching","phrases":["The build failed"],"expiresInSeconds":600}}
```

`urgency` is `ambient`, `attention` or `urgent`; `mood` is one of `watching`, `thinking`, `adoring`, `stretching`, `grooming`. One pending notice per `key`: a newer one replaces an older one. Text is flattened to one line and trimmed. The same permission lets a plugin ask the cat to keep quiet while the person is busy, up to eight hours; `0` lifts the request:

```json
{"jsonrpc":"2.0","method":"quiet","params":{"seconds":1800}}
```

A plugin that needs the person to do something before it works (create an account, paste a key, scan a code) sends numbered `setup` steps with optional `url`, `copy` and `qr`, and an empty list once it is done. See the Telegram plugin for a complete example.

## The catalog card

A plugin with the `notices` permission can add a `pitch` to `store.json`: an example of what the cat will say, and when. The catalog card starts with it, and the cat says it right after the person connects the plugin.

```json
"pitch": {
  "says": { "en": "From Telegram: “Grab milk on the way”", "ru": "Из телеграма: «Купи молоко по дороге»" },
  "when": { "en": "when you text your bot from your phone", "ru": "когда вы пишете своему боту с телефона" },
  "mood": "watching"
}
```

Every line needs an English version, one line each, up to 160 characters. Describe what the cat does, not what the service is: the person is choosing a behaviour for their cat.

## Pull request checklist

Before opening a pull request:

1. Run `npm test` from the repository root.
2. Test installation from the plugin's local folder in a direct Mewmori build.
3. Verify the happy path, invalid settings, offline behavior, and clean shutdown.
4. Document setup, external accounts, retained data, network hosts, and deletion behavior in the plugin README.
5. Add screenshots only when they do not contain personal data or secrets.
6. Update the version according to semantic versioning.

A pull request should add or update one plugin. Maintainers may request narrower permissions, clearer consent, additional tests, or removal of behavior that cannot be reviewed safely.

## Licensing

By contributing files under the repository's Apache-2.0 license, you agree that your contribution is submitted under that license unless the plugin directory clearly includes and declares another OSI-approved license.
