import { ShieldCheck } from "lucide-react";

export function Emblem({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`relative flex shrink-0 flex-col items-center justify-center border border-brass-400/70 bg-navy-950 ${
        compact ? "h-9 w-9" : "h-11 w-11"
      }`}
      aria-hidden="true"
    >
      <span className="absolute inset-[3px] border border-brass-300/20" />
      <ShieldCheck
        size={compact ? 17 : 21}
        strokeWidth={1.5}
        className="relative text-brass-200"
      />
      {!compact && (
        <span className="relative mt-0.5 text-[6px] font-semibold tracking-[0.18em] text-brass-200/90">
          AICTE
        </span>
      )}
    </div>
  );
}
