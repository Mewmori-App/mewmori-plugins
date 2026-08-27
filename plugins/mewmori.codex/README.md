# Codex for Mewmori

Receive user-approved Codex task lifecycle events in Mewmori. The Mewmori connection is passive; the included companion Codex plugin writes events to a local inbox that Mewmori imports into encrypted integration history.

## Setup

1. Install this Mewmori plugin and enable its connection.
2. Install the companion under [`codex-plugin/`](codex-plugin) in Codex.
3. Explicitly ask Codex to have Mewmori follow, track, or notify you about a task.

## Permissions and data

The Mewmori plugin declares only `activities` and makes no network requests. The companion accepts a stable opaque task ID, a title, a lifecycle status (`started`, `completed`, or `failed`), an optional short summary, and a timestamp.

Prompts, terminal output, commands, diffs, file paths, file contents, source code, environment variables, and secrets are prohibited by both the companion tool schema and its skill instructions. Mewmori retains imported events in encrypted local history until the user deletes them.
