import { useIpos, useMarket } from "@/lib/market/context";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CalendarDays, Search, X, Menu, LineChart, Moon, Sun } from "lucide-react";
import { articles, statusOf, type Ipo, type Status } from "@/lib/ipo-data";
import { cn } from "@/lib/utils";
import { WatchlistLink } from "./ipo-actions";

const nav = [
  { to: "/ipos", label: "IPOs" },
  { to: "/gmp", label: "GMP" },
  { to: "/subscription", label: "Subscription" },
  { to: "/calendar", label: "Calendar" },
  { to: "/listings", label: "Listings" },
  { to: "/allotment", label: "Allotment" },
] as const;

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight text-foreground">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-foreground text-background">
        <LineChart className="h-4 w-4" />
      </span>
      <span className="text-[16px] font-bold tracking-[-0.03em]">IPO Lens</span>
    </Link>
  );
}

export function Header() {
  const market = useMarket();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.key === "k" && (e.metaKey || e.ctrlKey)) ||
        (e.key === "/" && !(e.target as HTMLElement)?.closest("input,textarea"))
      ) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <header className="site-header sticky top-0 z-40 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-6 px-4 lg:px-7">
        <div className="flex shrink-0 flex-col gap-0.5">
          <Logo />
          <DataRefreshStamp market={market} />
        </div>
        <nav className="hidden items-center gap-1 lg:flex">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                n.to === "/calendar"
                  ? "bg-primary/10 font-semibold text-primary hover:bg-primary/15"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              activeProps={{
                className:
                  n.to === "/calendar"
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground font-semibold bg-muted",
              }}
            >
              {n.to === "/calendar" && <CalendarDays className="h-3.5 w-3.5" />}
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setOpen(true)}
            className="flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm text-muted-foreground hover:border-primary/40 sm:w-64"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Search IPOs</span>
            <kbd className="ml-auto hidden rounded border bg-muted px-1.5 text-[10px] sm:inline">
              /
            </kbd>
          </button>
          <WatchlistLink />
          <ThemeToggle />
          <button
            aria-label="Menu"
            onClick={() => setMenu(!menu)}
            className="grid h-9 w-9 place-items-center rounded-md border lg:hidden"
          >
            {menu ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {menu && (
        <nav className="grid grid-cols-2 gap-1 border-t px-4 py-3 lg:hidden">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setMenu(false)}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted",
                n.to === "/calendar" && "bg-primary/10 font-semibold text-primary",
              )}
            >
              {n.to === "/calendar" && <CalendarDays className="h-4 w-4" />}
              {n.label}
            </Link>
          ))}
        </nav>
      )}
      {open && <SearchDialog onClose={() => setOpen(false)} />}
    </header>
  );
}

function DataRefreshStamp({ market }: { market: ReturnType<typeof useMarket> }) {
  const latest = market.sources
    .map((source) => source.lastSuccessAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  if (!latest)
    return <span className="pl-9 text-[9px] text-muted-foreground">Awaiting first refresh</span>;
  const refreshed = new Date(latest);
  const invalid = Number.isNaN(refreshed.getTime());
  const label = invalid
    ? "time unavailable"
    : new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      }).format(refreshed);
  const degraded = market.sources.some((source) => source.status !== "ok");
  return (
    <time
      dateTime={latest}
      title={
        invalid
          ? "Most recent provider refresh time is unavailable"
          : `Most recent successful provider refresh: ${refreshed.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`
      }
      className="flex items-center gap-1 pl-9 text-[9px] font-medium text-muted-foreground"
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", degraded ? "bg-warning" : "bg-positive")} />
      Last refresh {label}
    </time>
  );
}

type Result = { kind: "IPO" | "Guide" | "Report"; title: string; sub: string; go: () => void };

