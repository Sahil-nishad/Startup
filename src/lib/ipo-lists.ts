import { useCallback, useEffect, useState } from "react";

const WATCHLIST_KEY = "ipolens-watchlist";
const CHANGE_EVENT = "ipolens-list-change";

function read(key: string) {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function useStoredSlugs(key: string, maximum?: number) {
  const [slugs, setSlugs] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setSlugs(read(key));
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, [key]);

  const save = useCallback(
    (next: string[]) => {
      const values = [...new Set(next)];
      const unique = maximum === undefined ? values : values.slice(0, maximum);
      localStorage.setItem(key, JSON.stringify(unique));
      setSlugs(unique);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key, maximum],
  );

  const toggle = useCallback(
    (slug: string) => save(slugs.includes(slug) ? slugs.filter((item) => item !== slug) : [...slugs, slug]),
    [save, slugs],
  );

  const remove = useCallback((slug: string) => save(slugs.filter((item) => item !== slug)), [save, slugs]);
  const clear = useCallback(() => save([]), [save]);

  return { slugs, save, toggle, remove, clear, includes: (slug: string) => slugs.includes(slug) };
}

export const useWatchlist = () => useStoredSlugs(WATCHLIST_KEY);
