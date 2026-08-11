import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  accent?: boolean;
  className?: string;
}

export default function StatCard({ label, value, unit, hint, accent, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "surface surface-hover p-5",
        accent && "border-amber/30 bg-amber/[0.06]",
        className,
      )}
    >
      <div className="label-eyebrow mb-3">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            "stat-number text-4xl font-medium leading-none",
            accent ? "text-amber-glow" : "text-cream",
          )}
        >
          {value}
        </span>
        {unit && <span className="text-sm text-muted">{unit}</span>}
      </div>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </div>
  );
}
