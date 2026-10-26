import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  FileWarning,
  Gavel,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { commenceScrutinyAction, clearScrutinyAction, raiseDeficiencyAction, runAphAction } from "@/app/actions";
import { evaluateAphRules, aphSummary } from "@/lib/aph";
import { slaRows } from "@/lib/analytics";
import { auditActionLabel } from "@/lib/types";
import {
  APPLICATION_TYPE_LABELS,
  PROCESSING_PATH_META,
  REGION_META,
  ROLE_META,
  can,
  isTerminal,
  type ApplicationType,
  type ProcessingPath,
  type Region,
} from "@/lib/types";
import { fmtDate, fmtDateTime, fmtNumber, shortRef } from "@/lib/format";
import { SLA_POLICY, daysOverdue, liveDaysInStage, slaForDays } from "@/lib/sla";
import { getPortfolio, getCase } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { EmptyState, SlaMeter } from "@/components/ui/EmptyState";
import { ActionButton } from "@/components/ui/ActionFeedback";
import { DeficiencyStatusBadge, RuleStatusBadge, SlaBadge, StatusBadge } from "@/components/ui/Badges";
import { CaseActionForm } from "@/components/case/CaseActionForm";

export const dynamic = "force-dynamic";

type SearchParams = { case?: string };

const QUEUE_STATUSES = ["SUBMITTED", "UNDER_SCRUTINY", "DEFICIENCY_REVERTED", "RE_SCRUTINY"];

