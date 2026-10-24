// Telegram for Mewmori: text your own bot from your phone, and the cat
// passes the message on at your Mac.
//
// One user-owned bot, one explicitly paired private chat, Telegram's official
// Bot API and nothing else. The plugin never decides when the cat speaks: it
// sends a `notice`, and Mewmori's planner picks the moment.
import { createInterface } from "node:readline";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

let token = "";
let dataDirectory = "";
let russian = false;
let state = { chatID: null, offset: 0, pairingCode: "" };
let stopped = false;

const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
const succeed = (id, result = {}) => send({ jsonrpc: "2.0", id, result });
const fail = (id, code, message) => send({ jsonrpc: "2.0", id, error: { code, message } });
const say = (ru, en) => (russian ? ru : en);

const activity = (kind, title, body, externalID) => send({
  jsonrpc: "2.0",
  method: "activity",
  params: {
    kind,
    title,
    body: body ?? null,
    externalID: externalID ?? null,
    occurredAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  },
});

// The cat says it when the planner gives it a turn. One key for all messages:
// if three arrive while the cat is busy, the newest one is what matters, not a
// queue of three. An hour later the message is no longer news.
const notice = (text) => send({
  jsonrpc: "2.0",
  method: "notice",
  params: {
    key: "message",
    urgency: "attention",
    mood: "watching",
    phrases: [say(`Из телеграма: «${text}»`, `From Telegram: “${text}”`)],
    expiresInSeconds: 60 * 60,
  },
});

const statePath = () => join(dataDirectory, "telegram-state.json");

async function loadState() {
  try {
    const stored = JSON.parse(await readFile(statePath(), "utf8"));
    state = {
      chatID: Number.isSafeInteger(stored.chatID) ? stored.chatID : null,
      offset: Number.isSafeInteger(stored.offset) ? stored.offset : 0,
      pairingCode: typeof stored.pairingCode === "string" ? stored.pairingCode : "",
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
    signal: AbortSignal.timeout(35_000),
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
        allowed_updates: ["message"],
      });
      for (const update of updates) {
        state.offset = Math.max(state.offset, Number(update.update_id) + 1);
        await handleMessage(update.message);
      }
      await saveState();
    } catch {
      activity("error", say("Telegram сейчас недоступен", "Telegram is temporarily unavailable"), null, "telegram:error");
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
    await telegram("sendMessage", {
      chat_id: chatID,
      text: say("Готово. Пишите сюда - кот передаст на маке.", "Done. Write here and the cat passes it on at your Mac."),
    });
    clearSetup();
    activity("status", say("Telegram подключён", "Telegram connected"), say("Бот принимает сообщения только из этого чата.", "The bot accepts messages only from this chat."), null);
    return;
  }

  if (chatID !== state.chatID) return;
  const text = message.text.trim().slice(0, 4000);
  if (!text) return;
  activity("message", "Telegram", text, `telegram:${chatID}:${Number(message.message_id)}`);
  notice(text.slice(0, 160));
}

const setup = (title, steps, awaitSecret) => send({
  jsonrpc: "2.0",
  method: "setup",
  params: { title, steps, awaitSecret: awaitSecret ?? null },
});

const clearSetup = () => send({ jsonrpc: "2.0", method: "setup", params: { steps: [] } });

// Suggested names, so nobody has to invent one at the BotFather prompt. The
// suffix is Telegram's rule, not ours: a bot username must end in "bot".
function suggestedUsername() {
  return `mewmori_${randomBytes(3).toString("hex")}_bot`;
}

// The steps live here rather than in Mewmori because they are Telegram's
// rules: BotFather, the username suffix, the shape of a token. The app only
// knows how to number a list, open a link, copy a string and draw a QR code.
function requestToken() {
  setup(
    say("Заведите своего бота", "Create your own bot"),
    [
      { text: say("Откройте BotFather и отправьте /newbot", "Open BotFather and send /newbot"), url: "https://t.me/BotFather", copy: "/newbot" },
      { text: say("Отправьте имя бота", "Send a name for the bot"), copy: "Mewmori" },
      {
        text: say(
          "Отправьте username - он должен кончаться на bot; если занят, BotFather спросит ещё раз",
          "Send a username - it has to end in bot, and BotFather will ask again if it is taken",
        ),
        copy: suggestedUsername(),
      },
      { text: say("Скопируйте токен, который пришлёт BotFather", "Copy the token BotFather sends back") },
    ],
    // No regular expression on purpose: the app would have to run a pattern
    // that came from another process. Length and a substring are enough to
    // tell a bot token from ordinary clipboard text.
    { key: "botToken", minLength: 40, maxLength: 60, contains: ":" },
  );
}

// Knowing the bot's own username turns "send /start CODE to your bot" into a
// link, and a link into a QR code - which is the case that matters, because
// the phone is not the machine Mewmori runs on.
async function requestPairing() {
  let username = "";
  try {
    username = (await telegram("getMe"))?.username || "";
  } catch {
    // The token is wrong or Telegram is unreachable; poll() reports it.
  }
  if (!username) {
    activity("status", say("Подключите Telegram", "Connect Telegram"), say(`Отправьте боту: /start ${state.pairingCode}`, `Send this to the bot: /start ${state.pairingCode}`), "telegram:pairing");
    return;
  }
  setup(
    say(`Свяжите чат с @${username}`, `Link your chat with @${username}`),
    [
      {
        text: say("Откройте бота и нажмите «Старт» - на этом маке или по QR с телефона", "Open the bot and press Start - on this Mac or by scanning from your phone"),
        url: `https://t.me/${username}?start=${state.pairingCode}`,
        qr: true,
      },
    ],
  );
}

async function initialize(id, params) {
  token = params?.settings?.botToken || "";
  dataDirectory = params?.dataDirectory || "";
  russian = String(params?.locale || "").toLowerCase().startsWith("ru");
  if (!dataDirectory) return fail(id, -32602, "missing data directory");
  // No token is not a failure: it is the state the person starts in, and the
  // plugin's job is to explain the way out of it.
  if (!token) {
    succeed(id);
    requestToken();
    return;
  }
  await loadState();
  succeed(id);
  if (state.chatID === null) {
    await requestPairing();
  } else {
    clearSetup();
  }
  void poll();
}

createInterface({ input: process.stdin, crlfDelay: Infinity }).on("line", async (line) => {
  let request;
  try { request = JSON.parse(line); } catch { return; }
  if (request?.jsonrpc !== "2.0" || !Number.isInteger(request.id)) return;
  try {
    if (request.method === "initialize") await initialize(request.id, request.params);
    else fail(request.id, -32601, "method not found");
  } catch {
    fail(request.id, -32000, "operation failed");
  }
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => { stopped = true; process.exit(0); });
}
