import { inr } from "@/lib/ipo-data";
import { num, subLabel } from "@/lib/ipo-data";
import { getIpo } from "@/lib/market/server-functions";
import { IssueNote, ObservationNote } from "@/components/data-quality";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { estListing, gmpPct, latestGmp, pct, fmtDate } from "@/lib/ipo-data";
import { Delta, PageHead, Panel } from "@/components/site";
import { GmpChart } from "@/components/gmp-chart";

export const Route = createFileRoute("/gmp/$slug")({
  loader: async ({ params }) => {
    const ipo = await getIpo({ data: { slug: params.slug } });
    if (!ipo) throw notFound();
    return { ipo };
  },
  head: ({ loaderData }) => {
    const n = loaderData?.ipo.name ?? "IPO";
    const t = `${n} GMP history | IPO Lens`;
    const d = `Day-by-day reported grey market premium for ${n}.`;
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: GmpDetail,
});

function GmpDetail() {
  const { ipo } = Route.useLoaderData();
  const h = [...ipo.gmpHistory].reverse();
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-4 text-xs text-muted-foreground">
        <Link to="/gmp" className="hover:underline">
          GMP
        </Link>{" "}
        / {ipo.name}
      </nav>
      <PageHead
        title={`${ipo.name} GMP`}
        desc={`Issue price ${inr(ipo.priceHigh)} · Latest GMP ${inr(latestGmp(ipo))} (${pct(gmpPct(ipo))}) · Est. listing ${inr(estListing(ipo))}`}
      >
        <Link
          to="/ipo/$slug"
          params={{ slug: ipo.slug }}
          className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          Full IPO details
        </Link>
      </PageHead>
      <IssueNote ipo={ipo} />
      <ObservationNote value={ipo.gmp} />
      <Panel title="Trend">
        <div className="p-4">
          <GmpChart ipo={ipo} height={260} />
        </div>
      </Panel>
      <Panel title="Daily log" className="mt-6">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Date</th>
              <th className="px-4 text-right font-medium">GMP</th>
              <th className="px-4 text-right font-medium">Change</th>
              <th className="px-4 text-right font-medium">Est. listing</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {h.map((p, i) => {
              const prev = h[i + 1]?.gmp ?? p.gmp;
              return (
                <tr key={p.date + p.provider + p.retrievedAt}>
                  <td className="num px-4 py-2">{fmtDate(p.date)}</td>
                  <td className="num px-4 text-right font-medium">₹{p.gmp}</td>
                  <td className="px-4 text-right">
                    <Delta value={p.gmp - prev}>
                      {p.gmp - prev > 0 ? "+" : ""}
                      {p.gmp - prev}
                    </Delta>
                  </td>
                  <td className="num px-4 text-right">
                    {inr(ipo.priceHigh === null ? null : ipo.priceHigh + p.gmp)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
