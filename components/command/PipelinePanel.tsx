import { ArrowUpRight, BarChart3, Gauge } from "lucide-react";
import Link from "next/link";
import type { AnalyticsApp } from "@/lib/analytics";
import { ruleStats, slaCounts, stageBuckets } from "@/lib/analytics";

export function PipelinePanel({ apps }: { apps: AnalyticsApp[] }) {
  const stages = stageBuckets(apps);
  const sla = slaCounts(apps);
  const rules = ruleStats(apps);
  const total = Math.max(1, stages.scrutiny + stages.evc + stages.council + stages.decided);
  const active = stages.scrutiny + stages.evc + stages.council;
  const onPct = (sla.ON_TRACK / Math.max(1, sla.total)) * 100;
  const warnPct = (sla.WARNING / Math.max(1, sla.total)) * 100;

  const stageRows = [
    { label: "Scrutiny & deficiency", value: stages.scrutiny, tone: "bg-navy-700", href: "/scrutiny" },
    { label: "EVC inspection", value: stages.evc, tone: "bg-indigo-600", href: "/evc" },
    { label: "Council review", value: stages.council, tone: "bg-brass-500", href: "/applications?status=SAC_REVIEW" },
    { label: "Decided / closed", value: stages.decided, tone: "bg-emerald-600", href: "/applications?status=APPROVED" },
  ];

  return (
    <section className="panel flex h-full flex-col">
      <div className="panel-header">
        <div>
          <div className="eyebrow flex items-center gap-1">
            <BarChart3 size={10} /> Pipeline posture
          </div>
          <h2 className="panel-title mt-0.5">Workflow throughput</h2>
        </div>
        <span className="font-mono text-[10px] text-slate-500">{active} active</span>
      </div>

      <div className="space-y-3 p-4">
        {stageRows.map((row, index) => (
          <Link key={row.label} href={row.href} className="group block">
            <div className="mb-1 flex items-center justify-between text-[10px]">
              <span className="text-slate-600 group-hover:text-navy-900">{row.label}</span>
              <span className="font-mono font-semibold text-navy-900">{row.value}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100">
              <div
                className={`bar-fill h-1.5 ${row.tone}`}
                style={{ width: `${(row.value / total) * 100}%`, animationDelay: `${index * 70}ms` }}
              />
            </div>
          </Link>
        ))}
      </div>

      <div className="border-t border-slate-200 p-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="label flex items-center gap-1">
            <Gauge size={10} /> SLA composition
          </span>
          <span className="font-mono text-[10px] text-slate-500">{sla.total} active</span>
        </div>
        <div className="bar-fill flex h-2.5 w-full overflow-hidden bg-slate-100">
          <span className="bg-emerald-600" style={{ width: `${onPct}%` }} />
          <span className="bg-amber-500" style={{ width: `${warnPct}%` }} />
          <span className="bg-red-600" style={{ width: `${Math.max(0, 100 - onPct - warnPct)}%` }} />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1 text-[9px]">
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 bg-emerald-600" />
            <span className="text-slate-500">On track</span>
            <span className="ml-auto font-mono font-semibold">{sla.ON_TRACK}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 bg-amber-500" />
            <span className="text-slate-500">Warn</span>
            <span className="ml-auto font-mono font-semibold">{sla.WARNING}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 bg-red-600" />
            <span className="text-slate-500">Breach</span>
            <span className="ml-auto font-mono font-semibold">{sla.BREACHED}</span>
          </div>
        </div>
      </div>

      <div className="mt-auto border-t border-slate-200 bg-slate-50/60 p-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="label">Persisted APH compliance</div>
            <div className="mt-1 font-serif text-2xl font-semibold leading-none text-navy-950">
              {rules.rate}
              <span className="ml-0.5 text-xs font-normal text-slate-500">%</span>
            </div>
          </div>
          <div className="text-right text-[9px] text-slate-500">
            <div>{rules.passed} passed</div>
            <div className={rules.flagged > 0 ? "font-semibold text-red-700" : ""}>{rules.flagged} flagged</div>
          </div>
        </div>
        <div className="mt-2 h-1.5 w-full bg-slate-200">
          <div className="bar-fill h-1.5 bg-emerald-600" style={{ width: `${rules.rate}%` }} />
        </div>
        <Link href="/applications?status=UNDER_SCRUTINY" className="mt-2 inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-label text-navy-700 hover:text-navy-900">
          Inspect rule exceptions <ArrowUpRight size={9} />
        </Link>
      </div>
    </section>
  );
}
