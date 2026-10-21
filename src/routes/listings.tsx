import { inr } from "@/lib/ipo-data";
import { num, subLabel } from "@/lib/ipo-data";
import { useIpos } from "@/lib/market/context";
import { createFileRoute, Link } from "@tanstack/react-router";
import { fmtDate, listingGainPct, pct, statusOf } from "@/lib/ipo-data";
import { CatBadge, Delta, PageHead, Panel } from "@/components/site";

export const Route = createFileRoute("/listings")({
  head: () => ({
    meta: [
      { title: "IPO listing performance — gains vs issue price | IPO Lens" },
      {
        name: "description",
        content: "Listing-day gains and current returns for recently listed Indian IPOs.",
      },
      { property: "og:title", content: "IPO listing performance | IPO Lens" },
      { property: "og:description", content: "How recent IPOs listed against their issue price." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Listings,
});

function Listings() {
  const ipos = useIpos("/api/listing-performance");
  const rows = ipos
    .filter((i) => statusOf(i) === "Listed" && i.listingPrice)
    .sort((a, b) => (b.listing ?? "").localeCompare(a.listing ?? ""));
  const avg = rows.reduce((s, i) => s + (listingGainPct(i) ?? 0), 0) / (rows.length || 1);
  const pos = rows.filter((i) => (listingGainPct(i) ?? 0) > 0).length;
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <PageHead
        title="Listing performance"
        desc="Listing price compared with the actual issue price."
      >
        <div className="flex gap-6 text-right">
          <div>
            <div className="text-xs text-muted-foreground">Avg. listing gain</div>
            <Delta value={avg}>{pct(avg)}</Delta>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Listed above issue</div>
            <span className="num font-semibold">
              {pos} / {rows.length}
            </span>
          </div>
        </div>
      </PageHead>
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">IPO</th>
                <th className="px-3 text-left font-medium">Listed</th>
                <th className="px-3 text-right font-medium">Issue</th>
                <th className="px-3 text-right font-medium">Listing</th>
                <th className="px-3 text-right font-medium">Listing gain</th>
                <th className="px-3 text-right font-medium">Current*</th>
                <th className="px-3 text-right font-medium">Return</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((i) => {
                const g = listingGainPct(i)!;
                const r =
                  i.currentPrice !== null && i.issuePrice !== null
                    ? ((i.currentPrice - i.issuePrice) / i.issuePrice) * 100
                    : null;
                return (
                  <tr key={i.slug} className="hover:bg-muted/40">
                    <td className="px-4 py-2.5">
                      <Link
                        to="/ipo/$slug"
                        params={{ slug: i.slug }}
                        className="font-semibold hover:underline"
                      >
                        {i.name}
                      </Link>{" "}
                      <CatBadge ipo={i} />
                    </td>
                    <td className="num px-3">{fmtDate(i.listing)}</td>
                    <td className="num px-3 text-right">{inr(i.issuePrice)}</td>
                    <td className="num px-3 text-right">{inr(i.listingPrice)}</td>
                    <td className="px-3 text-right">
                      <Delta value={g}>{pct(g)}</Delta>
                    </td>
                    <td className="num px-3 text-right">{inr(i.currentPrice)}</td>
                    <td className="px-3 text-right">
                      <Delta value={r}>{pct(r)}</Delta>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t px-4 py-2 text-xs text-muted-foreground">
          *A current quote is unavailable without a licensed market-price feed.
        </p>
      </Panel>
    </div>
  );
}
