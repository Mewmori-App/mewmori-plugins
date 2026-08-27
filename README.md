# Mewmori Plugins

The community plugin catalog for [Mewmori](https://mewmori.com/), the local-first desktop cat for macOS.

This repository is where developers publish Mewmori plugins through pull requests. Every accepted plugin is visible, versioned, and checked by the same automated validation before it enters the catalog.

> [!WARNING]
> Mewmori plugins are ordinary Node.js programs that run with your user account's permissions. They are not an operating-system sandbox. Review a plugin's source code, declared permissions, and network hosts before installing it.

## Available plugins

| Plugin | What it does | Network access |
| --- | --- | --- |
| [Telegram](plugins/mewmori.telegram) | Connects one user-owned Telegram bot and one explicitly paired private chat. | `api.telegram.org` |
| [Codex](plugins/mewmori.codex) | Receives privacy-limited task lifecycle events from the companion Codex plugin. | None |

The machine-readable catalog is available in [`registry.json`](registry.json).

## Install a plugin

Plugin support is available in the direct-distribution build of Mewmori. It is intentionally excluded from the Mac App Store build.

1. Download or clone this repository.
2. Open **Assistant Center → Integrations** in Mewmori.
3. Enable **Developer Mode**.
4. Choose **Install from local folder** and select a directory under `plugins/`.
5. Review the requested permissions and settings before enabling the connection.

Git installation requires a repository whose root is one plugin. The community catalog is a monorepo, so install catalog entries from a local checkout until native catalog installation lands in Mewmori.

## Publish your plugin

1. Copy [`template/`](template) to `plugins/<your.plugin.id>/`.
2. Keep the directory name identical to the manifest `id`.
3. Implement the JSON-RPC entrypoint and declare every permission, host, and setting.
4. Run `npm test` with Node.js 22 or newer.
5. Open a pull request using the plugin submission template.

Read [CONTRIBUTING.md](CONTRIBUTING.md) for the review criteria and protocol details. Submitting a plugin does not guarantee acceptance. Plugins that conceal behavior, collect unnecessary data, execute downloaded code, or broaden permissions without a clear user benefit will not be accepted.

## Plugin contract

A plugin directory must contain:

```text
plugins/example.weather/
├── mewmori-plugin.json
├── store.json
├── README.md
└── dist/
    └── index.mjs
```

Mewmori starts the declared `.mjs` entrypoint as a managed Node.js process and communicates through newline-delimited JSON-RPC 2.0 over stdin/stdout. The current host API version is `1`.

Supported permissions are `activities`, `commands`, `network`, and `secureStorage`. Secret settings are stored by Mewmori in Keychain. A manifest declaration makes access reviewable; it does not enforce an OS sandbox.

## License

The catalog, templates, and bundled reference plugins are licensed under the [Apache License 2.0](LICENSE). A submitted plugin may use another OSI-approved license when its `store.json` identifies that license and the plugin directory includes the corresponding license text.
