import { Check, CircleDashed, Minus, X } from "lucide-react";
import { workflowRail, type RailState } from "@/lib/fsm";

const STATE_STYLE: Record<
  RailState,
  { rail: string; box: string; caption: string; icon: React.ReactNode; tag: string }
> = {
  COMPLETE: {
    rail: "bg-emerald-600",
    box: "border-emerald-200 bg-emerald-50 text-emerald-900",
    caption: "text-emerald-800",
    icon: <Check size={9} strokeWidth={3} />,
    tag: "Complete",
  },
  CURRENT: {
    rail: "bg-brass-500",
    box: "border-brass-300 bg-brass-50 text-navy-950",
    caption: "text-navy-800",
    icon: <span className="h-1.5 w-1.5 bg-brass-600" />,
    tag: "Current",
  },
  UPCOMING: {
    rail: "bg-slate-200",
    box: "border-slate-200 bg-white text-slate-500",
    caption: "text-slate-400",
    icon: <CircleDashed size={9} />,
    tag: "Upcoming",
  },
  FAILED: {
    rail: "bg-red-600",
    box: "border-red-300 bg-red-50 text-red-950",
    caption: "text-red-800",
    icon: <X size={9} strokeWidth={3} />,
    tag: "Returned",
  },
  SKIPPED: {
    rail: "bg-slate-200",
    box: "border-dashed border-slate-200 bg-slate-50 text-slate-400",
    caption: "text-slate-400",
    icon: <Minus size={9} />,
    tag: "Skipped",
  },
};

export function WorkflowRail({ status, path }: { status: string; path: string }) {
  const stages = workflowRail(status, path);

  return (
    <ol className="flex w-full overflow-x-auto">
      {stages.map((stage) => {
        const style = STATE_STYLE[stage.state];
        return (
          <li key={stage.key} className="relative min-w-[118px] flex-1 border-r border-slate-200 last:border-r-0">
            <span className={`absolute inset-x-0 top-0 h-[3px] ${style.rail}`} />
            <div className="px-2.5 pb-2 pt-2.5">
              <div className="flex items-center gap-1.5">
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center border ${style.box}`}
                  aria-hidden="true"
                >
                  {style.icon}
                </span>
                <span
                  className={`text-11px font-semibold uppercase tracking-label ${
                    stage.state === "CURRENT" ? "text-navy-950" : "text-slate-500"
                  }`}
                >
                  {stage.label}
                </span>
              </div>
              <p className={`mt-1 line-clamp-2 text-11px leading-snug ${style.caption}`}>{stage.caption}</p>
              <p className="mt-1 text-10px uppercase tracking-label text-slate-400">{style.tag}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
