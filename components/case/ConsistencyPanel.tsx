import { AlertTriangle, ArrowUpRight, Info, Network, ShieldCheck } from "lucide-react";
import { fmtTime } from "@/lib/format";
import type { ConsistencyFinding, ConsistencyReport } from "@/lib/evidence-types";

const SEVERITY_META: Record<ConsistencyFinding["severity"], { label: string; tone: string; icon: React.ReactNode }> = {
  HIGH: {
    label: "High",
    tone: "border-red-300 bg-red-50 text-red-900",
    icon: <AlertTriangle size={9} />,
  },
  MEDIUM: {
    label: "Medium",
    tone: "border-amber-300 bg-amber-50 text-amber-900",
    icon: <AlertTriangle size={9} />,
  },
  INFO: {
    label: "Info",
    tone: "border-slate-300 bg-slate-50 text-slate-700",
    icon: <Info size={9} />,
  },
};

export function ConsistencyPanel({
  report,
  availableIds,
  onSelect,
}: {
  report: ConsistencyReport;
  availableIds: string[];
  onSelect: (evidenceId: string) => void;
}) {
  const selectable = new Set(availableIds);

  return (
    <section className="panel overflow-hidden">
      <div className="panel-header">
        <div>
          <div className="flex items-center gap-1.5">
            <Network size={10} className="text-brass-600" />
            <div className="eyebrow">Evidence graph · cross-annexure checks</div>
          </div>
          <h2 className="panel-title mt-0.5">Consistency findings</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 font-mono text-[9px] uppercase tracking-label">
          <span className="text-slate-500">{report.checksRun} checks</span>
          {report.high > 0 && <span className="font-semibold text-red-700">{report.high} high</span>}
          {report.medium > 0 && <span className="font-semibold text-amber-700">{report.medium} medium</span>}
          {report.info > 0 && <span className="text-slate-500">{report.info} info</span>}
        </div>
      </div>

      {report.findings.length === 0 ? (
        <div className="flex items-center gap-1.5 border-b border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[10px] text-emerald-900">
          <ShieldCheck size={11} />
          No digest reuse, profile conflict or validity mismatch detected across {report.annexures} annexure
          {report.annexures === 1 ? "" : "s"}.
        </div>
      ) : (
        <ul className="divide-y divide-slate-200">
          {report.findings.map((finding) => {
            const meta = SEVERITY_META[finding.severity];
            return (
              <li
                key={finding.id}
                className="flex flex-wrap items-start justify-between gap-2 px-4 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`badge ${meta.tone}`}>
                      {meta.icon}
                      {meta.label}
                    </span>
                    <span className="text-[10px] font-semibold text-navy-950">{finding.title}</span>
                  </div>
                  <p className="mt-1 max-w-[820px] text-[9px] leading-relaxed text-slate-600">
                    {finding.detail}
                  </p>
                </div>
                {finding.evidenceId && selectable.has(finding.evidenceId) && (
                  <button
                    type="button"
                    onClick={() => onSelect(finding.evidenceId as string)}
                    className="btn btn-outline btn-xs"
                  >
                    Inspect <ArrowUpRight size={9} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-1.5 text-[8px] font-mono uppercase tracking-label text-slate-400">
        {report.annexures} annexures · statutory register · cross-institution digest index · computed{" "}
        {fmtTime(report.generatedAt)} IST
      </div>
    </section>
  );
}
