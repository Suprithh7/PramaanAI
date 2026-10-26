import Link from "next/link";
import { Children } from "react";

function unitFor(value: React.ReactNode, unit: string): string {
  if (value !== 1) return unit;
  if (/ies$/i.test(unit)) return unit.replace(/ies$/i, "y");
  if (/s$/i.test(unit) && !/ss$/i.test(unit)) return unit.slice(0, -1);
  return unit;
}

const TONES: Record<string, { border: string; icon: string; bg: string }> = {
  navy: { border: "border-t-navy-800", icon: "text-navy-700", bg: "bg-navy-50" },
  red: { border: "border-t-red-600", icon: "text-red-700", bg: "bg-red-50" },
  amber: { border: "border-t-amber-500", icon: "text-amber-700", bg: "bg-amber-50" },
  emerald: { border: "border-t-emerald-600", icon: "text-emerald-700", bg: "bg-emerald-50" },
  brass: { border: "border-t-brass-500", icon: "text-brass-700", bg: "bg-brass-50" },
  violet: { border: "border-t-violet-600", icon: "text-violet-700", bg: "bg-violet-50" },
  slate: { border: "border-t-slate-500", icon: "text-slate-600", bg: "bg-slate-100" },
};

export function MetricCard({
  label,
  value,
  unit,
  detail,
  icon,
  tone = "navy",
  href,
  foot,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  detail?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: keyof typeof TONES;
  href?: string;
  foot?: React.ReactNode;
}) {
  const palette = TONES[tone] ?? TONES.navy;
  const body = (
    <div
      className={`panel group h-full border-t-2 ${palette.border} p-3.5 ${
        href
          ? "transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-slate-400 hover:shadow-panel-lift"
          : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="label leading-tight">{label}</div>
        {icon && (
          <span
            className={`flex h-7 w-7 items-center justify-center border border-transparent ${palette.bg} ${palette.icon}`}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2.5 flex items-end gap-1.5">
        <div className="kpi-value">{value}</div>
        {unit && (
          <span className="pb-1 text-3xs font-semibold uppercase tracking-label text-slate-500">
            {unitFor(value, unit)}
          </span>
        )}
      </div>
      {detail && <div className="mt-2 text-[10px] leading-snug text-slate-600">{detail}</div>}
      {foot && <div className="mt-2.5 border-t border-slate-100 pt-2 text-[9px] text-slate-500">{foot}</div>}
    </div>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

export function MetricGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {Children.map(children, (child, index) =>
        child ? (
          <div className="rise-in h-full" style={{ animationDelay: `${index * 55}ms` }}>
            {child}
          </div>
        ) : null,
      )}
    </div>
  );
}
