import { useIpos } from "@/lib/market/context";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { fmtDate, statusOf, todayIso } from "@/lib/ipo-data";
import { PageHead, Panel } from "@/components/site";

export const Route = createFileRoute("/allotment")({
  head: () => ({
    meta: [
      { title: "IPO allotment status — check by PAN | IPO Lens" },
      {
        name: "description",
        content: "Allotment dates and official registrar links to check your IPO allotment status.",
      },
      { property: "og:title", content: "IPO allotment status | IPO Lens" },
      {
        property: "og:description",
        content: "Registrar links and allotment dates for recent IPOs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Allot,
});

function Allot() {
  const ipos = useIpos();
  const t = todayIso();
  const rows = ipos
    .filter((i) => statusOf(i) !== "Upcoming")
    .sort((a, b) => (b.allotment ?? "").localeCompare(a.allotment ?? ""));
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageHead
        title="Allotment status"
        desc="Allotment is finalised by the registrar. Check your status on the registrar's official site using your PAN, application number or DP ID. IPO Lens never asks for your PAN."
      />
      <Panel>
        <ul className="divide-y">
          {rows.map((i) => {
            const ready = i.allotment !== null && i.allotment <= t;
            return (
              <li key={i.slug} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link
                    to="/ipo/$slug"
                    params={{ slug: i.slug }}
                    className="font-semibold hover:underline"
                  >
                    {i.name}
                  </Link>
                  <div className="num text-xs text-muted-foreground">
                    Allotment {fmtDate(i.allotment)} · Registrar: {i.registrar}
                  </div>
                </div>
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${ready ? "bg-positive-soft text-positive" : "bg-warning-soft text-warning"}`}
                >
                  {ready ? "Date reached; verify result" : "Awaited"}
                </span>
                {i.registrarUrl ? (
                  <a
                    href={i.registrarUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                  >
                    Check on registrar <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Registrar link awaiting verification
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
