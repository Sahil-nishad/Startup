import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import type { Ipo } from "@/lib/ipo-data";
import { useWatchlist } from "@/lib/ipo-lists";
import { cn } from "@/lib/utils";

export function WatchlistButton({ ipo, compact = false }: { ipo: Ipo; compact?: boolean }) {
  const watchlist = useWatchlist();
  const saved = watchlist.includes(ipo.slug);
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${ipo.name} from watchlist` : `Add ${ipo.name} to watchlist`}
      title={saved ? "Remove from watchlist" : "Add to watchlist"}
      onClick={() => watchlist.toggle(ipo.slug)}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors",
        saved
          ? "border-warning/40 bg-warning-soft text-warning"
          : "bg-card text-muted-foreground hover:text-foreground",
        compact && "h-8 w-8 px-0",
      )}
    >
      <Star className={cn("h-3.5 w-3.5", saved && "fill-current")} />
      {!compact && (saved ? "Saved" : "Watchlist")}
    </button>
  );
}

export function WatchlistLink() {
  const watchlist = useWatchlist();
  return (
    <Link
      to="/ipos"
      search={{ watchlist: true }}
      aria-label={`Watchlist with ${watchlist.slugs.length} IPOs`}
      className="relative grid h-9 w-9 place-items-center rounded-md border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Star className={cn("h-4 w-4", watchlist.slugs.length > 0 && "fill-warning text-warning")} />
      {watchlist.slugs.length > 0 && (
        <span className="num absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-foreground px-1 text-[8px] font-bold text-background">
          {watchlist.slugs.length}
        </span>
      )}
    </Link>
  );
}
