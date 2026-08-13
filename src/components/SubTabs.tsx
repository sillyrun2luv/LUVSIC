import { cn } from "@/lib/utils";

interface SubTabDef {
  key: string;
  label: string;
}

interface SubTabsProps {
  value: string;
  onChange: (key: string) => void;
  tabs: SubTabDef[];
}

/** 通用子 Tab 切换器，用于页面内部多板块切换 */
export default function SubTabs({ value, onChange, tabs }: SubTabsProps) {
  return (
    <div className="sticky top-0 z-20 -mx-4 mb-6 flex gap-1 border-b border-line/60 bg-ink-950/80 px-4 py-2 backdrop-blur-md">
      {tabs.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={cn(
              "relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "text-amber-glow"
                : "text-muted hover:text-mist",
            )}
          >
            {t.label}
            {active && (
              <span className="absolute inset-x-2 -bottom-2 h-0.5 rounded-full bg-amber" />
            )}
          </button>
        );
      })}
    </div>
  );
}
