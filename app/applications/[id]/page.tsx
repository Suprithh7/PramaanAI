import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileCheck2,
  FileText,
  Fingerprint,
  GitCommitHorizontal,
  MapPin,
  Printer,
  Scale,
  ShieldCheck,
  Timer,
} from "lucide-react";
import {
  acceptResubmissionAction,
  attestLedgerAction,
  clearScrutinyAction,
  commenceScrutinyAction,
  decideApplicationAction,
  raiseDeficiencyAction,
  resubmitDeficiencyAction,
  routeToShcAction,
  runAphAction,
  scheduleEvcAction,
  submitSiteReportAction,
} from "@/app/actions";
import { evaluateAphRules, aphSummary } from "@/lib/aph";
import { getConsistencyReport } from "@/lib/consistency";
import { checkConflict, EVC_ROSTER } from "@/lib/evc";
import { canAcceptResubmission, canDecide, canRaiseDeficiency, canRunAph, canScheduleEvc, canSubmitSiteReport, pathHasEvc } from "@/lib/fsm";
import { fmtDate, fmtDateTime, fmtNumber, isoDay, shortRef, truncateHash } from "@/lib/format";
import { getCase } from "@/lib/queries";
import { toEvidenceRow } from "@/lib/evidence";
import { getSession } from "@/lib/session";
import { SLA_POLICY, daysOverdue, liveDaysInStage, slaForDays, stageDeadline, stageElapsedPercent } from "@/lib/sla";
import {
  APPLICATION_TYPE_LABELS,
  PROCESSING_PATH_META,
  REGION_META,
  ROLE_META,
  auditActionLabel,
  can,
  type ApplicationType,
  type DocType,
  type ProcessingPath,
  type Region,
} from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionButton } from "@/components/ui/ActionFeedback";
import {
  ConflictBadge,
  DeficiencyStatusBadge,
  DocStatusBadge,
  EscalationStatusBadge,
  EvcReportBadge,
  RuleStatusBadge,
  SlaBadge,
  StatusBadge,
} from "@/components/ui/Badges";
import { EmptyState, SlaMeter } from "@/components/ui/EmptyState";
import { CopyButton } from "@/components/ui/CopyButton";
import { CaseActionForm } from "@/components/case/CaseActionForm";
import { EvidenceIntake } from "@/components/case/EvidenceIntake";
import { LiveStatutoryClock } from "@/components/case/LiveStatutoryClock";
import { WorkflowRail } from "@/components/case/WorkflowRail";
import { DOC_TYPE_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "case", label: "Case file", icon: FileText },
  { key: "aph", label: "APH matrix", icon: Scale },
  { key: "deficiency", label: "Deficiency & evidence", icon: FileCheck2 },
  { key: "evc", label: "EVC inspection", icon: ClipboardCheck },
  { key: "evidence", label: "Evidence & integrity", icon: Fingerprint },
  { key: "ledger", label: "Audit ledger", icon: GitCommitHorizontal },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function ApplicationCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  const { id } = await params;
  const { tab } = await searchParams;
  const app = await getCase(id);

  if (!app) notFound();
  if (session.role === "INSTITUTION_ADMIN" && session.tenant?.id !== app.institutionId) notFound();

  const activeTab: TabKey = TABS.some((item) => item.key === tab) ? (tab as TabKey) : "case";
  const role = session.role;

  const days = liveDaysInStage(app.stageEnteredAt);
  const slaStatus = slaForDays(days);
  const deadline = stageDeadline(app.stageEnteredAt);
  const overdue = daysOverdue(app.stageEnteredAt);

  const liveRules = evaluateAphRules({
    applicationType: app.applicationType,
    institution: app.institution,
    documents: app.institution.documents,
  });
  const liveSummary = aphSummary(liveRules);
  const flaggedRules = liveRules.filter((rule) => rule.status !== "PASSED");
  const persistedFlagged = app.ruleChecks.filter((rule) => rule.status !== "PASSED");

  const openTicket = app.deficiencies.find((ticket) => ticket.status === "OPEN");
  const pendingTicket = app.deficiencies.find((ticket) => ticket.status === "RESUBMITTED");
  const latestTicket = app.deficiencies[0];
  const latestInspection = app.inspections[0];
  const activeEscalations = app.escalations.filter((ticket) => ticket.status !== "RESOLVED");

  const canRun = can(role, "RUN_APH") && canRunAph(app.status);
  const canClear = can(role, "RUN_APH") && app.status === "UNDER_SCRUTINY";
  const canRaise = can(role, "RAISE_DEFICIENCY") && canRaiseDeficiency(app.status) && !openTicket;
  const canResubmit =
    role === "INSTITUTION_ADMIN" && !!openTicket && app.status === "DEFICIENCY_REVERTED";
  const canAccept =
    can(role, "ACCEPT_RESUBMISSION") &&
    !!pendingTicket &&
    app.status === "RE_SCRUTINY" &&
    canAcceptResubmission(app.status);
  const canSchedule =
    can(role, "SCHEDULE_EVC") &&
    canScheduleEvc(app.status) &&
    app.inspections.length === 0 &&
    pathHasEvc(app.processingPath);
  const canFileReport =
    role === "EVC_MEMBER" &&
    canSubmitSiteReport(app.status) &&
    !!latestInspection &&
    latestInspection.siteReportStatus !== "COMPLETED";
  const canDecideNow = can(role, "DECIDE_APPLICATION") && canDecide(app.status);
  const canRouteShc = role === "BUREAU_OFFICER" && app.status === "SAC_REVIEW";

  const regionMeta = REGION_META[app.institution.region as Region];
  const admissions = app.institution.studentIntake;
  const areaPerStudent =
    admissions > 0 ? app.institution.builtUpAreaSqM / admissions : 0;
  const facultyRatio = app.institution.facultyCount > 0 ? admissions / app.institution.facultyCount : 0;
  const lease = app.institution.documents.find((document) => document.docType === "LEASE_DEED");
  const evidenceRows = app.evidenceFiles.map(toEvidenceRow);
  const evidenceTampered = evidenceRows.filter((row) => row.integrity === "TAMPERED").length;
  const consistency = activeTab === "evidence" ? await getConsistencyReport(app.institutionId) : null;
  const roster = EVC_ROSTER.map((member) => ({
    ...member,
    conflict: checkConflict(member, app.institution),
  }));

  const tabHref = (key: TabKey) => `/applications/${app.id}?tab=${key}`;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Application register", href: "/applications" }, { label: shortRef(app.referenceNo) }]}
        eyebrow={`${APPLICATION_TYPE_LABELS[app.applicationType as ApplicationType] ?? app.applicationType} · ${PROCESSING_PATH_META[app.processingPath as ProcessingPath]?.label ?? app.processingPath}`}
        title={app.institution.name}
        description={`${app.programName} · ${fmtNumber(app.intakeRequested)} seats requested · ${app.referenceNo}`}
        meta={
          <>
            <StatusBadge status={app.status} />
            <SlaBadge status={slaStatus} days={days} />
            <span className="flex items-center gap-1 text-[10px] text-slate-600">
              <MapPin size={10} className="text-slate-400" />
              {regionMeta?.label ?? app.institution.region} · {app.institution.city}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-slate-600">
              <CalendarClock size={10} className="text-slate-400" />
              Stage entered {fmtDate(app.stageEnteredAt)}
            </span>
            <span className="text-[10px] text-slate-600">
              {flaggedRules.length} live APH flag{flaggedRules.length === 1 ? "" : "s"}
            </span>
          </>
        }
        actions={
          <>
            <Link href="/applications" className="btn btn-outline">
              <ArrowLeft size={11} /> Register
            </Link>
            {latestTicket && (
              <>
                <Link
                  href={`/applications/${app.id}/notice?ticket=${latestTicket.id}`}
                  className="btn btn-outline"
                >
                  <Printer size={11} /> Deficiency notice
                </Link>
                <a href={`/api/notice/${latestTicket.id}`} className="btn btn-outline">
                  <Download size={11} /> Download notice
                </a>
              </>
            )}
          </>
        }
      />

      <div className="space-y-4">
        <LiveStatutoryClock
          stageEnteredAt={app.stageEnteredAt.toISOString()}
          serverNow={new Date().toISOString()}
          enteredLabel={fmtDate(app.stageEnteredAt)}
          deadlineLabel={fmtDate(deadline)}
          warningAtDays={SLA_POLICY.warningAtDays}
          breachAfterDays={SLA_POLICY.breachAfterDays}
          deadlineDays={SLA_POLICY.deadlineDays}
        />

        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5">
            <div>
              <div className="eyebrow">Workflow rail · {PROCESSING_PATH_META[app.processingPath as ProcessingPath]?.route ?? app.processingPath}</div>
              <h2 className="panel-title mt-0.5">Statutory processing path</h2>
            </div>
            <div className="flex items-center gap-3 text-[9px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 bg-emerald-600" /> Complete
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 bg-brass-500" /> Current
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 bg-red-600" /> Returned
              </span>
            </div>
          </div>
          <WorkflowRail status={app.status} path={app.processingPath} />
        </section>

        <nav aria-label="Case sections" className="flex flex-wrap border border-slate-300 bg-white">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.key;
            const badge =
              item.key === "aph"
                ? liveSummary.flagged
                : item.key === "deficiency"
                  ? openTicket
                    ? 1
                    : 0
                  : item.key === "evc"
                    ? latestInspection?.siteReportStatus === "OVERDUE"
                      ? 1
                      : 0
                    : item.key === "evidence"
                      ? evidenceRows.length
                      : item.key === "ledger"
                        ? app.auditLogs.length
                        : 0;
            return (
              <Link
                key={item.key}
                href={tabHref(item.key)}
                className={`relative inline-flex items-center gap-1.5 border-r border-slate-200 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-label transition last:border-r-0 ${
                  active
                    ? "bg-navy-950 text-white"
                    : "text-slate-600 hover:bg-slate-50 hover:text-navy-900"
                }`}
              >
                <Icon size={12} className={active ? "text-brass-300" : "text-slate-400"} />
                {item.label}
                {badge > 0 && (
                  <span
                    className={`ml-0.5 px-1 font-mono text-[8px] ${
                      active
                        ? "bg-brass-500 text-navy-950"
                        : item.key === "aph" || item.key === "deficiency" || item.key === "evc" || (item.key === "evidence" && evidenceTampered > 0)
                          ? "bg-red-100 text-red-800"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {badge}
                  </span>
                )}
                {active && <span className="absolute inset-x-0 bottom-0 h-[2px] bg-brass-500" />}
              </Link>
            );
          })}
        </nav>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_318px]">
          <div className="min-w-0 space-y-4">
            {activeTab === "case" && (
              <>
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <div className="eyebrow">Application record</div>
                      <h2 className="panel-title mt-0.5">Case file</h2>
                    </div>
                    <span className="font-mono text-[10px] text-slate-500">{app.referenceNo}</span>
                  </div>
                  <dl className="grid grid-cols-1 gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      ["Institution code", app.institution.code],
                      ["Application type", APPLICATION_TYPE_LABELS[app.applicationType as ApplicationType] ?? app.applicationType],
                      ["Programme", app.programName],
                      ["Intake requested", `${fmtNumber(app.intakeRequested)} seats`],
                      ["Processing path", PROCESSING_PATH_META[app.processingPath as ProcessingPath]?.route ?? app.processingPath],
                      ["Region", `${regionMeta?.label ?? app.institution.region} · ${regionMeta?.hq ?? ""}`],
                      ["Submitted on", fmtDate(app.submittedAt)],
                      ["Stage entered", fmtDate(app.stageEnteredAt)],
                      ["Days in stage", `${days} days`],
                      ["Assigned officer", app.assignedOfficerId ?? "Regional pool"],
                      ["Decision date", app.decisionAt ? fmtDate(app.decisionAt) : "Pending"],
                      ["Approval order", app.approvalOrderNo ?? "Not issued"],
                    ].map(([label, value]) => (
                      <div key={label} className="bg-white px-3 py-2">
                        <dt className="text-[8px] font-semibold uppercase tracking-label text-slate-500">{label}</dt>
                        <dd className="mt-0.5 text-[11px] font-medium text-navy-950">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="border-t border-slate-200 px-4 py-2.5">
                    <div className="label">Case remarks</div>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-700">{app.remarks ?? "No remarks recorded."}</p>
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <div className="eyebrow">Statutory profile · as filed</div>
                      <h2 className="panel-title mt-0.5">Institutional capacity metrics</h2>
                    </div>
                    <span className="text-[9px] text-slate-500">{app.institution.state}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-3">
                    {[
                      ["Total land", `${app.institution.totalLandAcres.toFixed(1)} acres`, app.institution.totalLandAcres >= 10 ? "pass" : "fail"],
                      ["Built-up area", `${fmtNumber(app.institution.builtUpAreaSqM)} sqm`, areaPerStudent >= 10 ? "pass" : "fail"],
                      ["Full-time faculty", fmtNumber(app.institution.facultyCount), facultyRatio <= 15 ? "pass" : "fail"],
                      ["Sanctioned intake", fmtNumber(admissions), "neutral"],
                      ["Area per student", `${areaPerStudent.toFixed(2)} sqm`, areaPerStudent >= 10 ? "pass" : "fail"],
                      ["Faculty ratio", facultyRatio > 0 ? `1:${facultyRatio.toFixed(2)}` : "—", facultyRatio <= 15 ? "pass" : "fail"],
                    ].map(([label, value, tone]) => (
                      <div key={label} className="bg-white px-3 py-2.5">
                        <div className="text-[8px] font-semibold uppercase tracking-label text-slate-500">{label}</div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="font-serif text-lg font-semibold leading-none text-navy-950">{value}</span>
                          {tone !== "neutral" && (
                            <span
                              className={`h-1.5 w-1.5 ${tone === "pass" ? "bg-emerald-600" : "bg-red-600"}`}
                              title={tone === "pass" ? "Meets APH threshold" : "Below APH threshold"}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-2 text-[9px] text-slate-500">
                    <span>
                      Lease deed {lease ? `expires ${fmtDate(lease.expiryDate)}` : "not on record"} · affiliating university{" "}
                      {app.institution.affiliatingUniversity}
                    </span>
                    <span className="font-mono">{app.institution.latitude.toFixed(4)}, {app.institution.longitude.toFixed(4)}</span>
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <div className="eyebrow">Permitted transitions</div>
                      <h2 className="panel-title mt-0.5">Stage controls</h2>
                    </div>
                    <span className="text-[9px] text-slate-500">
                      Acting as {ROLE_META[role].label}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-start gap-2 p-4">
                    {role === "REGIONAL_OFFICER" && app.status === "SUBMITTED" && (
                      <ActionButton
                        action={commenceScrutinyAction}
                        fields={{ applicationId: app.id }}
                        label="Commence scrutiny"
                        pendingLabel="Starting…"
                        variant="primary"
                        icon={<Timer size={11} />}
                      />
                    )}
                    {canRun && (
                      <ActionButton
                        action={runAphAction}
                        fields={{ applicationId: app.id }}
                        label="Run APH evaluation"
                        pendingLabel="Evaluating…"
                        variant="primary"
                        icon={<Scale size={11} />}
                      />
                    )}
                    {canClear && (
                      <ActionButton
                        action={clearScrutinyAction}
                        fields={{ applicationId: app.id }}
                        label="Clear scrutiny"
                        pendingLabel="Clearing…"
                        variant="emerald"
                        icon={<CheckCircle2 size={11} />}
                        confirm="Re-evaluate all APH rules and clear scrutiny if every rule passes?"
                      />
                    )}
                    {canRaise && (
                      <Link href={tabHref("deficiency")} className="btn btn-danger">
                        <AlertTriangle size={11} /> Issue formal notice
                      </Link>
                    )}
                    {canResubmit && (
                      <Link href={tabHref("deficiency")} className="btn btn-danger">
                        <FileCheck2 size={11} /> File evidence
                      </Link>
                    )}
                    {canAccept && (
                      <Link href={tabHref("deficiency")} className="btn btn-emerald">
                        <CheckCircle2 size={11} /> Accept resubmission
                      </Link>
                    )}
                    {canSchedule && (
                      <Link href={tabHref("evc")} className="btn btn-primary">
                        <ClipboardCheck size={11} /> Constitute EVC
                      </Link>
                    )}
                    {canFileReport && (
                      <Link href={tabHref("evc")} className="btn btn-primary">
                        <MapPin size={11} /> File site report
                      </Link>
                    )}
                    {canRouteShc && (
                      <ActionButton
                        action={routeToShcAction}
                        fields={{ applicationId: app.id }}
                        label="Route to SHC"
                        pendingLabel="Routing…"
                        variant="primary"
                        icon={<ArrowUpRight size={11} />}
                        confirm="Route this SAC case to the Standing Hearing Committee?"
                      />
                    )}
                    {!canRun &&
                      !canClear &&
                      !canRaise &&
                      !canResubmit &&
                      !canAccept &&
                      !canSchedule &&
                      !canFileReport &&
                      !canRouteShc &&
                      role !== "REGIONAL_OFFICER" && (
                        <p className="text-[11px] text-slate-500">
                          No stage transition is available to {ROLE_META[role].label} in {app.status.replaceAll("_", " ").toLowerCase()}. Review the other case tabs for the full evidence record.
                        </p>
                      )}
                    {role === "REGIONAL_OFFICER" && !canRun && !canClear && !canRaise && !canAccept && !canSchedule && (
                      <p className="text-[11px] text-slate-500">
                        No regional transition is pending in this stage. The statutory clock remains active under the{" "}
                        {PROCESSING_PATH_META[app.processingPath as ProcessingPath]?.label ?? app.processingPath} path.
                      </p>
                    )}
                  </div>
                </section>

                {canDecideNow && (
                  <section className="panel">
                    <div className="panel-header">
                      <div>
                        <div className="eyebrow">Bureau authority</div>
                        <h2 className="panel-title mt-0.5">Record final decision</h2>
                      </div>
                      <span className="badge border-brass-300 bg-brass-50 text-brass-800">Reasoned order</span>
                    </div>
                    <div className="p-4">
                      <CaseActionForm
                        action={decideApplicationAction}
                        hidden={{ applicationId: app.id }}
                        fields={[
                          {
                            name: "decision",
                            label: "Final decision",
                            type: "select",
                            required: true,
                            defaultValue: "APPROVED",
                            options: [
                              { value: "APPROVED", label: "Approve and issue EOA" },
                              { value: "REJECTED", label: "Reject with reasoned order" },
                            ],
                          },
                          {
                            name: "orderNo",
                            label: "Approval order number",
                            placeholder: "Auto-generated if left blank",
                          },
                          {
                            name: "note",
                            label: "Reasoned order / note",
                            type: "textarea",
                            placeholder: "Record the competent authority's reasons. Required for a rejection.",
                            span: 2,
                          },
                        ]}
                        submitLabel="Record decision"
                        pendingLabel="Recording…"
                        variant="primary"
                        description="The decision closes the case and appends a signed event to the national ledger. Approval issues a Letter of Approval; rejection requires a reasoned order of at least 20 characters."
                        confirm="Record this final decision? The case will close and the order will be written to the immutable ledger."
                      />
                    </div>
                  </section>
                )}
              </>
            )}

            {activeTab === "aph" && (
              <>
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <div className="eyebrow">APH 2026–27 · automated validation</div>
                      <h2 className="panel-title mt-0.5">Rule evaluation matrix</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-slate-500">
                        {liveSummary.passed}/{liveSummary.total} passed
                      </span>
                      {canRun && (
                        <ActionButton
                          action={runAphAction}
                          fields={{ applicationId: app.id }}
                          label="Run evaluation"
                          pendingLabel="Evaluating…"
                          variant="primary"
                          size="xs"
                          icon={<Scale size={10} />}
                        />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-px border-b border-slate-200 bg-slate-200 sm:grid-cols-4">
                    <div className="bg-white px-3 py-2.5">
                      <div className="label">Live score</div>
                      <div className="mt-0.5 font-serif text-xl font-semibold text-navy-950">{liveSummary.score}%</div>
                    </div>
                    <div className="bg-white px-3 py-2.5">
                      <div className="label">Rules passed</div>
                      <div className="mt-0.5 font-serif text-xl font-semibold text-emerald-700">{liveSummary.passed}</div>
                    </div>
                    <div className="bg-white px-3 py-2.5">
                      <div className="label">Deficiencies</div>
                      <div className={`mt-0.5 font-serif text-xl font-semibold ${liveSummary.flagged > 0 ? "text-red-700" : "text-slate-400"}`}>
                        {liveSummary.flagged}
                      </div>
                    </div>
                    <div className="bg-white px-3 py-2.5">
                      <div className="label">Persisted checks</div>
                      <div className="mt-0.5 font-serif text-xl font-semibold text-navy-950">{app.ruleChecks.length}</div>
                    </div>
                  </div>

                  {liveSummary.flagged > 0 ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-[10px] text-red-900">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle size={11} />
                        {liveSummary.flagged} rule{liveSummary.flagged === 1 ? "" : "s"} fail the current APH threshold:{" "}
                        {flaggedRules.map((rule) => rule.ruleCode).join(", ")}.
                      </span>
                      {canRaise && (
                        <Link href={tabHref("deficiency")} className="font-semibold uppercase tracking-label underline underline-offset-2">
                          Issue notice
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-[10px] text-emerald-900">
                      <CheckCircle2 size={11} /> All live APH checks pass against the current statutory profile and documents.
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="data-table min-w-[780px]">
                      <thead>
                        <tr>
                          <th className="w-[64px]">Rule</th>
                          <th className="w-[155px]">Requirement</th>
                          <th className="w-[112px]">Threshold</th>
                          <th>Submitted finding</th>
                          <th className="w-[118px]">Status</th>
                          <th className="w-[186px]">Officer guidance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {liveRules.map((rule) => (
                          <tr key={rule.ruleCode} className={rule.status !== "PASSED" ? "rule-flag" : undefined}>
                            <td>
                              <div className="font-mono text-[10px] font-semibold text-navy-900">{rule.ruleCode}</div>
                              <div className="mt-0.5 text-[8px] uppercase tracking-label text-slate-400">{rule.source}</div>
                            </td>
                            <td>
                              <div className="text-[10px] font-medium text-navy-950">{rule.ruleName}</div>
                              <p className="mt-0.5 line-clamp-2 text-[9px] leading-snug text-slate-500">{rule.requirement}</p>
                            </td>
                            <td className="font-mono text-[10px] text-slate-700">{rule.requiredValue}</td>
                            <td className="text-[10px] leading-snug text-slate-700">{rule.submittedValue}</td>
                            <td>
                              <RuleStatusBadge status={rule.status} />
                            </td>
                            <td className="text-[9px] leading-relaxed text-slate-600">{rule.remarks}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-2 text-[9px] text-slate-500">
                    <span className="font-mono">
                      {app.ruleChecks[0]?.evaluatedAt
                        ? `LAST PERSISTED ${fmtDateTime(app.ruleChecks[0].evaluatedAt)}`
                        : "NOT YET PERSISTED"}
                    </span>
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <div className="eyebrow">Persisted evidence</div>
                      <h2 className="panel-title mt-0.5">Last recorded rule matrix</h2>
                    </div>
                    <span className="text-[9px] text-slate-500">{persistedFlagged.length} flagged</span>
                  </div>
                  {app.ruleChecks.length === 0 ? (
                    <div className="p-4">
                      <EmptyState
                        title="No persisted APH evaluation"
                        description="Run the evaluation to persist a rule matrix against this case."
                        icon={<Scale size={16} />}
                      />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="data-table min-w-[760px]">
                        <thead>
                          <tr>
                            <th>Rule</th>
                            <th>Required</th>
                            <th>Submitted at evaluation</th>
                            <th>Status</th>
                            <th>Evaluated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {app.ruleChecks.map((rule) => (
                            <tr key={rule.id}>
                              <td>
                                <div className="font-mono text-[10px] font-semibold text-navy-900">{rule.ruleCode}</div>
                                <div className="text-[9px] text-slate-500">{rule.ruleName}</div>
                              </td>
                              <td className="font-mono text-[9px] text-slate-600">{rule.requiredValue}</td>
                              <td className="text-[9px] text-slate-600">{rule.submittedValue}</td>
                              <td>
                                <RuleStatusBadge status={rule.status} />
                              </td>
                              <td className="font-mono text-[9px] text-slate-500">{fmtDateTime(rule.evaluatedAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            )}

            {activeTab === "deficiency" && (
              <>
                {canRaise && (
                  <section className="panel">
                    <div className="panel-header">
                      <div>
                        <div className="eyebrow">Regional authority · two-way loop</div>
                        <h2 className="panel-title mt-0.5">Issue formal deficiency notice</h2>
                      </div>
                      <span className="badge border-red-300 bg-red-50 text-red-900">
                        {flaggedRules.length} rule{flaggedRules.length === 1 ? "" : "s"} flagged
                      </span>
                    </div>
                    <div className="p-4">
                      <CaseActionForm
                        action={raiseDeficiencyAction}
                        hidden={{ applicationId: app.id }}
                        fields={[
                          {
                            name: "details",
                            label: "Deficiency statement",
                            type: "textarea",
                            required: true,
                            placeholder:
                              "State each failed rule, the observed shortfall and the evidence required (minimum 30 characters).",
                            hint: flaggedRules.length > 0
                              ? `Currently flagged: ${flaggedRules.map((rule) => `${rule.ruleCode} ${rule.ruleName}`).join("; ")}.`
                              : undefined,
                            span: 2,
                          },
                          {
                            name: "deadline",
                            label: "Compliance deadline",
                            type: "date",
                            required: true,
                            defaultValue: isoDay(new Date(Date.now() + SLA_POLICY.deficiencyWindowDays * 86_400_000)),
                            hint: `Standard APH evidence window is ${SLA_POLICY.deficiencyWindowDays} days.`,
                            min: isoDay(new Date()),
                          },
                        ]}
                        submitLabel="Issue notice"
                        pendingLabel="Issuing…"
                        variant="danger"
                        description="Issuing a notice routes the case to DEFICIENCY_REVERTED, opens the evidence window and appends a formal event to the ledger."
                        confirm="Issue this formal deficiency notice? The case will return to the institution and the statutory evidence clock will start."
                      />
                    </div>
                  </section>
                )}

                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <div className="eyebrow">Notice and evidence history</div>
                      <h2 className="panel-title mt-0.5">Deficiency register</h2>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-slate-500">
                      <span>{openTicket ? "1 open" : "0 open"}</span>
                      <span>·</span>
                      <span>{app.deficiencies.filter((ticket) => ticket.status === "RESOLVED").length} resolved</span>
                    </div>
                  </div>

                  {app.deficiencies.length === 0 ? (
                    <div className="p-4">
                      <EmptyState
                        title="No deficiency notices"
                        description="No formal notice has been issued against this filing."
                        icon={<FileCheck2 size={16} />}
                      />
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200">
                      {app.deficiencies.map((ticket) => {
                        const late =
                          ticket.status === "OPEN" && ticket.complianceDeadline.getTime() < Date.now();
                        return (
                          <article key={ticket.id} className="p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="font-mono text-[11px] font-semibold text-navy-950">
                                    {ticket.noticeNo ?? "Notice (unnumbered)"}
                                  </h3>
                                  <DeficiencyStatusBadge status={ticket.status} />
                                  {late && (
                                    <span className="badge border-red-300 bg-red-50 text-red-900">
                                      <AlertTriangle size={9} /> Deadline exceeded
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 text-[9px] text-slate-500">
                                  Raised {fmtDate(ticket.createdAt)} by {ticket.raisedBy}
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Link
                                  href={`/applications/${app.id}/notice?ticket=${ticket.id}`}
                                  className="btn btn-outline btn-xs"
                                >
                                  <Printer size={9} /> Printable
                                </Link>
                                <a href={`/api/notice/${ticket.id}`} className="btn btn-ghost btn-xs">
                                  <Download size={9} /> HTML
                                </a>
                              </div>
                            </div>

                            <p className="mt-2 border-l-2 border-red-300 bg-red-50/40 px-3 py-2 text-[10px] leading-relaxed text-slate-700">
                              {ticket.deficiencyDetails}
                            </p>

                            <dl className="mt-2 grid grid-cols-2 gap-2 text-[9px] sm:grid-cols-3">
                              <div>
                                <dt className="text-[8px] uppercase tracking-label text-slate-400">Compliance deadline</dt>
                                <dd className="mt-0.5 font-mono font-semibold text-slate-700">
                                  {fmtDate(ticket.complianceDeadline)}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-[8px] uppercase tracking-label text-slate-400">Evidence reference</dt>
                                <dd className="mt-0.5 truncate font-mono text-slate-600" title={ticket.resubmittedDocUrl ?? undefined}>
                                  {ticket.resubmittedDocUrl ?? "Not filed"}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-[8px] uppercase tracking-label text-slate-400">Resolution</dt>
                                <dd className="mt-0.5 text-slate-600">
                                  {ticket.resolvedAt
                                    ? fmtDate(ticket.resolvedAt)
                                    : ticket.resubmittedAt
                                      ? `Resubmitted ${fmtDate(ticket.resubmittedAt)}`
                                      : "Awaiting institution"}
                                </dd>
                              </div>
                            </dl>

                            {ticket.status === "OPEN" && canResubmit && (
                              <div className="mt-3 border border-slate-200 bg-slate-50/70 p-3">
                                <div className="mb-2 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-label text-navy-800">
                                  <FileCheck2 size={10} /> File corrected evidence
                                </div>
                                <CaseActionForm
                                  action={resubmitDeficiencyAction}
                                  hidden={{ ticketId: ticket.id }}
                                  fields={[
                                    {
                                      name: "evidenceUrl",
                                      label: "Evidence reference / URL",
                                      required: true,
                                      placeholder: "https://evidence.aicte.gov.in/…",
                                    },
                                    {
                                      name: "revisedBuiltUpAreaSqM",
                                      label: "Revised built-up area (sqm)",
                                      type: "number",
                                      min: 1000,
                                      max: 2_000_000,
                                      step: 1,
                                      placeholder: String(app.institution.builtUpAreaSqM),
                                      hint: `APH-102 needs at least ${fmtNumber(admissions * 10)} sqm for the current intake.`,
                                    },
                                    {
                                      name: "revisedFacultyCount",
                                      label: "Revised full-time faculty",
                                      type: "number",
                                      min: 1,
                                      max: 20_000,
                                      step: 1,
                                      placeholder: String(app.institution.facultyCount),
                                      hint: "Only supply a value if the faculty register was revised.",
                                    },
                                    {
                                      name: "note",
                                      label: "Covering note",
                                      type: "textarea",
                                      placeholder: "Optional note to the regional scrutiny desk.",
                                      span: 2,
                                    },
                                  ]}
                                  submitLabel="Submit evidence"
                                  pendingLabel="Submitting…"
                                  variant="primary"
                                  description="The application returns to RE_SCRUTINY. Revised statutory metrics, if supplied, update the institution profile before re-evaluation."
                                  confirm="Submit evidence and return this case to re-scrutiny?"
                                />
                              </div>
                            )}

                            {ticket.status === "OPEN" && !canResubmit && (
                              <div className="mt-2 flex items-center gap-1.5 text-[9px] text-amber-800">
                                <Timer size={10} /> Institution evidence is outstanding
                                {late ? " and past the compliance deadline." : "."}
                              </div>
                            )}

                            {ticket.status === "RESUBMITTED" && canAccept && (
                              <div className="mt-3 flex flex-wrap items-center gap-2 border border-amber-200 bg-amber-50 p-3">
                                <div className="min-w-0 flex-1">
                                  <div className="text-[9px] font-semibold uppercase tracking-label text-amber-900">
                                    Evidence awaiting re-scrutiny
                                  </div>
                                  <p className="mt-0.5 text-[10px] text-amber-900/80">
                                    Accepting re-evaluates every APH rule against the corrected profile and documents. Acceptance only
                                    succeeds if all rules now pass.
                                  </p>
                                </div>
                                <ActionButton
                                  action={acceptResubmissionAction}
                                  fields={{ ticketId: ticket.id }}
                                  label="Accept resubmission"
                                  pendingLabel="Re-evaluating…"
                                  variant="emerald"
                                  icon={<CheckCircle2 size={11} />}
                                  confirm="Re-evaluate APH rules and accept this resubmission if all checks pass?"
                                />
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              </>
            )}

            {activeTab === "evc" && (
              <>
                {canSchedule && (
                  <section className="panel">
                    <div className="panel-header">
                      <div>
                        <div className="eyebrow">Committee constitution · conflict control</div>
                        <h2 className="panel-title mt-0.5">Schedule Expert Visit Committee</h2>
                      </div>
                      <span className="badge border-indigo-300 bg-indigo-50 text-indigo-900">Geofence armed</span>
                    </div>
                    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                      <CaseActionForm
                        action={scheduleEvcAction}
                        hidden={{ applicationId: app.id }}
                        fields={[
                          {
                            name: "memberId",
                            label: "Committee lead",
                            type: "select",
                            required: true,
                            defaultValue: roster.find((member) => member.conflict.passed)?.id,
                            options: roster.map((member) => ({
                              value: member.id,
                              label: `${member.name} · ${member.region} · ${member.affiliation}`,
                            })),
                            span: 2,
                            hint: "Members from the applicant's region or affiliating university are rejected by the conflict engine.",
                          },
                          {
                            name: "scheduledDate",
                            label: "Scheduled visit date",
                            type: "date",
                            required: true,
                            defaultValue: isoDay(new Date(Date.now() + 3 * 86_400_000)),
                            min: isoDay(new Date()),
                            span: 2,
                          },
                        ]}
                        submitLabel="Constitute committee"
                        pendingLabel="Scheduling…"
                        variant="primary"
                        description="The conflict-of-interest check runs before constitution. A passing committee is recorded with its region and affiliation; the visit date arms the 750 m geofence."
                        confirm="Constitute this committee and schedule the campus visit?"
                      />
                      <div className="border border-slate-200 bg-slate-50/70 p-2.5">
                        <div className="mb-1.5 text-[8px] font-semibold uppercase tracking-label text-slate-500">
                          Conflict matrix · {app.institution.region} / {app.institution.affiliatingUniversity.split(" ").slice(0, 2).join(" ")}
                        </div>
                        <ul className="space-y-1">
                          {roster.map((member) => (
                            <li key={member.id} className="flex items-start justify-between gap-1.5 border-b border-slate-200 pb-1 last:border-b-0">
                              <div className="min-w-0">
                                <div className="truncate text-[9px] font-medium text-navy-900">{member.name}</div>
                                <div className="truncate text-[8px] text-slate-500">
                                  {member.region} · {member.specialisation}
                                </div>
                              </div>
                              <ConflictBadge passed={member.conflict.passed} className="shrink-0" />
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </section>
                )}

                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <div className="eyebrow">Field verification</div>
                      <h2 className="panel-title mt-0.5">Inspection files</h2>
                    </div>
                    <span className="text-[9px] text-slate-500">{app.inspections.length} record(s)</span>
                  </div>

                  {app.inspections.length === 0 ? (
                    <div className="p-4">
                      <EmptyState
                        title="No Expert Visit Committee constituted"
                        description={
                          app.status === "SCRUTINY_CLEARED"
                            ? "The case has cleared scrutiny and is ready for an EVC visit."
                            : "A committee can be constituted once scrutiny clears."
                        }
                        icon={<ClipboardCheck size={16} />}
                      />
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200">
                      {app.inspections.map((inspection) => (
                        <article key={inspection.id} className="p-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <h3 className="text-[12px] font-semibold text-navy-950">{inspection.committeeLead}</h3>
                              <div className="mt-0.5 text-[9px] text-slate-500">
                                {inspection.committeeRegion} · {inspection.committeeAffiliation}
                              </div>
                            </div>
                            <EvcReportBadge status={inspection.siteReportStatus} />
                          </div>

                          <dl className="mt-2.5 grid grid-cols-2 gap-2 text-[9px] sm:grid-cols-4">
                            <div>
                              <dt className="text-[8px] uppercase tracking-label text-slate-400">Scheduled visit</dt>
                              <dd className="mt-0.5 font-mono font-semibold text-slate-700">{fmtDate(inspection.scheduledDate)}</dd>
                            </div>
                            <div>
                              <dt className="text-[8px] uppercase tracking-label text-slate-400">Conflict check</dt>
                              <dd className="mt-0.5">
                                <ConflictBadge passed={inspection.conflictCheckPassed} />
                              </dd>
                            </div>
                            <div>
                              <dt className="text-[8px] uppercase tracking-label text-slate-400">Geofence</dt>
                              <dd className="mt-0.5 text-slate-700">
                                {inspection.geofenceVerified ? (
                                  <span className="flex items-center gap-1 text-emerald-800">
                                    <MapPin size={9} />
                                    {inspection.geofenceDistanceM !== null
                                      ? `${Math.round(inspection.geofenceDistanceM)} m`
                                      : "Verified"}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">Not yet verified</span>
                                )}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-[8px] uppercase tracking-label text-slate-400">Report filed</dt>
                              <dd className="mt-0.5 text-slate-700">
                                {inspection.reportSubmittedAt ? fmtDate(inspection.reportSubmittedAt) : "Pending"}
                              </dd>
                            </div>
                          </dl>

                          {inspection.conflictNotes && (
                            <p className="mt-2 border-l-2 border-emerald-300 bg-emerald-50/40 px-2.5 py-1.5 text-[9px] leading-relaxed text-emerald-900">
                              {inspection.conflictNotes}
                            </p>
                          )}

                          {inspection.reportSummary && (
                            <div className="mt-2 border border-slate-200 bg-slate-50 p-2.5">
                              <div className="text-[8px] font-semibold uppercase tracking-label text-slate-500">
                                Site report · recommendation {inspection.recommendation?.replaceAll("_", " ")}
                              </div>
                              <p className="mt-1 text-[10px] leading-relaxed text-slate-700">{inspection.reportSummary}</p>
                              {inspection.geofenceCoordinates && (
                                <div className="mt-1 font-mono text-[8px] text-slate-400">
                                  FIELD FIX {inspection.geofenceCoordinates} · {inspection.geofenceDistanceM ?? 0} m from campus
                                </div>
                              )}
                            </div>
                          )}

                          {inspection.id === latestInspection?.id && canFileReport && (
                            <div className="mt-3 border border-navy-200 bg-navy-50/50 p-3">
                              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-label text-navy-800">
                                  <MapPin size={10} /> File geofenced site report
                                </span>
                                <span className="font-mono text-[8px] text-slate-500">
                                  CAMPUS {app.institution.latitude.toFixed(4)}, {app.institution.longitude.toFixed(4)} · 750 M LIMIT
                                </span>
                              </div>
                              <CaseActionForm
                                action={submitSiteReportAction}
                                hidden={{ inspectionId: inspection.id }}
                                fields={[
                                  {
                                    name: "reportSummary",
                                    label: "Site verification summary",
                                    type: "textarea",
                                    required: true,
                                    placeholder:
                                      "Record campus, laboratory, faculty register and infrastructure verification findings (minimum 20 characters).",
                                    span: 2,
                                  },
                                  {
                                    name: "recommendation",
                                    label: "Committee recommendation",
                                    type: "select",
                                    required: true,
                                    defaultValue: "RECOMMENDED",
                                    options: [
                                      { value: "RECOMMENDED", label: "Recommended" },
                                      { value: "CONDITIONAL", label: "Recommended with conditions" },
                                      { value: "NOT_RECOMMENDED", label: "Not recommended" },
                                    ],
                                  },
                                  {
                                    name: "deviceLatitude",
                                    label: "Device latitude",
                                    type: "number",
                                    required: true,
                                    step: "0.0001",
                                    defaultValue: app.institution.latitude,
                                  },
                                  {
                                    name: "deviceLongitude",
                                    label: "Device longitude",
                                    type: "number",
                                    required: true,
                                    step: "0.0001",
                                    defaultValue: app.institution.longitude,
                                  },
                                ]}
                                submitLabel="File report"
                                pendingLabel="Verifying…"
                                variant="primary"
                                description="The observed field coordinates are compared to the campus with the haversine formula. Reports outside 750 m are rejected."
                                confirm="File this site report and advance the case?"
                              />
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}

            {activeTab === "evidence" && consistency && (
              <EvidenceIntake
                applicationId={app.id}
                referenceNo={app.referenceNo}
                rows={evidenceRows}
                report={consistency}
                canUpload={can(role, "UPLOAD_EVIDENCE")}
                canVerify={can(role, "VERIFY_EVIDENCE")}
                canApply={can(role, "APPLY_EXTRACTION")}
              />
            )}

            {activeTab === "ledger" && (
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">Cryptographic audit trail</div>
                    <h2 className="panel-title mt-0.5">Case ledger events</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-slate-500">{app.auditLogs.length} most recent events</span>
                    {can(role, "ATTEST_LEDGER") && (
                      <ActionButton
                        action={attestLedgerAction}
                        fields={{}}
                        label="Attest ledger"
                        pendingLabel="Hashing…"
                        variant="outline"
                        size="xs"
                        icon={<ShieldCheck size={10} />}
                      />
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="data-table min-w-[760px]">
                    <thead>
                      <tr>
                        <th className="w-[86px]">Seq / time</th>
                        <th className="w-[168px]">Event</th>
                        <th className="w-[132px]">Actor</th>
                        <th className="w-[108px]">Transition</th>
                        <th>Detail</th>
                        <th className="w-[128px]">Checksum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {app.auditLogs.map((log) => (
                        <tr key={log.id}>
                          <td>
                            <div className="font-mono text-[9px] text-slate-500">
                              #{String(log.sequence).padStart(4, "0")}
                            </div>
                            <div className="mt-0.5 font-mono text-[8px] leading-tight text-slate-400">
                              {fmtDateTime(log.timestamp)}
                            </div>
                          </td>
                          <td>
                            <div className="text-[10px] font-semibold text-navy-950">{auditActionLabel(log.action)}</div>
                            <div className="mt-0.5 font-mono text-[8px] uppercase tracking-label text-slate-400">
                              {log.action}
                            </div>
                          </td>
                          <td>
                            <div className="text-[10px] text-slate-700">{log.performedBy}</div>
                            <div className="mt-0.5 text-[8px] uppercase tracking-label text-slate-400">
                              {log.role === "SYSTEM" ? "System" : log.role.replaceAll("_", " ")}
                            </div>
                          </td>
                          <td className="font-mono text-[8px] text-slate-600">
                            {log.previousState ?? "—"} → {log.newState ?? "—"}
                          </td>
                          <td className="text-[9px] leading-relaxed text-slate-600">{log.detail ?? "—"}</td>
                          <td>
                            <div className="flex items-center gap-1">
                              <span className="hash" title={log.hashChecksum}>
                                {truncateHash(log.hashChecksum, 10, 6)}
                              </span>
                              <CopyButton value={log.hashChecksum} label="" />
                            </div>
                            {log.previousHash && (
                              <div className="mt-0.5 text-[7px] font-mono text-slate-400">
                                prev {truncateHash(log.previousHash, 6, 4)}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-2 text-[9px] text-slate-500">
                  <Link href="/audit" className="inline-flex items-center gap-1 font-semibold uppercase tracking-label text-navy-700 hover:text-navy-900">
                    National ledger <ArrowUpRight size={9} />
                  </Link>
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-4">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <div className="eyebrow">Statutory clock</div>
                  <h2 className="panel-title mt-0.5">Stage SLA</h2>
                </div>
                <SlaBadge status={slaStatus} days={days} />
              </div>
              <div className="p-4">
                <div className="flex items-end gap-2">
                  <span className="font-serif text-[34px] font-semibold leading-none text-navy-950">{days}</span>
                  <span className="pb-1 text-[10px] uppercase tracking-label text-slate-500">days in stage</span>
                </div>
                <div className="mt-3">
                  <SlaMeter days={days} />
                </div>
                <dl className="mt-3 space-y-1.5 text-[10px]">
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">Stage entered</dt>
                    <dd className="font-mono text-slate-700">{fmtDate(app.stageEnteredAt)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">10-day deadline</dt>
                    <dd className="font-mono text-slate-700">{fmtDate(deadline)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">Elapsed</dt>
                    <dd className="font-mono text-slate-700">{stageElapsedPercent(days)}%</dd>
                  </div>
                  {overdue > 0 && (
                    <div className="flex items-center justify-between border-t border-red-100 pt-1.5 text-red-800">
                      <dt className="flex items-center gap-1 font-semibold uppercase tracking-label">
                        <AlertTriangle size={9} /> Overdue
                      </dt>
                      <dd className="font-mono font-semibold">{overdue}d</dd>
                    </div>
                  )}
                </dl>
                {activeEscalations.length > 0 && (
                  <div className="mt-3 border border-red-200 bg-red-50 p-2.5">
                    <div className="flex items-center gap-1 text-[8px] font-semibold uppercase tracking-label text-red-800">
                      <AlertTriangle size={9} /> Escalation active
                    </div>
                    {activeEscalations.map((ticket) => (
                      <div key={ticket.id} className="mt-1 flex items-center justify-between gap-2 text-[9px]">
                        <span className="font-mono text-red-900">{ticket.escalationNo}</span>
                        <EscalationStatusBadge status={ticket.status} />
                      </div>
                    ))}
                    <Link href="/escalations" className="mt-1 inline-flex items-center gap-1 text-[8px] font-semibold uppercase tracking-label text-red-800 underline underline-offset-2">
                      Bureau register <ArrowUpRight size={8} />
                    </Link>
                  </div>
                )}
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <div className="eyebrow">Evidence tracker</div>
                <span className="text-[9px] text-slate-500">{app.deficiencies.length} notice(s)</span>
              </div>
              <div className="p-3">
                {app.deficiencies.length === 0 ? (
                  <p className="text-[10px] text-slate-500">No deficiency notices issued.</p>
                ) : (
                  <ul className="space-y-2">
                    {app.deficiencies.slice(0, 3).map((ticket) => (
                      <li key={ticket.id} className="border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-mono text-[9px] font-semibold text-navy-900">
                            {ticket.noticeNo ?? "Notice"}
                          </span>
                          <DeficiencyStatusBadge status={ticket.status} />
                        </div>
                        <div className="mt-0.5 text-[9px] text-slate-500">
                          Due {fmtDate(ticket.complianceDeadline)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href={tabHref("deficiency")} className="mt-2 inline-flex items-center gap-1 text-[8px] font-semibold uppercase tracking-label text-navy-700 hover:text-navy-900">
                  Deficiency ledger <ArrowUpRight size={8} />
                </Link>
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <div className="eyebrow">Statutory documents</div>
                <span className="text-[9px] text-slate-500">{app.institution.documents.length}</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {app.institution.documents.map((document) => (
                  <li key={document.id} className="px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[9px] font-medium text-navy-900">
                        {DOC_TYPE_LABELS[document.docType as DocType] ?? document.docType}
                      </span>
                      <DocStatusBadge status={document.status} />
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 font-mono text-[8px] text-slate-500">
                      <span className="truncate">{document.documentRef}</span>
                      <span className="shrink-0">{fmtDate(document.expiryDate)}</span>
                    </div>
                  </li>
                ))}
              </ul>
              {role === "INSTITUTION_ADMIN" && (
                <Link href="/compliance" className="block border-t border-slate-200 px-3 py-2 text-[8px] font-semibold uppercase tracking-label text-navy-700 hover:bg-slate-50">
                  Renew documents <ArrowUpRight size={8} className="inline" />
                </Link>
              )}
            </section>

            <section className="panel">
              <div className="panel-header">
                <div className="eyebrow">Authority</div>
                <span className="text-[9px] text-slate-500">{ROLE_META[role].label}</span>
              </div>
              <div className="p-3">
                <p className="text-[10px] leading-relaxed text-slate-600">{ROLE_META[role].summary}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(["RUN_APH", "RAISE_DEFICIENCY", "RESUBMIT_DEFICIENCY", "ACCEPT_RESUBMISSION", "SCHEDULE_EVC", "SUBMIT_SITE_REPORT", "DECIDE_APPLICATION"] as const).map((capability) =>
                    can(role, capability) ? (
                      <span key={capability} className="border border-emerald-200 bg-emerald-50 px-1 py-0.5 text-[7px] font-semibold uppercase tracking-label text-emerald-800">
                        {capability.replaceAll("_", " ")}
                      </span>
                    ) : null,
                  )}
                </div>
                <div className="mt-2 border-t border-slate-100 pt-2 text-[8px] uppercase tracking-label text-slate-400">
                  Tenant · {app.institution.code} · {app.institution.state}
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
