---
name: report-to-mewmori
description: Report a Codex task lifecycle to the local Mewmori app when the user asks Mewmori to follow, track, or notify them about the task.
---

# Report a task to Mewmori

Use the `report_task_event` tool only when the user explicitly asks Mewmori to follow, track, or notify them about the current Codex task.

1. Generate one stable opaque `task_id` for the task and reuse it for every report.
2. At the beginning, report `started` with a short user-visible title.
3. At the end, report `completed` with a concise result summary, or `failed` with a concise description of what remains blocked.
4. Keep the title under 160 characters and the summary under 500 characters.

Never include the user's prompt, terminal output, commands, diffs, file paths, file contents, source code, tokens, credentials, environment variables, or other secrets. Do not infer or report intermediate progress. If a safe summary cannot be written without private data, omit it.
