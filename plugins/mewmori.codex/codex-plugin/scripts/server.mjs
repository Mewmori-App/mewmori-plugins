import { mkdir, open } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import readline from "node:readline";

const inboxPath = join(
  homedir(),
  "Library",
  "Application Support",
  "Mewmori",
  "Integrations",
  "Inbox",
  "codex.ndjson",
);

const tool = {
  name: "report_task_event",
  description:
    "Reports only a Codex task title, lifecycle status, and short user-safe summary to the local Mewmori app.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["task_id", "title", "status"],
    properties: {
      task_id: {
        type: "string",
        minLength: 1,
        maxLength: 128,
        description: "Stable opaque ID reused for every event of one task.",
      },
      title: {
        type: "string",
        minLength: 1,
        maxLength: 160,
        description: "Short user-visible task title without paths or secrets.",
      },
      status: {
        type: "string",
        enum: ["started", "completed", "failed"],
      },
      summary: {
        type: "string",
        maxLength: 500,
        description: "Optional user-safe result summary. Never include prompts, logs, diffs, file contents, or secrets.",
      },
    },
  },
};

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function result(id, value) {
  send({ jsonrpc: "2.0", id, result: value });
}

function error(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

function safeString(value, maximum) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maximum) return null;
  return trimmed;
}

function validateEvent(argumentsValue) {
  if (!argumentsValue || typeof argumentsValue !== "object" || Array.isArray(argumentsValue)) {
    throw new Error("Arguments must be an object.");
  }

  const taskID = safeString(argumentsValue.task_id, 128);
  const title = safeString(argumentsValue.title, 160);
  const summary = argumentsValue.summary === undefined
    ? null
    : safeString(argumentsValue.summary, 500);
  const status = argumentsValue.status;

  if (!taskID || !title || !["started", "completed", "failed"].includes(status)) {
    throw new Error("task_id, title, or status is invalid.");
  }
  if (argumentsValue.summary !== undefined && summary === null) {
    throw new Error("summary is invalid.");
  }

  return {
    taskID,
    title,
    status,
    summary,
    occurredAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  };
}

async function appendEvent(event) {
  await mkdir(dirname(inboxPath), { recursive: true, mode: 0o700 });
  const file = await open(inboxPath, "a", 0o600);
  try {
    await file.write(`${JSON.stringify(event)}\n`);
  } finally {
    await file.close();
  }
}

async function handle(request) {
  if (!request || request.jsonrpc !== "2.0") return;

  if (request.method === "initialize") {
    result(request.id, {
      protocolVersion: "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "mewmori-codex", version: "0.1.0" },
    });
    return;
  }

  if (request.method === "notifications/initialized") return;

  if (request.method === "tools/list") {
    result(request.id, { tools: [tool] });
    return;
  }

  if (request.method === "tools/call") {
    if (request.params?.name !== tool.name) {
      error(request.id, -32602, "Unknown tool.");
      return;
    }

    try {
      const event = validateEvent(request.params.arguments);
      await appendEvent(event);
      result(request.id, {
        content: [{ type: "text", text: `Mewmori received the ${event.status} status.` }],
      });
    } catch (caught) {
      error(request.id, -32602, caught instanceof Error ? caught.message : "Invalid arguments.");
    }
    return;
  }

  if (request.id !== undefined) error(request.id, -32601, "Method not found.");
}

const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of lines) {
  if (!line.trim()) continue;
  try {
    await handle(JSON.parse(line));
  } catch {
    // Invalid input is not copied to stderr because it may contain private data.
  }
}
