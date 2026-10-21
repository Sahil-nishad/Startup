import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MarketSnapshot } from "../ipo-data";
const empty: MarketSnapshot = {
  items: [],
  total: 0,
  available: false,
  error: null,
  sources: [],
  generatedAt: "",
};
const Context = createContext(empty);
export function MarketProvider({
  initial,
  children,
}: {
  initial: MarketSnapshot;
  children: ReactNode;
}) {
  const query = useQuery({
    queryKey: ["market"],
    queryFn: async () => {
      const response = await fetch("/api/ipos?limit=2000");
      if (!response.ok) throw new Error("Market data temporarily unavailable");
      return ((await response.json()) as { data: MarketSnapshot }).data;
    },
    initialData: initial,
    staleTime: 30000,
    refetchInterval: 60000,
    retry: 1,
  });
  return (
    <Context.Provider
      value={{
        ...query.data,
        error: query.isError
          ? "Refresh unavailable; showing the last saved data."
          : query.data.error,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useMarket = () => useContext(Context);
export function useIpos(endpoint = "/api/ipos") {
  const market = useMarket();
  const query = useQuery({
    queryKey: ["market-page", endpoint],
    queryFn: async () => {
      const response = await fetch(endpoint + "?limit=2000");
      if (!response.ok) throw new Error("Data unavailable");
      return ((await response.json()) as { data: MarketSnapshot }).data;
    },
    initialData: market,
    staleTime: 30000,
    refetchInterval: 60000,
    retry: 1,
  });
  return query.data.items;
}
