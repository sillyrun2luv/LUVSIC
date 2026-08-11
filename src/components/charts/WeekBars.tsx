import type { DayCount } from "@/lib/stats";
import { isSameDay, weekdayShort } from "@/lib/date";
import { cn } from "@/lib/utils";

interface WeekBarsProps {
  data: DayCount[]; // 长度 7
  now?: Date;
}

export default function WeekBars({ data, now = new Date() }: WeekBarsProps) {
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className="flex items-end justify-between gap-2 px-1 pt-2">
      {data.map((d, i) => {
        const isToday = isSameDay(d.day, now);
        const heightPct = (d.count / max) * 100;
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-24 w-full items-end justify-center">
              <div
                className={cn(
                  "w-full max-w-[26px] rounded-t-md transition-all duration-500",
                  isToday ? "bg-amber shadow-glow" : "bg-amber/25",
                )}
                style={{ height: `${Math.max(d.count > 0 ? 8 : 2, heightPct)}%` }}
                title={`${d.count} 次`}
              />
            </div>
            <span
              className={cn(
                "font-mono text-xs",
                isToday ? "text-amber-glow" : "text-muted",
              )}
            >
              {d.count}
            </span>
            <span className={cn("text-xs", isToday ? "text-cream" : "text-muted")}>
              {weekdayShort(d.day)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
