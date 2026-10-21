import "dotenv/config";
import { readFile } from "node:fs/promises";
const [command = "health", argument] = process.argv.slice(2);
const base = process.env["PUBLIC_APP_URL"] || "http://localhost:8081";
let path = "/api/admin/health";
let body: string | undefined;
let token = process.env["ADMIN_TOKEN"];
if (command === "sync") {
  path = "/api/admin/sync";
  body = JSON.stringify({ job: argument || "auto" });
  token = process.env["SYNC_SECRET"] || token;
} else if (command === "inspect" && argument)
  path = "/api/admin/ipos/" + encodeURIComponent(argument);
else if (command === "search") path = "/api/ipos?q=" + encodeURIComponent(argument || "");
else if (command === "correct" && argument) {
  path = "/api/admin/corrections";
  body = await readFile(argument, "utf8");
} else if (command !== "health")
  throw new Error(
    "Usage: npm run admin -- health|search <name>|inspect <slug>|sync <job>|correct <file.json>",
  );
if (path.includes("/admin/") && !token) throw new Error("Operator token is not configured");
const response = await fetch(base + path, {
  method: body ? "POST" : "GET",
  headers: { Authorization: "Bearer " + (token || ""), "Content-Type": "application/json" },
  ...(body ? { body } : {}),
  signal: AbortSignal.timeout(180000),
});
console.log(JSON.stringify(await response.json(), null, 2));
if (!response.ok) process.exitCode = 1;
