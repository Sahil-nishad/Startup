import { createFileRoute, Link, Outlet, useMatch } from "@tanstack/react-router";
import { articles } from "@/lib/ipo-data";
import { PageHead } from "@/components/site";

export const Route = createFileRoute("/research")({
  head: () => ({
    meta: [
      { title: "IPO research, guides & reports | IPO Lens" },
      {
        name: "description",
        content:
          "Plain-language guides on GMP, subscription and applying for IPOs, plus market reports.",
      },
      { property: "og:title", content: "Research & guides | IPO Lens" },
      { property: "og:description", content: "Learn how IPOs, GMP and subscriptions work." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Research,
});

function Research() {
  const child = useMatch({ from: "/research/$slug", shouldThrow: false });
  if (child) return <Outlet />;
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageHead
        title="Research & guides"
        desc="Short, practical explainers for first-time and experienced IPO investors."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {articles.map((a) => (
          <Link
            key={a.slug}
            to="/research/$slug"
            params={{ slug: a.slug }}
            className="rounded-xl border bg-card p-5 hover:border-primary/40"
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {a.kind}
            </span>
            <h2 className="mt-1 font-serif text-xl font-semibold">{a.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{a.summary}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
