import { Activity, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { RegionStat } from "@/lib/analytics";
import { REGION_META } from "@/lib/types";

export function SlaHeatmap({ rows }: { rows: RegionStat[] }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow">Statutory clock · five regions</div>
          <h2 className="panel-title mt-0.5">National SLA breach heatmap</h2>
        </div>
        <div className="flex items-center gap-3 text-[9px] font-medium text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 bg-emerald-600" /> On track
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 bg-amber-500" /> Warning
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 bg-red-600" /> Breached
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px bg-slate-200 sm:grid-cols-2 xl:grid-cols-5">
        {rows.map((row) => {
          const meta = REGION_META[row.region];
          const dominant = row.breached > 0 ? "red" : row.warning > 0 ? "amber" : "emerald";
          const rail = dominant === "red" ? "bg-red-600" : dominant === "amber" ? "bg-amber-500" : "bg-emerald-600";
          return (
            <div key={row.region} className="relative bg-white p-3">
              <span className={`absolute inset-x-0 top-0 h-[3px] ${rail}`} />
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-mono text-3xs text-slate-500">
                    {meta.code} · {meta.hq}
                  </div>
                  <div className="mt-0.5 text-[11px] font-semibold text-navy-950">{meta.label}</div>
                </div>
                <div className="text-right">
                  <div className={`font-serif text-[26px] font-semibold leading-none ${row.breached > 0 ? "text-red-700" : row.warning > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                    {row.breached}
                  </div>
                  <div className="mt-0.5 text-[8px] uppercase tracking-label text-slate-400">breach</div>
                </div>
              </div>

              <div className="bar-fill mt-2.5 flex h-1.5 w-full overflow-hidden bg-slate-100">
                {row.onTrack > 0 && <span className="bg-emerald-600" style={{ width: `${(row.onTrack / Math.max(1, row.total)) * 100}%` }} />}
                {row.warning > 0 && <span className="bg-amber-500" style={{ width: `${(row.warning / Math.max(1, row.total)) * 100}%` }} />}
                {row.breached > 0 && <span className="bg-red-600" style={{ width: `${(row.breached / Math.max(1, row.total)) * 100}%` }} />}
              </div>

              <div className="mt-2 grid grid-cols-3 gap-1 border-b border-slate-100 pb-2 text-center">
                <div>
                  <div className="font-mono text-[11px] font-semibold text-emerald-700">{row.onTrack}</div>
                  <div className="text-[8px] uppercase tracking-label text-slate-400">ok</div>
                </div>
                <div>
                  <div className="font-mono text-[11px] font-semibold text-amber-700">{row.warning}</div>
                  <div className="text-[8px] uppercase tracking-label text-slate-400">warn</div>
                </div>
                <div>
                  <div className="font-mono text-[11px] font-semibold text-red-700">{row.breached}</div>
                  <div className="text-[8px] uppercase tracking-label text-slate-400">breach</div>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between text-[9px]">
                <span className="flex items-center gap-1 text-slate-500">
                  <Activity size={9} /> {row.total} active
                </span>
                <span className={row.penalty > 0 ? "font-semibold text-red-700" : "text-slate-400"}>
                  {row.penalty} penalty
                </span>
              </div>

              <div className="mt-1.5 flex items-center gap-1">
                {row.dots.map((dot, index) => (
                  <span
                    key={index}
                    className={`h-1.5 w-1.5 ${dot === "BREACHED" ? "bg-red-600" : dot === "WARNING" ? "bg-amber-500" : "bg-emerald-600"}`}
                  />
                ))}
                {row.dots.length === 0 && <span className="text-[9px] text-slate-400">No active cases</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-2 text-[9px] text-slate-500">
        <Link href="/escalations" className="inline-flex items-center gap-1 font-semibold uppercase tracking-label text-navy-700 hover:text-navy-900">
          Open SLA matrix <ArrowUpRight size={10} />
        </Link>
      </div>
    </section>
  );
}
