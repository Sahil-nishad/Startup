import { ObservationNote } from "@/components/data-quality";
import { inr } from "@/lib/ipo-data";
import { num, subLabel } from "@/lib/ipo-data";
import { useIpos } from "@/lib/market/context";
import { createFileRoute, Link } from "@tanstack/react-router";
import { statusOf } from "@/lib/ipo-data";
import { CatBadge, PageHead, Panel, StatusBadge } from "@/components/site";

export const Route = createFileRoute("/subscription")({
  head: () => ({
    meta: [
      { title: "IPO subscription status — QIB, NII, retail | IPO Lens" },
      {
        name: "description",
        content: "Category-wise subscription demand for open and recently closed Indian IPOs.",
      },
      { property: "og:title", content: "IPO subscription status | IPO Lens" },
      { property: "og:description", content: "QIB, NII and retail subscription for live IPOs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Sub,
});

function Cell({ v, max }: { v?: number | null | undefined; max: number }) {
  if (v == null) return <td className="px-3 text-right text-muted-foreground">—</td>;
  return (
    <td className="px-3 py-2.5 text-right">
      <div className="num font-medium">{v.toFixed(2)}x</div>
      <div className="ml-auto mt-1 h-1 w-20 rounded bg-muted">
        <div
          className="h-1 rounded bg-primary"
          style={{ width: `${Math.min(100, (v / max) * 100)}%` }}
        />
      </div>
    </td>
  );
}

function Sub() {
  const ipos = useIpos("/api/subscription");
  const rows = ipos
    .filter((i) => i.subscription && statusOf(i) !== "Upcoming")
    .sort((a, b) => (b.close ?? "").localeCompare(a.close ?? ""));
  const max = Math.max(
    1,
    ...rows.map((r) =>
      Math.max(r.subscription!.qib ?? 0, r.subscription!.nii ?? 0, r.subscription!.retail ?? 0),
    ),
  );
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <PageHead
        title="Subscription"
        desc="How many times each investor category has bid for the shares reserved for it. QIB = institutions, NII = high-net-worth, Retail = individuals up to ₹2 lakh."
      />
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">IPO</th>
                <th className="px-3 text-left font-medium">Status</th>
                {["QIB", "NII", "Retail", "Employee", "Total"].map((h) => (
                  <th key={h} className="px-3 text-right font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {!rows.length && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No subscription observations available yet.
                  </td>
                </tr>
              )}
              {rows.map((i) => (
                <tr key={i.slug} className="hover:bg-muted/40">
                  <td className="px-4">
                    <Link
                      to="/ipo/$slug"
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
                  <Cell v={i.subscription!.qib} max={max} />
                  <Cell v={i.subscription!.nii} max={max} />
                  <Cell v={i.subscription!.retail} max={max} />
                  <Cell v={i.subscription!.employee} max={max} />
                  <td className="num px-3 text-right font-semibold">
                    {subLabel(i)}
                    <ObservationNote value={i.subscription!.overall} />
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
