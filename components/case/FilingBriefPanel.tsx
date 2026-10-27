import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { regenerateFilingBriefAction } from "@/app/actions";
import { ActionButton } from "@/components/ui/ActionFeedback";
import type { FilingBriefPayload } from "@/lib/ai";
import { fmtDateTime } from "@/lib/format";

const RISK_META: Record<
  FilingBriefPayload["riskLevel"],
  { label: string; tone: string; bar: string }
> = {
  CLEAR: {
    label: "Clear",
    tone: "border-emerald-300 bg-emerald-50 text-emerald-900",
    bar: "bg-emerald-600",
  },
  ATTENTION: {
    label: "Needs attention",
    tone: "border-amber-300 bg-amber-50 text-amber-900",
    bar: "bg-amber-500",
  },
  MATERIAL: {
    label: "Material deficiency",
    tone: "border-red-300 bg-red-50 text-red-900",
    bar: "bg-red-600",
  },
};

export function FilingBriefPanel({
  applicationId,
  payload,
  engine,
  model,
  generatedAt,
  canRegenerate,
}: {
  applicationId: string;
  payload: FilingBriefPayload;
  engine: string;
  model: string | null;
  generatedAt: Date | string;
  canRegenerate: boolean;
}) {
  const risk = RISK_META[payload.riskLevel] ?? RISK_META.ATTENTION;

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-navy-800 bg-navy-950 px-4 py-3 text-white">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center bg-brass-500 text-navy-950">
            <Sparkles size={12} />
          </span>
          <div className="min-w-0">
            <div className="text-[8px] uppercase tracking-label text-brass-200">
              Filing scrutiny brief · composed from the APH matrix
            </div>
            <h2 className="mt-1 font-serif text-[15px] font-semibold leading-snug">
              {payload.headline}
            </h2>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {engine === "LLM" ? (
            <span className="badge border-brass-400 bg-brass-500/15 text-brass-100">
              <Sparkles size={9} /> Model · {model ?? "LLM"}
            </span>
          ) : (
            <span className="badge border-white/30 bg-white/10 text-white">
              <ShieldCheck size={9} /> Grounded engine
            </span>
          )}
          {canRegenerate && (
            <ActionButton
              action={regenerateFilingBriefAction}
              fields={{ applicationId }}
              label="Regenerate"
              pendingLabel="Composing…"
              variant="outline"
              size="xs"
              icon={<RefreshCw size={10} />}
            />
          )}
        </div>
      </div>

      <div className="grid gap-px border-b border-slate-200 bg-slate-200 sm:grid-cols-[minmax(0,1fr)_220px]">
        <div className="bg-white px-4 py-3">
          <div className="label">Brief</div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-700">{payload.summary}</p>
        </div>
        <div className="bg-white px-3 py-3">
          <div className="label">Readiness</div>
          <div className="mt-0.5 font-serif text-2xl font-semibold leading-none text-navy-950">
            {payload.readinessScore}%
          </div>
          <span className={`badge mt-1.5 ${risk.tone}`}>{risk.label}</span>
          <div className="mt-2 h-1 w-full bg-slate-200">
            <div
              className={`h-1 ${risk.bar}`}
              style={{ width: `${Math.min(100, Math.max(0, payload.readinessScore))}%` }}
            />
          </div>
          <div className="mt-1.5 font-mono text-[8px] text-slate-400">
            {fmtDateTime(generatedAt)}
          </div>
        </div>
      </div>

      {payload.findings.length > 0 && (
        <div className="divide-y divide-slate-100">
          {payload.findings.map((finding) => (
            <div key={finding.ruleCode} className="flex items-start gap-2.5 px-4 py-2.5">
              <AlertTriangle size={12} className="mt-0.5 shrink-0 text-red-600" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-1.5">
                  <span className="font-mono text-[9px] font-semibold text-red-800">
                    {finding.ruleCode}
                  </span>
                  <span className="text-[10px] font-semibold text-navy-950">{finding.title}</span>
                </div>
                <p className="mt-0.5 text-[10px] leading-relaxed text-slate-600">{finding.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-px border-t border-slate-200 bg-slate-200 sm:grid-cols-2">
        <div className="bg-white px-4 py-3">
          <div className="flex items-center gap-1 text-[8px] font-semibold uppercase tracking-label text-emerald-800">
            <CheckCircle2 size={9} /> Cleared on the declared record
          </div>
          {payload.strengths.length === 0 ? (
            <p className="mt-1 text-[10px] text-slate-500">No rule cleared yet.</p>
          ) : (
            <ul className="mt-1.5 space-y-1">
              {payload.strengths.map((strength) => (
                <li key={strength} className="text-[9px] leading-snug text-slate-600">
                  {strength}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-white px-4 py-3">
          <div className="flex items-center gap-1 text-[8px] font-semibold uppercase tracking-label text-brass-700">
            <Sparkles size={9} /> Recommended actions
          </div>
          <ol className="mt-1.5 space-y-1">
            {payload.actions.map((action, index) => (
              <li key={action} className="flex gap-1.5 text-[9px] leading-snug text-slate-600">
                <span className="font-mono text-[8px] text-brass-700">{index + 1}.</span>
                {action}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-2 text-[8px] text-slate-500">
        <span>
          {engine === "LLM"
            ? `Composed by ${model ?? "the configured model"} from the persisted APH matrix; every figure is traceable to a rule.`
            : "Composed on the server by the grounded rule engine. No external model call; every figure is traceable to a rule."}
        </span>
        <span className="font-mono uppercase tracking-label">
          {engine === "LLM" ? "LLM ENGINE" : "DETERMINISTIC ENGINE"}
        </span>
      </div>
    </section>
  );
}