export default async function ScrutinyPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSession();
  const params = await searchParams;
  const all = await getPortfolio(session);
  const queue = slaRows(all.filter((app) => QUEUE_STATUSES.includes(app.status)));
  const requested = params.case;
  const selectedId =
    queue.find((row) => row.app.id === requested)?.app.id ?? queue[0]?.app.id ?? requested;
  const selected = selectedId ? await getCase(selectedId) : null;

  const openTickets = all.reduce(
    (sum, app) => sum + app.deficiencies.filter((ticket) => ticket.status === "OPEN").length,
    0,
  );
  const resubmitted = all.reduce(
    (sum, app) => sum + app.deficiencies.filter((ticket) => ticket.status === "RESUBMITTED").length,
    0,
  );
  const flaggedCases = queue.filter((row) => row.app.ruleChecks.some((rule) => rule.status !== "PASSED")).length;
  const breaches = queue.filter((row) => row.sla === "BREACHED").length;
  const oldest = queue[0]?.days ?? 0;

  const liveRules = selected
    ? evaluateAphRules({
        applicationType: selected.applicationType,
        institution: selected.institution,
        documents: selected.institution.documents,
      })
    : [];
  const liveSummary = aphSummary(liveRules);
  const liveFlagged = liveRules.filter((rule) => rule.status !== "PASSED");
  const openTicket = selected?.deficiencies.find((ticket) => ticket.status === "OPEN");
  const pendingTicket = selected?.deficiencies.find((ticket) => ticket.status === "RESUBMITTED");
  const days = selected ? liveDaysInStage(selected.stageEnteredAt) : 0;
  const overdue = selected ? daysOverdue(selected.stageEnteredAt) : 0;

  const canRun = !!selected && can(session.role, "RUN_APH") && !isTerminal(selected.status);
  const canCommence = canRun && selected?.status === "SUBMITTED";
  const canClear = canRun && selected?.status === "UNDER_SCRUTINY";
  const canRaise =
    !!selected &&
    can(session.role, "RAISE_DEFICIENCY") &&
    ["UNDER_SCRUTINY", "RE_SCRUTINY"].includes(selected.status) &&
    !openTicket;
  const canAccept =
    !!selected &&
    can(session.role, "ACCEPT_RESUBMISSION") &&
    selected.status === "RE_SCRUTINY" &&
    !!pendingTicket;

  const failedSummary = liveFlagged.map((rule) => `${rule.ruleCode} ${rule.ruleName}`).join("; ");
  const raiseDraft = liveFlagged.length
    ? `The following APH conditions are unmet on current evidence: ${failedSummary}. Submit corrected evidence against each rule for re-scrutiny.`
    : "The following deficiencies were identified during statutory scrutiny. Submit corrected evidence against each item.";
  const defaultDeadline = new Date(Date.now() + SLA_POLICY.deficiencyWindowDays * 86_400_000)
    .toISOString()
    .slice(0, 10);

  return (
    <>
      <PageHeader
        eyebrow={`${ROLE_META[session.role].short} authority · APH scrutiny`}
        title="Scrutiny & re-scrutiny workbench"
        description="Evaluate the deterministic APH matrix, issue formal deficiency notices and clear cases for inspection. Every decision is written to the hash-linked ledger."
        meta={
          <>
            <span className="badge border-navy-300 bg-navy-50 text-navy-900">{queue.length} in queue</span>
            <span className={`text-[10px] font-semibold ${breaches > 0 ? "text-red-700" : "text-emerald-700"}`}>
              {breaches} breach{breaches === 1 ? "" : "es"}
            </span>
            <span className="text-[10px] text-slate-600">{flaggedCases} with APH flags</span>
            <span className="text-[10px] text-slate-600">{openTickets} open notice{openTickets === 1 ? "" : "s"}</span>
            <span className="text-[10px] text-slate-600">{resubmitted} awaiting acceptance</span>
          </>
        }
        actions={
          <>
            <Link href="/applications" className="btn btn-outline">
              <ClipboardList size={11} /> Full register
            </Link>
            <Link href="/audit" className="btn btn-outline">
              <ShieldCheck size={11} /> Audit ledger
            </Link>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <MetricCard
          label="Scrutiny queue"
          value={queue.length}
          unit="cases"
          icon={<Scale size={13} />}
          detail={`${queue.filter((row) => row.app.status === "SUBMITTED").length} awaiting commencement`}
        />
        <MetricCard
          label="Oldest stage clock"
          value={oldest}
          unit="days"
          tone={oldest > SLA_POLICY.breachAfterDays ? "red" : oldest >= SLA_POLICY.warningAtDays ? "amber" : "emerald"}
          icon={<Activity size={13} />}
          detail={oldest > SLA_POLICY.breachAfterDays ? "Auto-escalation live" : "Within the statutory limit"}
        />
        <MetricCard
          label="Deficiency loop"
          value={openTickets}
          unit="open"
          tone="red"
          icon={<FileWarning size={13} />}
          detail={`${resubmitted} resubmission${resubmitted === 1 ? "" : "s"} pending acceptance`}
        />
        <MetricCard
          label="APH compliance"
          value={liveSummary.passed + liveSummary.flagged > 0 ? `${liveSummary.score}%` : "—"}
          tone="emerald"
          icon={<CheckCircle2 size={13} />}
          detail={selected ? `${liveSummary.flagged} live flag${liveSummary.flagged === 1 ? "" : "s"} on selected case` : "Select a case to evaluate"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="panel flex flex-col">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Clock order · most urgent first</div>
              <h2 className="panel-title mt-0.5">Scrutiny queue</h2>
            </div>
            <span className="font-mono text-[10px] text-slate-500">{queue.length} cases</span>
          </div>

          {queue.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Scrutiny queue is clear"
                description="No filings are awaiting desk scrutiny. New submissions appear here immediately."
                icon={<CheckCircle2 size={16} />}
              />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {queue.map(({ app, days: rowDays, sla }) => {
                const active = app.id === selected?.id;
                const ticket = app.deficiencies.find((item) => item.status === "OPEN");
                const flags = app.ruleChecks.filter((rule) => rule.status !== "PASSED").length;
                return (
                  <li key={app.id}>
                    <Link
                      href={`/scrutiny?case=${app.id}`}
                      className={`block px-3.5 py-3 transition ${
                        active ? "border-l-2 border-brass-500 bg-brass-50/50" : "border-l-2 border-transparent hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono text-[10px] font-semibold text-navy-900">{shortRef(app.referenceNo)}</div>
                          <div className="mt-0.5 truncate text-[11px] font-medium text-navy-950">{app.institution.name}</div>
                          <div className="mt-0.5 truncate text-[9px] text-slate-500">
                            {app.programName} · {fmtNumber(app.intakeRequested)} seats
                          </div>
                        </div>
                        <ArrowUpRight size={11} className={active ? "text-brass-700" : "text-slate-300"} />
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        <StatusBadge status={app.status} />
                        <SlaBadge status={sla} days={rowDays} />
                        {flags > 0 && (
                          <span className="badge border-red-200 bg-white text-red-800">{flags} APH</span>
                        )}
                      </div>
                      <div className="mt-1.5">
                        <SlaMeter days={rowDays} />
                      </div>
                      {ticket && (
                        <div className="mt-1 text-[9px] font-medium text-red-700">
                          Notice {ticket.noticeNo ?? "pending"} · due {fmtDate(ticket.complianceDeadline)}
                        </div>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          </section>

        {selected ? (
          <div className="space-y-4">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <div className="eyebrow">
                    {APPLICATION_TYPE_LABELS[selected.applicationType as ApplicationType] ?? selected.applicationType} ·{" "}
                    {PROCESSING_PATH_META[selected.processingPath as ProcessingPath]?.route ?? selected.processingPath}
                  </div>
                  <h2 className="panel-title mt-0.5">{selected.institution.name}</h2>
                </div>
                <Link href={`/applications/${selected.id}`} className="btn btn-outline btn-xs">
                  Case workspace <ArrowUpRight size={10} />
                </Link>
              </div>

              <div className="grid grid-cols-1 gap-3 border-b border-slate-200 p-4 md:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="badge border-navy-300 bg-navy-50 text-navy-900">{selected.referenceNo}</span>
                    <StatusBadge status={selected.status} />
                    <SlaBadge status={slaForDays(days)} days={days} />
                    <span className="badge border-slate-300 bg-white text-slate-700">
                      {REGION_META[selected.institution.region as Region]?.label ?? selected.institution.region}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
                    {selected.programName} · {fmtNumber(selected.intakeRequested)} seats requested · stage entered{" "}
                    {fmtDate(selected.stageEnteredAt)}
                    {overdue > 0 ? ` · ${overdue} day${overdue === 1 ? "" : "s"} beyond the ${SLA_POLICY.deadlineDays}-day limit` : ""}.
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      ["Land", `${selected.institution.totalLandAcres.toFixed(1)} ac`],
                      ["Built-up", `${fmtNumber(selected.institution.builtUpAreaSqM)} sqm`],
                      ["Faculty", fmtNumber(selected.institution.facultyCount)],
                      ["Intake", fmtNumber(selected.institution.studentIntake)],
                    ].map(([label, value]) => (
                      <div key={label} className="border border-slate-200 bg-slate-50 px-2 py-1.5">
                        <div className="text-[8px] uppercase tracking-label text-slate-400">{label}</div>
                        <div className="font-mono text-[11px] font-semibold text-navy-900">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="w-full min-w-[190px] self-start border border-slate-200 bg-white p-2.5 md:w-[220px]">
                  <div className="flex items-center justify-between">
                    <span className="label">Statutory clock</span>
                    <span className="font-mono text-[11px] font-semibold text-navy-900">{days}d</span>
                  </div>
                  <div className="mt-2">
                    <SlaMeter days={days} />
                  </div>
                  <div className="mt-2 space-y-1 text-[9px] text-slate-500">
                    <div className="flex justify-between">
                      <span>Deadline</span>
                      <span className="font-mono text-navy-900">{fmtDate(new Date(selected.stageEnteredAt.getTime() + SLA_POLICY.deadlineDays * 86_400_000))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Overdue</span>
                      <span className={`font-mono ${overdue > 0 ? "font-semibold text-red-700" : "text-emerald-700"}`}>
                        {overdue > 0 ? `${overdue}d` : "nil"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Path</span>
                      <span>{PROCESSING_PATH_META[selected.processingPath as ProcessingPath]?.label ?? selected.processingPath}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/60 px-4 py-2.5">
                {canCommence && (
                  <ActionButton
                    action={commenceScrutinyAction}
                    fields={{ applicationId: selected.id }}
                    label="Commence scrutiny"
                    pendingLabel="Starting…"
                    variant="primary"
                    icon={<Gavel size={11} />}
                  />
                )}
                {canRun && (
                  <ActionButton
                    action={runAphAction}
                    fields={{ applicationId: selected.id }}
                    label="Run APH evaluation"
                    pendingLabel="Evaluating…"
                    variant={canCommence ? "outline" : "primary"}
                    icon={<Activity size={11} />}
                  />
                )}
                {canClear && (
                  <ActionButton
                    action={clearScrutinyAction}
                    fields={{ applicationId: selected.id }}
                    label="Clear scrutiny"
                    pendingLabel="Clearing…"
                    variant="emerald"
                    icon={<CheckCircle2 size={11} />}
                    disabled={liveSummary.flagged > 0}
                    disabledReason={`${liveSummary.flagged} APH rule${liveSummary.flagged === 1 ? "" : "s"} must pass before clearance.`}
                  />
                )}
                {canAccept && pendingTicket && (
                  <Link href={`/applications/${selected.id}?tab=deficiency`} className="btn btn-brass btn-sm">
                    <CheckCircle2 size={11} /> Review resubmission
                  </Link>
                )}
                {openTicket && (
                  <span className="inline-flex items-center gap-1 border border-red-300 bg-red-50 px-2 py-1 text-[9px] font-semibold uppercase tracking-label text-red-900">
                    <AlertTriangle size={10} /> Notice open · due {fmtDate(openTicket.complianceDeadline)}
                  </span>
                )}
                {!canRun && (
                  <span className="text-[10px] text-slate-500">
                    Write actions are restricted to the Regional Officer and Bureau.
                  </span>
                )}
              </div>

              <div className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <div className="eyebrow">Live deterministic evaluation</div>
                    <h3 className="font-serif text-sm font-semibold text-navy-950">APH 2026–27 rule matrix</h3>
                  </div>
                  <div className="text-right text-[9px] text-slate-500">
                    <div className="font-mono text-[11px] font-semibold text-navy-900">
                      {liveSummary.passed}/{liveSummary.total} passed
                    </div>
                    <div>{liveSummary.flagged} deficiency flag{liveSummary.flagged === 1 ? "" : "s"}</div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table min-w-[560px]">
                    <thead>
                      <tr>
                        <th className="w-[120px]">Rule</th>
                        <th>Live finding</th>
                        <th className="w-[96px]">Status</th>
                        <th className="w-[200px]">Correction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveRules.map((rule) => (
                        <tr key={rule.ruleCode} className={rule.status !== "PASSED" ? "rule-flag" : undefined}>
                          <td>
                            <div className="font-mono text-[10px] font-semibold text-navy-900">{rule.ruleCode}</div>
                            <div className="text-[9px] text-slate-600">{rule.ruleName}</div>
                            <div className="mt-0.5 font-mono text-[8px] text-slate-400">{rule.requiredValue}</div>
                          </td>
                          <td className="text-[9px] leading-snug text-slate-700">{rule.submittedValue}</td>
                          <td>
                            <RuleStatusBadge status={rule.status} />
                          </td>
                          <td className="text-[9px] leading-snug text-slate-500">{rule.remarks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {canRaise && (
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">Module 2 · statutory notice</div>
                    <h2 className="panel-title mt-0.5">Issue formal deficiency</h2>
                  </div>
                  <span className="text-[9px] text-slate-500">
                    Evidence window {SLA_POLICY.deficiencyWindowDays} days
                  </span>
                </div>
                <div className="p-4">
                  <CaseActionForm
                    action={raiseDeficiencyAction}
                    hidden={{ applicationId: selected.id }}
                    description="The notice records the live APH failures, stops the scrutiny clock and opens the two-way deficiency loop. A printable notice is generated immediately."
                    fields={[
                      {
                        name: "details",
                        label: "Deficiency statement",
                        type: "textarea",
                        required: true,
                        defaultValue: raiseDraft,
                        hint: "Minimum 30 characters. The live APH rule failures are recorded on the notice automatically.",
                      },
                      {
                        name: "deadline",
                        label: "Compliance deadline",
                        type: "date",
                        required: true,
                        defaultValue: defaultDeadline,
                        hint: "Must be a future date within the statutory evidence window.",
                      },
                    ]}
                    submitLabel="Issue notice & route to institution"
                    pendingLabel="Issuing notice…"
                    variant="danger"
                    submitIcon={<FileWarning size={11} />}
                    confirm="Issue a formal deficiency notice and stop the scrutiny clock?"
                  />
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">Evidence on record</div>
                    <h2 className="panel-title mt-0.5">Deficiency notices</h2>
                  </div>
                  <Link href={`/applications/${selected.id}?tab=deficiency`} className="text-[9px] font-semibold uppercase tracking-label text-navy-800 hover:underline">
                    Open register
                  </Link>
                </div>
                {selected.deficiencies.length === 0 ? (
                  <div className="p-4">
                    <EmptyState title="No notices issued" description="This case has not entered the deficiency loop." icon={<FileWarning size={16} />} />
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {selected.deficiencies.slice(0, 3).map((ticket) => (
                      <li key={ticket.id} className="px-4 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[9px] font-semibold text-navy-900">
                            {ticket.noticeNo ?? "Pending numbering"}
                          </span>
                          <DeficiencyStatusBadge status={ticket.status} />
                        </div>
                        <p className="mt-1 line-clamp-2 text-[9px] leading-snug text-slate-600">{ticket.deficiencyDetails}</p>
                        <div className="mt-1 flex items-center justify-between text-[8px] uppercase tracking-label text-slate-400">
                          <span>Due {fmtDate(ticket.complianceDeadline)}</span>
                          <Link href={`/applications/${selected.id}/notice?ticket=${ticket.id}`} className="hover:text-navy-800">
                            Printable notice →
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="panel">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">Hash-linked evidence</div>
                    <h2 className="panel-title mt-0.5">Recent case events</h2>
                  </div>
                  <Link href={`/applications/${selected.id}?tab=ledger`} className="text-[9px] font-semibold uppercase tracking-label text-navy-800 hover:underline">
                    Full ledger
                  </Link>
                </div>
                {selected.auditLogs.length === 0 ? (
                  <div className="p-4">
                    <EmptyState title="No ledger events" icon={<ShieldCheck size={16} />} />
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {selected.auditLogs.slice(0, 4).map((log) => (
                      <li key={log.id} className="px-4 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-medium text-navy-950">{auditActionLabel(log.action)}</span>
                          <span className="font-mono text-[8px] text-slate-400">#{String(log.sequence).padStart(4, "0")}</span>
                        </div>
                        <div className="mt-0.5 text-[8px] text-slate-500">
                          {log.performedBy} · {fmtDateTime(log.timestamp)}
                        </div>
                        {log.detail && <p className="mt-1 line-clamp-1 text-[8px] leading-snug text-slate-500">{log.detail}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        ) : (
          <section className="panel flex items-center justify-center p-8">
            <EmptyState
              title="Select a case to begin scrutiny"
              description="Pick a filing from the queue. The live APH matrix, statutory clock and deficiency controls will load here."
              icon={<Scale size={16} />}
            >
              <Link href="/applications" className="btn btn-outline btn-xs">
                Browse the register
              </Link>
            </EmptyState>
          </section>
        )}
      </div>
    </>
  );
}
