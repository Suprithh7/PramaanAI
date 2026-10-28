import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
} from "lucide-react";
import {
  commenceScrutinyAction,
  raiseDeficiencyAction,
  runAphAction,
} from "@/app/actions";
import { CaseActionForm } from "@/components/case/CaseActionForm";
import { ActionButton } from "@/components/ui/ActionFeedback";
import { SlaBadge, StatusBadge } from "@/components/ui/Badges";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { aphInputFor, aphSummary, evaluateAphRules } from "@/lib/aph";
import { canRaiseDeficiency } from "@/lib/fsm";
import { getPortfolio, getCase } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { liveDaysInStage, slaForDays } from "@/lib/sla";
import { APPLICATION_TYPE_LABELS, can, type ApplicationType } from "@/lib/types";
import { fmtDate, isoDay, shortRef } from "@/lib/format";

export const dynamic = "force-dynamic";

const OFFICER_STATUSES = [
  "SUBMITTED",
  "UNDER_SCRUTINY",
  "DEFICIENCY_REVERTED",
  "RE_SCRUTINY",
  "SCRUTINY_CLEARED",
];

export default async function ScrutinyPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string; q?: string }>;
}) {
  const session = await getSession();
  const params = await searchParams;
  const query = (params.q ?? "").trim().toLowerCase();

  const all = await getPortfolio(session);
  const queue = all
    .filter((app) => OFFICER_STATUSES.includes(app.status))
    .filter((app) =>
      query
        ? [app.institution.name, app.referenceNo, app.programName, app.institution.city]
            .join(" ")
            .toLowerCase()
            .includes(query)
        : true,
    )
    .sort((a, b) => liveDaysInStage(b.stageEnteredAt) - liveDaysInStage(a.stageEnteredAt));

  const selectedId = params.case ?? queue.find((app) => app.status === "UNDER_SCRUTINY")?.id ?? queue[0]?.id;
  const selected = selectedId ? await getCase(selectedId) : null;

  const counts = {
    waiting: all.filter((app) => app.status === "SUBMITTED").length,
    review: all.filter((app) => app.status === "UNDER_SCRUTINY").length,
    returned: all.filter((app) => app.status === "DEFICIENCY_REVERTED").length,
    responding: all.filter((app) => app.status === "RE_SCRUTINY").length,
  };

  const canRun = can(session.role, "RUN_APH");
  const canRaise = can(session.role, "RAISE_DEFICIENCY");
  const rules = selected ? evaluateAphRules(aphInputFor(selected)) : [];
  const summary = aphSummary(rules);
  const flagged = rules.filter((rule) => rule.status !== "PASSED");

  return (
    <>
      <PageHeader
        eyebrow="AICTE officer · desk review"
        title="Check an application against the rulebook"
        description="Pick a case. The system compares every declared number with the AICTE requirement and shows exactly what is missing. Nothing is checked by eye."
        meta={
          <>
            <span className="badge border-sky-300 bg-sky-50 text-sky-900">{counts.waiting} waiting</span>
            <span className="badge border-navy-300 bg-navy-50 text-navy-900">{counts.review} in review</span>
            <span className="badge border-red-300 bg-red-50 text-red-900">{counts.returned} with college</span>
            <span className="badge border-amber-300 bg-amber-50 text-amber-900">{counts.responding} re-checking</span>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
        <aside className="panel overflow-hidden lg:sticky lg:top-[150px]">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Queue</div>
              <h2 className="panel-title mt-0.5">Cases on your desk</h2>
            </div>
            <span className="font-mono text-xs text-slate-500">{queue.length}</span>
          </div>
          <form method="get" action="/scrutiny" className="border-b border-slate-200 px-3 py-2.5">
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="Search college or reference"
                className="input pl-8"
                aria-label="Search queue"
              />
            </div>
          </form>
          {queue.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">No cases match.</p>
          ) : (
            <ul className="max-h-[calc(100vh-270px)] divide-y divide-slate-200 overflow-y-auto">
              {queue.map((app) => {
                const active = app.id === selected?.id;
                const days = liveDaysInStage(app.stageEnteredAt);
                const failing = app.ruleChecks.filter((rule) => rule.status !== "PASSED").length;
                return (
                  <li key={app.id}>
                    <Link
                      href={`/scrutiny?case=${app.id}${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`}
                      className={`block px-3.5 py-3 transition ${
                        active ? "bg-navy-50 shadow-[inset_3px_0_0_#b98a2b]" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-semibold text-navy-800">
                          {shortRef(app.referenceNo)}
                        </span>
                        <SlaBadge status={slaForDays(days)} days={days} />
                      </div>
                      <div className="mt-1 truncate text-sm font-semibold text-navy-950">
                        {app.institution.name}
                      </div>
                      <div className="truncate text-xs text-slate-500">{app.programName}</div>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <StatusBadge status={app.status} />
                        {failing > 0 ? (
                          <span className="text-[11px] font-semibold text-red-700">
                            {failing} failing
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-emerald-700">All pass</span>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <div className="space-y-4">
          {!selected ? (
            <EmptyState
              title="Select a case from the queue"
              description="Every case shows its rule results, failing items and the next action."
            />
          ) : (
            <>
              <section className="panel">
                <div className="panel-header">
                  <div className="min-w-0">
                    <div className="eyebrow">
                      {shortRef(selected.referenceNo)} ·{" "}
                      {APPLICATION_TYPE_LABELS[selected.applicationType as ApplicationType] ??
                        selected.applicationType}
                    </div>
                    <h2 className="panel-title mt-0.5 truncate">
                      {selected.institution.name} — {selected.programName}
                    </h2>
                  </div>
                  <Link href={`/applications/${selected.id}`} className="btn btn-outline btn-xs">
                    Full case <ArrowRight size={12} />
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-4">
                  {[
                    {
                      label: "Rule result",
                      value: summary.flagged === 0 ? "All pass" : `${summary.flagged} failing`,
                      tone: summary.flagged === 0 ? "text-emerald-700" : "text-red-700",
                    },
                    {
                      label: "Declared students",
                      value: (selected.filingDeclaration?.studentIntake ?? selected.institution.studentIntake).toLocaleString("en-IN"),
                      tone: "text-navy-950",
                    },
                    {
                      label: "Full-time faculty",
                      value: (selected.filingDeclaration?.facultyCount ?? selected.institution.facultyCount).toLocaleString("en-IN"),
                      tone: "text-navy-950",
                    },
                    {
                      label: "Days in stage",
                      value: `${liveDaysInStage(selected.stageEnteredAt)}`,
                      tone: "text-navy-950",
                    },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-white px-4 py-3">
                      <div className={`font-serif text-2xl font-semibold ${stat.tone}`}>{stat.value}</div>
                      <div className="mt-1 text-[11px] font-semibold uppercase tracking-label text-slate-500">
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2.5 border-t border-slate-200 px-4 py-3">
                  <StatusBadge status={selected.status} />
                  <SlaBadge status={slaForDays(liveDaysInStage(selected.stageEnteredAt))} days={liveDaysInStage(selected.stageEnteredAt)} />
                  {selected.status === "SUBMITTED" && canRun && (
                    <ActionButton
                      action={commenceScrutinyAction}
                      fields={{ applicationId: selected.id }}
                      label="Start review"
                      pendingLabel="Starting…"
                      variant="primary"
                      size="xs"
                      icon={<Send size={12} />}
                    />
                  )}
                  {canRun && selected.status !== "SUBMITTED" && (
                    <ActionButton
                      action={runAphAction}
                      fields={{ applicationId: selected.id }}
                      label="Re-run checks"
                      pendingLabel="Checking…"
                      variant="outline"
                      size="xs"
                      icon={<RefreshCw size={12} />}
                    />
                  )}
                </div>
              </section>

              <section className="panel overflow-hidden">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">Rule-by-rule result</div>
                    <h2 className="panel-title mt-0.5">
                      {flagged.length === 0
                        ? "Every rule passes"
                        : `${flagged.length} rule${flagged.length === 1 ? "" : "s"} need a correction`}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <ShieldCheck size={14} className="text-emerald-700" /> Deterministic check
                  </div>
                </div>
                <div className="divide-y divide-slate-200">
                  {rules.map((rule) => {
                    const passed = rule.status === "PASSED";
                    return (
                      <div
                        key={rule.ruleCode}
                        className={`grid gap-3 px-4 py-3.5 sm:grid-cols-[100px_minmax(0,1.4fr)_minmax(0,1fr)_100px] sm:items-start ${
                          passed ? "" : "bg-red-50/40"
                        }`}
                      >
                        <div>
                          <div className="font-mono text-xs font-bold text-navy-900">{rule.ruleCode}</div>
                          <div className="mt-0.5 text-[11px] text-slate-500">{rule.source}</div>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-navy-950">{rule.ruleName}</div>
                          <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                            {rule.requirement}
                          </p>
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="font-mono">
                            <span className="text-slate-500">Declared: </span>
                            <span className="font-semibold text-navy-900">{rule.submittedValue}</span>
                          </div>
                          <div className="font-mono">
                            <span className="text-slate-500">Required: </span>
                            <span className="font-semibold text-navy-900">{rule.requiredValue}</span>
                          </div>
                          <p className={passed ? "text-slate-600" : "font-medium text-red-800"}>
                            {rule.remarks}
                          </p>
                        </div>
                        <div className="sm:text-right">
                          {passed ? (
                            <span className="badge border-emerald-300 bg-emerald-50 text-emerald-900">
                              <CheckCircle2 size={11} /> Pass
                            </span>
                          ) : (
                            <span className="badge border-red-300 bg-red-50 text-red-900">
                              <AlertTriangle size={11} /> Fail
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {canRaise && canRaiseDeficiency(selected.status) && (
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <div className="eyebrow">If the college must fix something</div>
                      <h2 className="panel-title mt-0.5">Send a deficiency notice</h2>
                    </div>
                    <Clock size={16} className="text-slate-400" />
                  </div>
                  <div className="p-4">
                    <CaseActionForm
                      action={raiseDeficiencyAction}
                      hidden={{ applicationId: selected.id }}
                      fields={[
                        {
                          name: "details",
                          label: "What must the college fix?",
                          type: "textarea",
                          required: true,
                          span: 2,
                          defaultValue:
                            flagged.length > 0
                              ? flagged
                                  .map(
                                    (rule) =>
                                      `${rule.ruleCode} ${rule.ruleName}: declared ${rule.submittedValue}; required ${rule.requiredValue}.`,
                                  )
                                  .join("\n")
                              : "",
                          placeholder: "State the rule, the declared figure and what is required.",
                        },
                        {
                          name: "deadline",
                          label: "Response due by",
                          type: "date",
                          required: true,
                          defaultValue: isoDay(new Date(Date.now() + 30 * 86_400_000)),
                        },
                      ]}
                      submitLabel="Issue notice"
                      pendingLabel="Issuing…"
                      variant="danger"
                      submitIcon={<AlertTriangle size={13} />}
                      description="The case returns to the college. A printable notice is created automatically."
                    />
                    <p className="mt-3 text-xs text-slate-500">
                      Last filed {fmtDate(selected.submittedAt)} · current stage entered{" "}
                      {fmtDate(selected.stageEnteredAt)}
                    </p>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
