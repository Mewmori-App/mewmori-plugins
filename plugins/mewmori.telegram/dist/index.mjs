import { createInterface } from "node:readline";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

let token = "";
let dataDirectory = "";
let state = { chatID: null, offset: 0, pairingCode: "" };
let stopped = false;

const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
const succeed = (id, result = {}) => send({ jsonrpc: "2.0", id, result });
const fail = (id, code, message) => send({ jsonrpc: "2.0", id, error: { code, message } });
const activity = (kind, title, body, externalID) => send({
  jsonrpc: "2.0",
  method: "activity",
  params: {
    kind,
    title,
    body: body ?? null,
    externalID: externalID ?? null,
    occurredAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z")
  }
});

const statePath = () => join(dataDirectory, "telegram-state.json");

async function loadState() {
  try {
    const stored = JSON.parse(await readFile(statePath(), "utf8"));
    state = {
      chatID: Number.isSafeInteger(stored.chatID) ? stored.chatID : null,
      offset: Number.isSafeInteger(stored.offset) ? stored.offset : 0,
      pairingCode: typeof stored.pairingCode === "string" ? stored.pairingCode : ""
    };
  } catch {
    state.pairingCode = randomBytes(4).toString("hex").toUpperCase();
    await saveState();
  }
}

async function saveState() {
  await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
  await writeFile(statePath(), JSON.stringify(state), { encoding: "utf8", mode: 0o600 });
}

async function telegram(method, body = {}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(35_000)
  });
  const payload = await response.json();
  if (!response.ok || payload.ok !== true) throw new Error("telegram request failed");
  return payload.result;
}

async function poll() {
  while (!stopped) {
    try {
      const updates = await telegram("getUpdates", {
        offset: state.offset,
        timeout: 25,
        allowed_updates: ["message"]
      });
      for (const update of updates) {
        state.offset = Math.max(state.offset, Number(update.update_id) + 1);
        await handleMessage(update.message);
      }
      await saveState();
    } catch {
      activity("error", "Telegram is temporarily unavailable", null, "telegram:error");
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }
}

async function handleMessage(message) {
  if (!message || message.chat?.type !== "private" || typeof message.text !== "string") return;
  const chatID = Number(message.chat.id);

  if (state.chatID === null) {
    if (message.text.trim().toUpperCase() !== `/START ${state.pairingCode}`) return;
    state.chatID = chatID;
    state.pairingCode = "";
    await saveState();
    await telegram("sendMessage", { chat_id: chatID, text: "Mewmori is connected to this chat." });
    activity("status", "Telegram connected", "The bot accepts messages only from this chat.", null);
    return;
  }

  if (chatID !== state.chatID) return;
  const author = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ") || "Telegram";
  activity(
    "message",
    `Telegram: ${author}`,
    message.text.slice(0, 4000),
    `telegram:${chatID}:${Number(message.message_id)}`
  );
}

async function initialize(id, params) {
  token = params?.settings?.botToken || "";
  dataDirectory = params?.dataDirectory || "";
  if (!token || !dataDirectory) return fail(id, -32602, "missing required settings");
  await loadState();
  if (state.chatID === null) {
    activity("status", "Connect Telegram", `Send this to the bot: /start ${state.pairingCode}`, "telegram:pairing");
  } else {
    activity("status", "Telegram connected", "The bot accepts messages from the paired chat.", "telegram:connected");
  }
  succeed(id);
  void poll();
}

async function reply(id, params) {
  if (state.chatID === null) return fail(id, -32010, "telegram is not paired");
  const match = /^telegram:(-?\d+):(\d+)$/.exec(params?.externalID || "");
  const text = typeof params?.text === "string" ? params.text.trim().slice(0, 4000) : "";
  if (!match || Number(match[1]) !== state.chatID || !text) return fail(id, -32602, "invalid reply");
  await telegram("sendMessage", {
    chat_id: state.chatID,
    text,
    reply_parameters: { message_id: Number(match[2]) }
  });
  activity("status", "Reply sent", null, `telegram:sent:${match[2]}`);
  succeed(id);
}

createInterface({ input: process.stdin, crlfDelay: Infinity }).on("line", async (line) => {
  let request;
  try { request = JSON.parse(line); }
  catch { return; }
  if (request?.jsonrpc !== "2.0" || !Number.isInteger(request.id)) return;
  try {
    if (request.method === "initialize") await initialize(request.id, request.params);
    else if (request.method === "telegram.reply") await reply(request.id, request.params);
    else fail(request.id, -32601, "method not found");
  } catch {
    fail(request.id, -32000, "operation failed");
  }
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => { stopped = true; process.exit(0); });
}
