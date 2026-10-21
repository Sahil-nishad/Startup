import "dotenv/config";
export const setting = (key: string, fallback: number) => {
  const n = Number(process.env[key]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
export const enabled = (key: string, fallback = true) =>
  process.env[key] === undefined ? fallback : process.env[key] === "true";
export class ServiceError extends Error {
  constructor(
    public code: string,
    public status = 503,
  ) {
    super(code);
  }
}
