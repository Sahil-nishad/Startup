import { ObservationNote } from "@/components/data-quality";
import { inr } from "@/lib/ipo-data";
import { num, subLabel } from "@/lib/ipo-data";
import { useIpos } from "@/lib/market/context";
import { createFileRoute, Link, Outlet, useMatch } from "@tanstack/react-router";
import { estListing, gmpPct, latestGmp, pct, shortDate, statusOf } from "@/lib/ipo-data";
import { CatBadge, Delta, PageHead, Panel, StatusBadge } from "@/components/site";

export const Route = createFileRoute("/gmp")({
  head: () => ({
    meta: [
      { title: "IPO GMP today — grey market premium tracker | IPO Lens" },
      {
        name: "description",
        content:
          "Latest reported grey market premium, GMP percentage and estimated listing price for current Indian IPOs.",
      },
      { property: "og:title", content: "IPO GMP tracker | IPO Lens" },
      {
        property: "og:description",
        content: "Reported GMP and estimated listing prices for active IPOs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GmpPage,
});

function GmpPage() {
  const ipos = useIpos("/api/gmp");
  const child = useMatch({ from: "/gmp/$slug", shouldThrow: false });
  if (child) return <Outlet />;
  const rows = ipos
    .filter((i) => statusOf(i) !== "Listed")
    .sort((a, b) => (gmpPct(b) ?? -Infinity) - (gmpPct(a) ?? -Infinity));
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <PageHead
        title="Unofficial grey market premium"
        desc="GMP is the unofficial premium at which IPO shares trade before listing. It is unregulated, can change quickly and should never be the sole basis for an investment decision."
      />
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">IPO</th>
                <th className="px-3 text-left font-medium">Status</th>
                <th className="px-3 text-right font-medium">Issue price</th>
                <th className="px-3 text-right font-medium">GMP</th>
                <th className="px-3 text-right font-medium">GMP %</th>
                <th className="px-3 text-right font-medium">Est. listing</th>
                <th className="px-3 text-right font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((i) => (
                <tr key={i.slug} className="hover:bg-muted/40">
                  <td className="px-4 py-2.5">
                    <Link
                      to="/gmp/$slug"
                      params={{ slug: i.slug }}
                      className="font-semibold hover:underline"
                    >
                      {i.name}
                    </Link>{" "}
                    <CatBadge ipo={i} />
                  </td>
                  <td className="px-3">
                    <StatusBadge status={statusOf(i)} />
                  </td>
                  <td className="num px-3 text-right">{inr(i.priceHigh)}</td>
                  <td className="px-3 text-right">
                    <Delta value={latestGmp(i)}>{inr(latestGmp(i))}</Delta>
                  </td>
                  <td className="px-3 text-right">
                    <Delta value={gmpPct(i)}>{pct(gmpPct(i))}</Delta>
                  </td>
                  <td className="num px-3 text-right font-medium">{inr(estListing(i))}</td>
                  <td className="num px-3 text-right text-xs text-muted-foreground">
                    <ObservationNote value={i.gmp} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
