import "dotenv/config";
const secret = process.env["SYNC_SECRET"];
if (!secret || secret.length < 32)
  throw new Error("Configure SYNC_SECRET before running the worker");
const base = process.env["PUBLIC_APP_URL"] || "http://localhost:8081";
const interval = Math.max(120, Number(process.env["WORKER_INTERVAL_SECONDS"]) || 3600) * 1000;
async function tick() {
  try {
    const response = await fetch(base + "/api/admin/sync", {
      method: "POST",
      headers: { Authorization: "Bearer " + secret, "Content-Type": "application/json" },
      body: JSON.stringify({ job: "auto" }),
      signal: AbortSignal.timeout(180000),
    });
    const result = (await response.json()) as {
      data?: { status?: string };
      error?: { code?: string };
    };
    console.log(
      new Date().toISOString(),
      response.status,
      result.data?.status || result.error?.code,
    );
  } catch {
    console.error(new Date().toISOString(), "Sync endpoint unavailable");
  }
  setTimeout(tick, interval);
}
await tick();
