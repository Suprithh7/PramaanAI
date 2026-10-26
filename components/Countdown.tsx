"use client";

import { AlarmClock, CalendarClock } from "lucide-react";
import { useMountedNow } from "@/components/ui/ActionFeedback";

export function Countdown({
  deadline,
  compact = false,
}: {
  deadline: string;
  compact?: boolean;
}) {
  const now = useMountedNow(30_000);
  if (!now) {
    return <span className="font-mono text-[11px] text-slate-400">calculating…</span>;
  }

  const target = new Date(deadline);
  const diff = target.getTime() - now.getTime();
  const overdue = diff <= 0;
  const abs = Math.abs(diff);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 font-mono text-[10px] font-semibold tabular-nums ${
          overdue ? "text-red-700" : days < 3 ? "text-red-700" : days < 6 ? "text-amber-700" : "text-slate-700"
        }`}
      >
        <CalendarClock size={10} />
        {overdue ? "overdue " : ""}
        {days}d {String(hours).padStart(2, "0")}h {String(minutes).padStart(2, "0")}m
      </span>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <AlarmClock size={11} className={overdue ? "text-red-600" : "text-amber-600"} />
        <span className="text-[9px] font-semibold uppercase tracking-label text-slate-500">
          {overdue ? "Deadline exceeded" : "Evidence window remaining"}
        </span>
      </div>
      <div
        className={`mt-0.5 font-mono text-lg font-semibold leading-none tabular-nums ${
          overdue ? "text-red-700" : "text-navy-950"
        }`}
      >
        {overdue ? "+" : ""}
        {days}d : {String(hours).padStart(2, "0")}h : {String(minutes).padStart(2, "0")}m
      </div>
    </div>
  );
}
