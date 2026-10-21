import "dotenv/config";
import { getDb, migrate } from "../src/server/db";
try {
  await migrate(await getDb());
  console.log("Database migrations applied.");
  process.exit(0);
} catch (error) {
  console.error("Migration failed:", error instanceof Error ? error.message : "unknown");
  process.exit(1);
}
