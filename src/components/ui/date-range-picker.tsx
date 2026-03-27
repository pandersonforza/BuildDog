"use client";

import { useState, useRef, useEffect } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  from: Date | undefined;
  to: Date | undefined;
  onChange: (range: { from: Date | undefined; to: Date | undefined }) => void;
  className?: string;
}

export function DateRangePicker({ from, to, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const label =
    from && to
      ? `${format(from, "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`
      : from
      ? `${format(from, "MMM d, yyyy")} – ...`
      : "Select date range";

  const hasValue = !!(from || to);

  function handleSelect(range: DateRange | undefined) {
    onChange({ from: range?.from, to: range?.to });
    // Only close once the user has picked two distinct dates
    if (
      range?.from &&
      range?.to &&
      range.from.getTime() !== range.to.getTime()
    ) {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 items-center gap-2 rounded-md border border-border bg-input px-3 text-sm transition-colors hover:bg-muted",
          hasValue ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <CalendarIcon className="h-4 w-4 shrink-0" />
        <span>{label}</span>
        {hasValue && (
          <X
            className="h-3.5 w-3.5 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onChange({ from: undefined, to: undefined });
            }}
          />
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 rounded-md border border-border bg-card shadow-lg p-3">
          <DayPicker
            mode="range"
            selected={{ from, to }}
            onSelect={handleSelect}
            numberOfMonths={2}
            classNames={{
              months: "flex gap-4",
              month: "space-y-3",
              month_caption: "flex justify-center items-center gap-2 px-1 py-1",
              caption_label: "text-sm font-medium text-foreground",
              nav: "flex items-center gap-1",
              button_previous: "h-7 w-7 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
              button_next: "h-7 w-7 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
              month_grid: "w-full border-collapse",
              weekdays: "flex",
              weekday: "w-9 text-center text-xs text-muted-foreground font-normal pb-1",
              weeks: "space-y-0.5",
              week: "flex",
              day: "p-0",
              day_button: cn(
                "h-9 w-9 rounded-md text-sm transition-colors",
                "hover:bg-muted hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              ),
              selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground rounded-md",
              range_start: "bg-primary text-primary-foreground rounded-md",
              range_end: "bg-primary text-primary-foreground rounded-md",
              range_middle: "bg-primary/20 text-foreground rounded-none",
              today: "font-semibold text-primary",
              outside: "text-muted-foreground opacity-40",
              disabled: "text-muted-foreground opacity-30 cursor-not-allowed",
              hidden: "invisible",
            }}
          />
        </div>
      )}
    </div>
  );
}
