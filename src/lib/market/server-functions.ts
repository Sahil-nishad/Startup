import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
export const getSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  const { safeSnapshot } = await import("../../server/read");
  return safeSnapshot();
});
export const getIpo = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().regex(/^[a-zA-Z0-9-]+$/) }))
  .handler(async ({ data }) => {
    const { readMarket } = await import("../../server/read");
    return (await readMarket({ slug: data.slug })).items[0] ?? null;
  });
