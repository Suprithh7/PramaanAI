import { Inbox } from "lucide-react";

export function EmptyState({
  title,
  description,
  icon,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center border border-dashed border-slate-300 bg-white px-6 py-10 text-center ${className}`}
    >
      <span className="mb-3 flex h-10 w-10 items-center justify-center border border-slate-200 bg-slate-50 text-slate-400">
        {icon ?? <Inbox size={16} />}
      </span>
      <div className="font-serif text-lg font-semibold text-navy-950">{title}</div>
      {description && (
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-500">{description}</p>
      )}
      {children && <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{children}</div>}
    </div>
  );
}

export function MiniBar({
  value,
  max,
  tone = "navy",
  height = "h-1.5",
}: {
  value: number;
  max: number;
  tone?: "navy" | "emerald" | "amber" | "red" | "brass" | "violet";
  height?: string;
}) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  const colors = {
    navy: "bg-navy-700",
    emerald: "bg-emerald-600",
    amber: "bg-amber-500",
    red: "bg-red-600",
    brass: "bg-brass-500",
    violet: "bg-violet-600",
  };
  return (
    <div className={`w-full bg-slate-200 ${height}`} aria-hidden="true">
      <div className={`${height} ${colors[tone]}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function SlaMeter({ days }: { days: number }) {
  const pct = Math.min(100, (days / 10) * 100);
  const tone = days > 10 ? "bg-red-600" : days >= 5 ? "bg-amber-500" : "bg-emerald-600";
  return (
    <div className="w-full">
      <div className="relative h-2 w-full overflow-hidden bg-slate-200">
        <div className="absolute inset-y-0 left-0 w-1/2 bg-amber-100" />
        <div className="absolute inset-y-0 right-0 w-1/2 bg-red-100" />
        <div className={`relative h-2 ${tone}`} style={{ width: `${pct}%` }} />
        <span className="absolute inset-y-0 left-1/2 w-px bg-amber-400/70" />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[8px] uppercase tracking-label text-slate-400">
        <span>0</span>
        <span>5d warning</span>
        <span>10d breach</span>
      </div>
    </div>
  );
}
