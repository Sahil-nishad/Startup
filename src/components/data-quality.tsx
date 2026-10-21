import { type Ipo, type SourceValue } from "../lib/ipo-data";
import { istTime } from "../lib/market/rules";
import { cn } from "../lib/utils";
import { Panel } from "./site";

const qualityCopy = {
  recent: "Fresh",
  stale: "Delayed",
  historical: "Final",
  unknown: "Time unavailable",
  review: "Needs review",
} as const;

export function FreshnessBadge({
  value,
  className,
}: {
  value: SourceValue | null;
  className?: string;
}) {
  const quality = value?.disputed ? "review" : (value?.quality ?? "unknown");
  const label = value?.disputed ? "Disputed" : qualityCopy[quality];
  const title = value
    ? `${label} · ${value.observedAt ? istTime(value.observedAt) : value.reportedDate ?? "Observation time unavailable"}`
    : "Not reported";
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap text-[9px] font-semibold uppercase tracking-wider",
        quality === "recent" && "text-positive",
        (quality === "stale" || quality === "unknown") && "text-warning",
        quality === "review" && "text-negative",
        quality === "historical" && "text-muted-foreground",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {value ? label : "Not reported"}
    </span>
  );
}
export function ObservationNote({ value }: { value: SourceValue | null }) {
  if (!value) return <span className="text-xs text-muted-foreground">Not reported</span>;
  return (
    <span className="block text-xs leading-5 text-muted-foreground">
      <a href={value.sourceUrl} target="_blank" rel="noreferrer" className="underline">
        {value.provider === "xflot"
          ? "Xflot"
          : value.provider === "ipos_markets"
            ? "IPOs.Markets"
            : value.provider}
      </a>{" "}
      ·{" "}
      {value.observedAt
        ? istTime(value.observedAt)
        : value.reportedDate
          ? `${value.reportedDate} (date only)`
          : "Observation time unavailable"}{" "}
      ·{" "}
      <span
        className={
          value.disputed || value.quality === "review" || value.quality === "stale"
            ? "text-warning"
            : ""
        }
      >
        {value.disputed ? "Disputed — needs review" : value.quality}
      </span>
    </span>
  );
}
export function IssueNote({ ipo }: { ipo: Ipo }) {
  return (
    <p className="mb-4 text-xs text-muted-foreground">
      <a href={ipo.sourceUrl} target="_blank" rel="noreferrer" className="underline">
        IPO source
      </a>{" "}
      · Record update: {istTime(ipo.observedAt)} · {ipo.quality}
      {ipo.review ? " · Some fields need review" : ""}
      {Object.entries(ipo.fieldSources).map(([field, source]) => (
        <span key={field} className="block">
          <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="underline">
            {field.replaceAll("_", " ")}
          </a>
          : {source.status}
          {source.verifiedAt ? " · Verified " + istTime(source.verifiedAt) : ""}
        </span>
      ))}
    </p>
  );
}

export function DataQualityPanel({ ipo }: { ipo: Ipo }) {
  const masterValue: SourceValue = {
    provider: "issue source",
    sourceUrl: ipo.sourceUrl,
    observedAt: ipo.observedAt,
    reportedDate: null,
    retrievedAt: ipo.observedAt ?? "",
    quality: ipo.review ? "review" : ipo.quality,
    disputed: ipo.review,
  };
  const verifiedDocuments = ipo.documents.length;
  const verifiedPeriods = ipo.financials.length;
  return (
    <Panel
      title="Data freshness & sources"
      action={<span className="text-[10px] text-muted-foreground">No inferred values</span>}
    >
      <div className="grid sm:grid-cols-2 lg:grid-cols-5">
        <QualityItem label="Issue details" value={masterValue} />
        <QualityItem label="GMP" value={ipo.gmp} />
        <QualityItem label="Subscription" value={ipo.subscription?.overall ?? null} />
        <div className="border-b p-4 sm:border-l lg:border-b-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Official documents
          </div>
          <div className="num mt-2 text-lg font-bold">{verifiedDocuments}</div>
          <div className="mt-1 text-[10px] text-muted-foreground">Verified links</div>
        </div>
        <div className="border-b p-4 sm:border-l lg:border-b-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Financials
          </div>
          <div className="num mt-2 text-lg font-bold">{verifiedPeriods}</div>
          <div className="mt-1 text-[10px] text-muted-foreground">Verified periods</div>
        </div>
      </div>
    </Panel>
  );
}

function QualityItem({ label, value }: { label: string; value: SourceValue | null }) {
  return (
    <div className="border-b p-4 sm:border-l sm:first:border-l-0 lg:border-b-0">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <FreshnessBadge value={value} className="mt-2" />
      <div className="mt-1 truncate text-[10px] text-muted-foreground" title={value ? istTime(value.observedAt) : undefined}>
        {value?.observedAt ? istTime(value.observedAt) : value?.reportedDate ?? "No observation"}
      </div>
    </div>
  );
}
