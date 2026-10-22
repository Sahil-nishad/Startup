import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type MarketSelectOption = { value: string; label: string };

export function MarketSelect({
  label,
  prefix,
  value,
  options,
  onValueChange,
  className,
  active = false,
}: {
  label: string;
  prefix?: string;
  value: string;
  options: readonly MarketSelectOption[];
  onValueChange: (value: string) => void;
  className?: string;
  active?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        aria-label={label}
        className={cn(
          "h-9 w-auto max-w-full justify-start gap-2 rounded-xl border-border bg-card px-3 text-xs font-semibold text-foreground shadow-none transition-colors hover:border-primary/40 hover:bg-accent/40 focus:ring-2 focus:ring-primary/30 data-[state=open]:border-primary/50 data-[state=open]:bg-accent/50 [&>svg]:ml-auto [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-70",
          active && "border-primary/40 bg-primary/10 text-primary",
          className,
        )}
      >
        {prefix && <span className="shrink-0 font-medium text-muted-foreground">{prefix}</span>}
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        position="popper"
        align="start"
        sideOffset={5}
        className="z-[60] max-h-72 max-w-[min(22rem,calc(100vw-2rem))] rounded-xl border-border bg-popover p-1 text-popover-foreground shadow-2xl"
      >
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="min-h-9 rounded-lg px-3 py-2 pr-8 text-xs font-medium focus:bg-accent focus:text-accent-foreground data-[state=checked]:bg-accent/80 data-[state=checked]:text-foreground"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
