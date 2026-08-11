import { cn } from "@/lib/utils";

interface SectionTitleProps {
  eyebrow?: string;
  title: string;
  extra?: React.ReactNode;
  className?: string;
}

export default function SectionTitle({ eyebrow, title, extra, className }: SectionTitleProps) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-3", className)}>
      <div>
        {eyebrow && <div className="label-eyebrow mb-1">{eyebrow}</div>}
        <h2 className="font-display text-2xl font-medium leading-none text-cream">{title}</h2>
      </div>
      {extra}
    </div>
  );
}
