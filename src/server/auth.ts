import { createHash, timingSafeEqual } from "node:crypto";
import { ServiceError } from "./config";
export function authorize(request: Request, kind: "admin" | "sync"): string {
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
  const expected = kind === "sync" ? process.env["SYNC_SECRET"] : process.env["ADMIN_TOKEN_SHA256"];
  if (!expected || expected.length < 32 || !token) throw new ServiceError("UNAUTHORIZED", 401);
  const digest = (s: string) => createHash("sha256").update(s).digest();
  const ok =
    kind === "sync"
      ? timingSafeEqual(digest(token), digest(expected))
      : timingSafeEqual(digest(digest(token).toString("hex")), digest(expected));
  if (!ok) throw new ServiceError("UNAUTHORIZED", 401);
  if (kind === "admin" && !process.env["ADMIN_ID"]) throw new ServiceError("UNAUTHORIZED", 401);
  return kind === "sync" ? "scheduler" : process.env["ADMIN_ID"]!;
}
