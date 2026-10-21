import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { articles } from "@/lib/ipo-data";

export const Route = createFileRoute("/research/$slug")({
  loader: ({ params }) => {
    const a = articles.find((x) => x.slug === params.slug);
    if (!a) throw notFound();
    return { a };
  },
  head: ({ loaderData }) => {
    const t = loaderData ? `${loaderData.a.title} | IPO Lens` : "Article | IPO Lens";
    const d = loaderData?.a.summary ?? "IPO Lens guide";
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
  component: Article,
});

function Article() {
  const { a } = Route.useLoaderData();
  return (
    <article className="mx-auto max-w-2xl px-4 py-10">
      <nav className="mb-4 text-xs text-muted-foreground">
        <Link to="/research" className="hover:underline">
          Research
        </Link>{" "}
        / {a.kind}
      </nav>
      <h1 className="font-serif text-4xl font-semibold leading-tight tracking-tight">{a.title}</h1>
      <p className="mt-3 text-lg text-muted-foreground">{a.summary}</p>
      <div className="mt-8 space-y-4 leading-relaxed">
        {a.body.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
    </article>
  );
}
