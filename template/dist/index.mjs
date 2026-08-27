import { createInterface } from "node:readline";

const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);

createInterface({ input: process.stdin, crlfDelay: Infinity }).on("line", (line) => {
  try {
    const request = JSON.parse(line);
    if (request?.jsonrpc !== "2.0" || !Number.isInteger(request.id)) return;

    if (request.method === "initialize") {
      send({ jsonrpc: "2.0", id: request.id, result: {} });
      send({
        jsonrpc: "2.0",
        method: "activity",
        params: { kind: "status", title: "Example Plugin connected" },
      });
      return;
    }

    send({
      jsonrpc: "2.0",
      id: request.id,
      error: { code: -32601, message: "Method not found" },
    });
  } catch {
    // Ignore malformed input without logging potentially private content.
  }
});
