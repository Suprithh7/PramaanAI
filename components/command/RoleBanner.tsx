import type { ReactNode } from "react";

export function RoleBanner({
  tone,
  eyebrow,
  title,
  children,
  actions,
  icon,
}: {
  tone: "red" | "amber" | "emerald" | "navy";
  eyebrow: string;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  const palette = {
    red: {
      wrapper: "border-red-300 bg-red-50",
      rail: "bg-red-600",
      eyebrow: "text-red-800",
      title: "text-red-950",
      body: "text-red-900/80",
      icon: "border-red-200 bg-white text-red-700",
    },
    amber: {
      wrapper: "border-amber-300 bg-amber-50",
      rail: "bg-amber-500",
      eyebrow: "text-amber-800",
      title: "text-amber-950",
      body: "text-amber-900/80",
      icon: "border-amber-200 bg-white text-amber-700",
    },
    emerald: {
      wrapper: "border-emerald-300 bg-emerald-50",
      rail: "bg-emerald-600",
      eyebrow: "text-emerald-800",
      title: "text-emerald-950",
      body: "text-emerald-900/80",
      icon: "border-emerald-200 bg-white text-emerald-700",
    },
    navy: {
      wrapper: "border-navy-200 bg-navy-50",
      rail: "bg-navy-800",
      eyebrow: "text-navy-700",
      title: "text-navy-950",
      body: "text-navy-900/80",
      icon: "border-navy-200 bg-white text-navy-700",
    },
  }[tone];

  return (
    <div className={`relative flex flex-col gap-3 overflow-hidden border px-4 py-3.5 sm:flex-row sm:items-center ${palette.wrapper}`}>
      <span className={`absolute inset-y-0 left-0 w-[3px] ${palette.rail}`} />
      {icon && (
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center border ${palette.icon}`}>
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className={`text-[9px] font-semibold uppercase tracking-wider2 ${palette.eyebrow}`}>
          {eyebrow}
        </div>
        <div className={`mt-0.5 font-serif text-[15px] font-semibold leading-snug ${palette.title}`}>
          {title}
        </div>
        {children && <div className={`mt-1 text-[11px] leading-relaxed ${palette.body}`}>{children}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