function highlight(text: string, q: string) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-sm bg-warning-soft text-foreground">
        {text.slice(i, i + q.length)}
      </mark>
      {text.slice(i + q.length)}
    </>
  );
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const ipos = useIpos();
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [idx, setIdx] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    try {
      setRecent(JSON.parse(localStorage.getItem("ipolens-recent") || "[]"));
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      setDq(q.trim());
      setIdx(0);
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  const remember = (s: string) => {
    const next = [s, ...recent.filter((r) => r !== s)].slice(0, 5);
    localStorage.setItem("ipolens-recent", JSON.stringify(next));
  };
  const results = useMemo<Result[]>(() => {
    if (!dq) return [];
    const l = dq.toLowerCase();
    const ipoR: Result[] = ipos
      .filter((i) =>
        [i.name, i.symbol, i.category, i.sector].some((f) => f.toLowerCase().includes(l)),
      )
      .map((i) => ({
        kind: "IPO",
        title: i.name,
        sub: `${i.symbol} · ${i.category} · ${statusOf(i)}`,
        go: () => navigate({ to: "/ipo/$slug", params: { slug: i.slug } }),
      }));
    const artR: Result[] = articles
      .filter((a) => (a.title + a.summary).toLowerCase().includes(l))
      .map((a) => ({
        kind: a.kind,
        title: a.title,
        sub: a.summary,
        go: () => navigate({ to: "/research/$slug", params: { slug: a.slug } }),
      }));
    return [...ipoR, ...artR].slice(0, 12);
  }, [dq, navigate, ipos]);

  const pick = (r: Result) => {
    remember(dq || r.title);
    r.go();
    onClose();
  };
  const groups = (["IPO", "Guide", "Report"] as const)
    .map((k) => ({ k, items: results.filter((r) => r.kind === k) }))
    .filter((g) => g.items.length);
  const flat = groups.flatMap((g) => g.items);

  return (
    <div className="fixed inset-0 z-50 bg-foreground/20 p-4 pt-[10vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Search"
        className="mx-auto max-w-xl overflow-hidden rounded-xl border bg-popover shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIdx((i) => Math.min(i + 1, flat.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setIdx((i) => Math.max(i - 1, 0));
              }
              if (e.key === "Enter" && flat[idx]) pick(flat[idx]);
            }}
            placeholder="Company, symbol, category or guide"
            className="h-12 flex-1 bg-transparent text-sm outline-none"
          />
          {q && (
            <button aria-label="Clear" onClick={() => setQ("")}>
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {!dq && (
            <div className="p-2 text-sm">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {recent.length ? "Recent searches" : "Try"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(recent.length ? recent : ["SME", "Renewables", "GMP"]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setQ(r)}
                    className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}
          {dq && !flat.length && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No matches for “{dq}”. Try a company name or symbol.
            </p>
          )}
          {groups.map((g) => (
            <div key={g.k} className="mb-1">
              <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {g.k === "IPO" ? "IPOs" : g.k + "s"}
              </p>
              {g.items.map((r) => {
                const i = flat.indexOf(r);
                return (
                  <button
                    key={r.title}
                    onMouseEnter={() => setIdx(i)}
                    onClick={() => pick(r)}
                    className={cn(
                      "block w-full rounded-md px-2 py-2 text-left",
                      i === idx && "bg-accent",
                    )}
                  >
                    <div className="text-sm font-medium">{highlight(r.title, dq)}</div>
                    <div className="truncate text-xs text-muted-foreground">{r.sub}</div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("ipolens-theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  };
  return (
    <button
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggle}
      className="grid h-9 w-9 place-items-center rounded-md border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export function Footer() {
  return (
    <footer className="mt-10 border-t bg-card">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-7">
        <Logo />
        <p className="max-w-3xl sm:text-right">
          GMP is unofficial and unregulated. Figures can be delayed or disputed. Verify offer
          details with official documents before investing.
        </p>
      </div>
      <div className="mx-auto max-w-[1440px] px-4 pb-4 lg:px-7">
        <SampleNote />
      </div>
    </footer>
  );
}

const statusStyle: Record<Status, string> = {
  Open: "bg-positive-soft text-positive",
  Upcoming: "bg-warning-soft text-warning",
  Closed: "bg-negative/10 text-negative",
  Listed: "bg-sky-500/10 text-sky-500",
  Withdrawn: "bg-muted text-muted-foreground",
};
export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold",
        statusStyle[status],
      )}
    >
      {status === "Open" && <span className="h-1.5 w-1.5 rounded-full bg-positive" />}
      {status}
    </span>
  );
}
export function CatBadge({ ipo }: { ipo: Ipo }) {
  return (
    <span className="rounded border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
      {ipo.category}
    </span>
  );
}
export function Initials({ name }: { name: string }) {
  const s = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-secondary text-xs font-bold text-secondary-foreground">
      {s}
    </span>
  );
}
export function Delta({ value, children }: { value: number | null; children: ReactNode }) {
  return (
    <span
      className={cn(
        "num font-semibold",
        value != null && value > 0
          ? "text-positive"
          : value != null && value < 0
            ? "text-negative"
            : "text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function PageHead({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children?: ReactNode;
}) {
  return (
    <div className="enter-soft mb-6 flex flex-wrap items-end justify-between gap-4 border-b pb-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] md:text-[2.65rem]">{title}</h1>
        {desc && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("data-panel rounded-2xl border bg-card", className)}>
      {title && (
        <div data-panel-title className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.1em]">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function SampleNote() {
  const data = useMarket();
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border bg-background px-3.5 py-2 text-[10px] font-medium text-muted-foreground"
      role="status"
    >
      {data.error && <p>{data.error}</p>}
      {!data.items.length && (
        <p>
          {data.available
            ? "No IPO records are stored yet; market coverage is unknown."
            : "Market data is unavailable."}
        </p>
      )}
      <p className="font-semibold text-foreground">
        Reported data · GMP is unofficial · — means unavailable
      </p>
      {data.sources.map((s) => (
        <p key={s.provider}>
          <a
            className="underline"
            href={s.provider === "xflot" ? "https://www.xflot.com" : "https://ipos.markets"}
            target="_blank"
            rel="noreferrer"
          >
            {s.provider === "xflot" ? "Xflot" : "IPOs.Markets"}
          </a>
          : {s.status}
          {s.status !== "ok" ? " · previous observations retained" : ""}
        </p>
      ))}
      <details className="relative ml-auto">
        <summary className="cursor-pointer list-none font-semibold text-foreground hover:underline">
          Sources & disclaimers
        </summary>
        <div className="absolute right-0 z-20 mt-2 w-[min(30rem,calc(100vw-2rem))] space-y-2 rounded-xl border bg-popover p-3 text-[11px] leading-5 shadow-xl">
          {data.sources.map((source) => (
            <p key={source.provider}>
              <strong className="text-foreground">
                {source.provider === "xflot" ? "Xflot" : "IPOs.Markets"}:
              </strong>{" "}
              {source.disclaimer || "No provider disclaimer supplied."}
            </p>
          ))}
        </div>
      </details>
    </div>
  );
}
