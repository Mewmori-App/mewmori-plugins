import { createInterface } from "node:readline";

createInterface({ input: process.stdin, crlfDelay: Infinity }).on("line", (line) => {
  try {
    const request = JSON.parse(line);
    if (request?.jsonrpc === "2.0" && Number.isInteger(request.id)) {
      process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: request.id, result: {} })}\n`);
    }
  } catch {
    // The passive Codex connection is fed by its MCP companion, not this process.
  }
});
