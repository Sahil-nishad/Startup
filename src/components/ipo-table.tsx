import { num, subLabel } from "@/lib/ipo-data";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  gmpPct,
  latestGmp,
  minInvestment,
  shortDate,
  statusOf,
  inr,
  pct,
  type Ipo,
} from "@/lib/ipo-data";
import { CatBadge, Delta, Initials, StatusBadge } from "./site";
import { FreshnessBadge } from "./data-quality";
import { WatchlistButton } from "./ipo-actions";

export type SortKey = "name" | "open" | "close" | "price" | "gmp" | "sub" | "listing" | "size";
export const sortFns: Record<SortKey, (a: Ipo, b: Ipo) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  open: (a, b) => (a.open ?? "").localeCompare(b.open ?? ""),
  close: (a, b) => (a.close ?? "").localeCompare(b.close ?? ""),
  listing: (a, b) => (a.listing ?? "").localeCompare(b.listing ?? ""),
  price: (a, b) => (a.priceHigh ?? -Infinity) - (b.priceHigh ?? -Infinity),
  size: (a, b) => (a.issueSizeCr ?? -Infinity) - (b.issueSizeCr ?? -Infinity),
  gmp: (a, b) => (gmpPct(a) ?? -Infinity) - (gmpPct(b) ?? -Infinity),
  sub: (a, b) => (a.subscription?.total ?? -1) - (b.subscription?.total ?? -1),
};

export function IpoTable({
  rows,
  sort,
  dir,
  onSort,
}: {
  rows: Ipo[];
  sort?: SortKey;
  dir?: "asc" | "desc";
  onSort?: (k: SortKey) => void;
}) {
  const Th = ({
    k,
    children,
    right,
  }: {
    k?: SortKey;
    children: React.ReactNode;
    right?: boolean;
  }) => (
    <th
      className={`whitespace-nowrap px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground ${right ? "text-right" : "text-left"}`}
      aria-sort={k && sort === k ? (dir === "asc" ? "ascending" : "descending") : undefined}
    >
      {k && onSort ? (
        <button
          onClick={() => onSort(k)}
          className={`inline-flex items-center gap-1 hover:text-foreground ${sort === k ? "text-foreground" : ""}`}
        >
          {children}
          {sort === k ? (
            dir === "asc" ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-40" />
          )}
        </button>
      ) : (
        children
      )}
    </th>
  );
  if (!rows.length)
    return (
      <p className="p-10 text-center text-sm text-muted-foreground">No IPOs match these filters.</p>
    );
  return (
    <div className="overflow-x-auto">
      <table className="data-table w-full min-w-[1120px] text-sm">
        <thead className="border-b">
          <tr>
            <Th k="name">Company</Th>
            <Th>Status</Th>
            <Th k="open">Dates</Th>
            <Th k="price" right>
              Price band
            </Th>
            <Th right>Lot</Th>
            <Th right>Min amount</Th>
            <Th k="size" right>
              Issue size
            </Th>
            <Th k="gmp" right>
              Unofficial GMP
            </Th>
            <Th k="sub" right>
              Subs.
            </Th>
            <Th right>Actions</Th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((i) => {
            const g = latestGmp(i);
            return (
              <tr key={i.slug} className="group hover:bg-muted/55">
                <td className="px-3 py-2.5">
                  <Link
                    to="/ipo/$slug"
                    params={{ slug: i.slug }}
                    className="flex items-center gap-2.5 font-bold tracking-tight hover:underline"
                  >
                    <Initials name={i.name} />
                    <span>
                      <span className="block whitespace-nowrap">{i.name}</span>
                      <span className="flex gap-1.5 pt-0.5 text-xs font-normal text-muted-foreground">
                        <CatBadge ipo={i} /> {i.exchange}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="px-3">
                  <StatusBadge status={statusOf(i)} />
                </td>
                <td className="num whitespace-nowrap px-3 text-xs">
                  <span className="font-semibold">{shortDate(i.open)}</span>
                  <span className="mx-1 text-muted-foreground">→</span>
                  {shortDate(i.close)}
                </td>
                <td className="num whitespace-nowrap px-3 text-right">
                  {inr(i.priceLow)}–{i.priceHigh}
                </td>
                <td className="num whitespace-nowrap px-3 text-right">{num(i.lot)}</td>
                <td className="num whitespace-nowrap px-3 text-right font-semibold">
                  {inr(minInvestment(i))}
                </td>
                <td className="num whitespace-nowrap px-3 text-right">₹{num(i.issueSizeCr)} Cr</td>
                <td className="whitespace-nowrap px-3 text-right">
                  <Delta value={g}>{inr(g)}</Delta>
                  <span className="num block text-xs text-muted-foreground">{pct(gmpPct(i))}</span>
                  <FreshnessBadge value={i.gmp} className="mt-1 justify-end" />
                </td>
                <td className="num whitespace-nowrap px-3 text-right">
                  {subLabel(i)}
                  <FreshnessBadge
                    value={i.subscription?.overall ?? null}
                    className="mt-1 justify-end"
                  />
                </td>
                <td className="px-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    <WatchlistButton ipo={i} compact />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
