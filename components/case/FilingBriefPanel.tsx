import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { regenerateFilingBriefAction } from "@/app/actions";
import { ActionButton } from "@/components/ui/ActionFeedback";
import type { FilingBriefPayload } from "@/lib/ai";
import { fmtDateTime } from "@/lib/format";

const RISK_META: Record<
  FilingBriefPayload["riskLevel"],
  { label: string; explain: string; tone: string; bar: string }
> = {
  CLEAR: {
    label: "Ready",
    explain: "Every rule passes on the declared record.",
    tone: "border-emerald-300 bg-emerald-50 text-emerald-900",
    bar: "bg-emerald-600",
  },
  ATTENTION: {
    label: "Needs a fix",
    explain: "Some rules fail, but the case can still be saved.",
    tone: "border-amber-300 bg-amber-50 text-amber-900",
    bar: "bg-amber-500",
  },
  MATERIAL: {
    label: "Not ready",
    explain: "Too many rules fail for the file to proceed.",
    tone: "border-red-300 bg-red-50 text-red-900",
    bar: "bg-red-600",
  },
};

export function FilingBriefPanel({
  applicationId,
  payload,
  generatedAt,
  canRegenerate,
}: {
  applicationId: string;
  payload: FilingBriefPayload;
  engine?: string;
  model?: string | null;
  generatedAt: Date | string;
  canRegenerate: boolean;
}) {
  const risk = RISK_META[payload.riskLevel] ?? RISK_META.ATTENTION;

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-navy-800 bg-navy-950 px-4 py-3 text-white">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center bg-brass-500 text-navy-950">
            <Sparkles size={14} />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-label text-brass-200">
              Summary written from the rule results
            </div>
            <h2 className="mt-1 font-serif text-lg font-semibold leading-snug">{payload.headline}</h2>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {canRegenerate && (
            <ActionButton
              action={regenerateFilingBriefAction}
              fields={{ applicationId }}
              label="Refresh summary"
              pendingLabel="Writing…"
              variant="outline"
              size="xs"
              icon={<RefreshCw size={11} />}
            />
          )}
        </div>
      </div>

      <div className="grid gap-px border-b border-slate-200 bg-slate-200 sm:grid-cols-[minmax(0,1fr)_240px]">
        <div className="bg-white px-4 py-3.5">
          <div className="label">In plain words</div>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{payload.summary}</p>
        </div>
        <div className="bg-white px-4 py-3.5">
          <div className="label">Filing readiness</div>
          <div className="mt-0.5 font-serif text-3xl font-semibold leading-none text-navy-950">
            {payload.readinessScore}%
          </div>
          <span className={`badge mt-1.5 ${risk.tone}`}>{risk.label}</span>
          <p className="mt-1 text-[11px] leading-snug text-slate-500">{risk.explain}</p>
          <div className="mt-2 h-1.5 w-full bg-slate-200">
            <div
              className={`h-1.5 ${risk.bar}`}
              style={{ width: `${Math.min(100, Math.max(0, payload.readinessScore))}%` }}
            />
          </div>
          <div className="mt-1.5 font-mono text-[11px] text-slate-400">
            {fmtDateTime(generatedAt)}
          </div>
        </div>
      </div>

      {payload.findings.length > 0 && (
        <div className="divide-y divide-slate-100">
          {payload.findings.map((finding) => (
            <div key={finding.ruleCode} className="flex items-start gap-2.5 px-4 py-3">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-600" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-xs font-semibold text-red-800">
                    {finding.ruleCode}
                  </span>
                  <span className="text-sm font-semibold text-navy-950">{finding.title}</span>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{finding.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-px border-t border-slate-200 bg-slate-200 sm:grid-cols-2">
        <div className="bg-white px-4 py-3.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-label text-emerald-800">
            <CheckCircle2 size={12} /> Rules that pass
          </div>
          {payload.strengths.length === 0 ? (
            <p className="mt-1.5 text-xs text-slate-500">No rule passes yet.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {payload.strengths.map((strength) => (
                <li key={strength} className="text-xs leading-snug text-slate-600">
                  {strength}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-white px-4 py-3.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-label text-brass-700">
            <Sparkles size={12} /> What to do next
          </div>
          <ol className="mt-2 space-y-1.5">
            {payload.actions.map((action, index) => (
              <li key={action} className="flex gap-2 text-xs leading-snug text-slate-600">
                <span className="font-mono text-[11px] font-semibold text-brass-700">{index + 1}.</span>
                {action}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-2 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <ShieldCheck size={12} className="text-emerald-700" />
          Written on the server from the rule results. No external AI service is used.
        </span>
        <span className="font-mono uppercase tracking-label">Rule engine</span>
      </div>
    </section>
  );
}
