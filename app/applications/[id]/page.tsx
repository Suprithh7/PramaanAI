import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  Gavel,
  MapPin,
  RefreshCw,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  acceptResubmissionAction,
  clearScrutinyAction,
  commenceScrutinyAction,
  decideApplicationAction,
  raiseDeficiencyAction,
  resubmitDeficiencyAction,
  runAphAction,
  scheduleEvcAction,
} from "@/app/actions";
import { CaseActionForm } from "@/components/case/CaseActionForm";
import { EvidenceIntake } from "@/components/case/EvidenceIntake";
import { FilingBriefPanel } from "@/components/case/FilingBriefPanel";
import { WorkflowRail } from "@/components/case/WorkflowRail";
import { ActionButton } from "@/components/ui/ActionFeedback";
import { DeficiencyStatusBadge, EvcReportBadge, SlaBadge, StatusBadge } from "@/components/ui/Badges";
import { PageHeader } from "@/components/ui/PageHeader";
import { aphInputFor, aphSummary, evaluateAphRules } from "@/lib/aph";
import { auditActionLabel } from "@/lib/types";
import { getConsistencyReport } from "@/lib/consistency";
import { toEvidenceRow } from "@/lib/evidence";
import { EVIDENCE_TYPE_LABELS } from "@/lib/evidence-types";
import { checkConflict, EVC_ROSTER } from "@/lib/evc";
import { canAcceptResubmission, canDecide, canRaiseDeficiency } from "@/lib/fsm";
import { fmtDate, fmtDateTime, fmtNumber, isoDay, shortRef, truncateHash } from "@/lib/format";
import { parseFilingBrief } from "@/lib/ai";
import { getCase } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { liveDaysInStage, slaForDays } from "@/lib/sla";
import {
  APPLICATION_TYPE_LABELS,
  DOC_STATUS_META,
  PROCESSING_PATH_META,
  REGION_META,
  can,
  type ApplicationType,
  type DocStatus,
  type ProcessingPath,
  type Region,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "rules", label: "Rule check" },
  { key: "documents", label: "Documents" },
  { key: "history", label: "History" },
];

const NEXT_STEP: Record<string, string> = {
  SUBMITTED: "An officer needs to open the file and start the review.",
  UNDER_SCRUTINY: "The officer is checking the declared figures against the AICTE rules.",
  DEFICIENCY_REVERTED: "The college must fix the listed items and submit evidence.",
  RE_SCRUTINY: "The college has responded. An officer must accept or reject the response.",
  SCRUTINY_CLEARED: "All rules pass. Schedule an inspection of the campus.",
  EVC_SCHEDULED: "An inspector must visit the campus and file a location-stamped report.",
  EVC_COMPLETED: "The inspection report is in. The Bureau can record the final decision.",
  SAC_REVIEW: "The file is with the standing review committee.",
  SHC_REVIEW: "The file is with the higher review committee.",
  APPROVED: "Approved. The order number is recorded below.",
  REJECTED: "Rejected. The reasoned order is recorded below.",
};

export default async function CasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const tab = tabParam === "aph" ? "rules" : TABS.some((item) => item.key === tabParam) ? tabParam! : "overview";

  const app = await getCase(id);
  if (!app) notFound();
  if (session.role === "INSTITUTION_ADMIN" && session.tenant?.id !== app.institutionId) notFound();

  const days = liveDaysInStage(app.stageEnteredAt);
  const sla = slaForDays(days);
  const liveRules = evaluateAphRules(aphInputFor(app));
  const summary = aphSummary(liveRules);
  const flagged = liveRules.filter((rule) => rule.status !== "PASSED");
  const brief = app.filingBrief ? parseFilingBrief(app.filingBrief.payload) : null;
  const openNotice = app.deficiencies.find((ticket) => ticket.status === "OPEN");
  const pendingNotice = app.deficiencies.find((ticket) => ticket.status === "RESUBMITTED");
  const inspection = app.inspections[0];
  const regionMeta = REGION_META[app.institution.region as Region];
  const declaration = app.filingDeclaration;
  const certificateExpiry = (type: string) =>
    app.institution.documents.find((doc) => doc.docType === type)?.expiryDate ?? null;
  const evidenceRows = app.evidenceFiles.map(toEvidenceRow);
  const consistency = tab === "documents" ? await getConsistencyReport(app.institutionId) : null;

  const canRun = can(session.role, "RUN_APH");
  const canRaise = can(session.role, "RAISE_DEFICIENCY");
  const canResubmit = can(session.role, "RESUBMIT_DEFICIENCY");
  const canAccept = can(session.role, "ACCEPT_RESUBMISSION");
  const canSchedule = can(session.role, "SCHEDULE_EVC");
  const canFileDecision = can(session.role, "DECIDE_APPLICATION");
  const canUpload = can(session.role, "UPLOAD_EVIDENCE");
  const canVerify = can(session.role, "VERIFY_EVIDENCE");
  const canApply = can(session.role, "APPLY_EXTRACTION");

  const eligibleInspectors = EVC_ROSTER.filter(
    (member) => checkConflict(member, app.institution).passed,
  );
  const canRegenerateBrief = canRun || can(session.role, "FILE_APPLICATION");
  const deadline = isoDay(new Date(Date.now() + 30 * 86_400_000));

  const primaryAction = (() => {
    if (app.status === "SUBMITTED" && canRun)
      return (
        <CaseActionForm
          action={commenceScrutinyAction}
          hidden={{ applicationId: app.id }}
          fields={[]}
          submitLabel="Start review"
          pendingLabel="Starting…"
          submitIcon={<Send size={13} />}
          description="This starts the statutory review clock and assigns the case to you."
        />
      );
    if (app.status === "SUBMITTED")
      return (
        <p className="text-sm text-slate-600">
          Waiting for an AICTE officer to start the review. Switch the demo role to{" "}
          <strong>AICTE Officer</strong> to act.
        </p>
      );
    if (app.status === "UNDER_SCRUTINY" && canRun)
      return (
        <div className="flex flex-wrap items-start gap-3">
          <ActionButton
            action={runAphAction}
            fields={{ applicationId: app.id }}
            label="Run rule check"
            pendingLabel="Checking…"
            variant="outline"
            icon={<RefreshCw size={13} />}
          />
          <ActionButton
            action={clearScrutinyAction}
            fields={{ applicationId: app.id }}
            label="Clear review"
            pendingLabel="Clearing…"
            variant="emerald"
            icon={<CheckCircle2 size={13} />}
            confirm="Clear this case for the next stage? This is only possible when every rule passes."
          />
        </div>
      );
    if (app.status === "RE_SCRUTINY" && pendingNotice && canAccept)
      return (
        <CaseActionForm
          action={acceptResubmissionAction}
          hidden={{ ticketId: pendingNotice.id }}
          fields={[]}
          submitLabel="Accept response and clear"
          pendingLabel="Re-checking rules…"
          variant="emerald"
          submitIcon={<CheckCircle2 size={13} />}
          description="The rules are re-checked against the corrected declaration. The response is accepted only if every rule now passes."
        />
      );
    if (app.status === "SCRUTINY_CLEARED" && canSchedule)
      return (
        <CaseActionForm
          action={scheduleEvcAction}
          hidden={{ applicationId: app.id }}
          fields={[
            {
              name: "memberId",
              label: "Inspector",
              type: "select",
              required: true,
              span: 1,
              options: eligibleInspectors.length
                ? eligibleInspectors.map((member) => ({
                    value: member.id,
                    label: `${member.name} · ${member.region} region`,
                  }))
                : [{ value: "", label: "No conflict-free inspector available" }],
              hint: "Only inspectors from another region and another university are listed.",
            },
            {
              name: "scheduledDate",
              label: "Visit date",
              type: "date",
              required: true,
              span: 1,
              defaultValue: isoDay(new Date(Date.now() + 7 * 86_400_000)),
            },
          ]}
          submitLabel="Schedule inspection"
          pendingLabel="Scheduling…"
          submitIcon={<CalendarClock size={13} />}
          description="The system checks for a conflict of interest before the visit is created."
        />
      );
    if (app.status === "EVC_SCHEDULED")
      return (
        <div className="text-sm text-slate-600">
          <p>
            Inspector <strong>{inspection?.committeeLead}</strong> must file the site report from
            inside the campus.
          </p>
          <Link href="/inspections" className="btn btn-primary mt-2">
            <MapPin size={13} /> Open inspection desk
          </Link>
        </div>
      );
    if (canDecide(app.status) && canFileDecision)
      return (
        <CaseActionForm
          action={decideApplicationAction}
          hidden={{ applicationId: app.id }}
          fields={[
            {
              name: "decision",
              label: "Decision",
              type: "select",
              required: true,
              options: [
                { value: "APPROVED", label: "Approve" },
                { value: "REJECTED", label: "Reject" },
              ],
            },
            {
              name: "orderNo",
              label: "Order number (optional)",
              type: "text",
              placeholder: "Leave blank to generate automatically",
            },
            {
              name: "note",
              label: "Reasoning",
              type: "textarea",
              required: false,
              placeholder: "Required for a rejection (at least 20 characters).",
            },
          ]}
          submitLabel="Record final decision"
          pendingLabel="Recording…"
          variant="primary"
          submitIcon={<Gavel size={13} />}
        />
      );
    if (canDecide(app.status))
      return (
        <p className="text-sm text-slate-600">
          The inspection is complete. Switch the demo role to <strong>Approvals Bureau</strong> to
          record the final decision.
        </p>
      );
    return <p className="text-sm text-slate-600">{NEXT_STEP[app.status]}</p>;
  })();

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Link href="/applications" className="btn btn-ghost btn-xs">
          <ArrowLeft size={12} /> All applications
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {app.deficiencies.length > 0 && (
            <Link href={`/applications/${app.id}/notice`} className="btn btn-outline btn-xs">
              <FileText size={12} /> View deficiency notice
            </Link>
          )}
          {app.status === "APPROVED" && (
            <Link href={`/applications/${app.id}/notice`} className="btn btn-outline btn-xs">
              <Download size={12} /> Printable record
            </Link>
          )}
        </div>
      </div>

      <PageHeader
        eyebrow={`${shortRef(app.referenceNo)} · ${APPLICATION_TYPE_LABELS[app.applicationType as ApplicationType] ?? app.applicationType}`}
        title={app.institution.name}
        description={`${app.programName} · ${regionMeta?.label ?? app.institution.region} · ${app.institution.city}`}
        meta={
          <>
            <StatusBadge status={app.status} />
            <SlaBadge status={sla} days={days} />
            <span className="badge border-slate-300 bg-white text-slate-700">
              {summary.passed}/{summary.total} rules pass
            </span>
            <span className="badge border-slate-300 bg-white text-slate-700">
              {PROCESSING_PATH_META[app.processingPath as ProcessingPath]?.route ?? app.processingPath}
            </span>
          </>
        }
        actions={
          <div className="text-right text-xs text-slate-500">
            <div className="font-semibold text-navy-900">
              Filed {fmtDate(app.submittedAt)}
            </div>
            <div>Last update {fmtDate(app.updatedAt)}</div>
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap gap-1.5 border-b border-slate-300">
        {TABS.map((item) => (
          <Link
            key={item.key}
            href={`/applications/${app.id}?tab=${item.key}`}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold transition ${
              tab === item.key
                ? "border-brass-500 text-navy-950"
                : "border-transparent text-slate-500 hover:text-navy-900"
            }`}
          >
            {item.label}
            {item.key === "rules" && flagged.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center bg-red-600 px-1 font-mono text-[10px] font-bold text-white">
                {flagged.length}
              </span>
            )}
            {item.key === "documents" && app.evidenceFiles.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center bg-slate-200 px-1 font-mono text-[10px] font-bold text-slate-700">
                {app.evidenceFiles.length}
              </span>
            )}
          </Link>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
          <section className="panel overflow-hidden">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Where this stands</div>
                <h2 className="panel-title mt-0.5">Approval journey</h2>
              </div>
              <span className="text-xs text-slate-500">
                {PROCESSING_PATH_META[app.processingPath as ProcessingPath]?.description}
              </span>
            </div>
            <WorkflowRail status={app.status} path={app.processingPath} />
          </section>

          <section className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="panel border-t-4 border-t-brass-500">
                <div className="panel-header">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center bg-brass-500 text-navy-950">
                      {app.status === "APPROVED" ? (
                        <CheckCircle2 size={15} />
                      ) : app.status === "REJECTED" ? (
                        <XCircle size={15} />
                      ) : (
                        <ArrowRight size={15} />
                      )}
                    </span>
                    <div>
                      <div className="eyebrow">What happens next</div>
                      <h2 className="panel-title mt-0.5">{NEXT_STEP[app.status]}</h2>
                    </div>
                  </div>
                </div>
                <div className="p-4">{primaryAction}</div>
              </div>

              {brief && (
                <FilingBriefPanel
                  applicationId={app.id}
                  payload={brief}
                  engine="GROUNDED"
                  model={null}
                  generatedAt={app.filingBrief?.generatedAt ?? app.updatedAt}
                  canRegenerate={canRegenerateBrief}
                />
              )}

              {app.deficiencies.length > 0 && (
                <section className="panel overflow-hidden">
                  <div className="panel-header">
                    <div>
                      <div className="eyebrow">Deficiency notices</div>
                      <h2 className="panel-title mt-0.5">
                        {openNotice ? "A notice is open" : pendingNotice ? "Response under review" : "Notices resolved"}
                      </h2>
                    </div>
                    {openNotice && <DeficiencyStatusBadge status="OPEN" />}
                    {pendingNotice && <DeficiencyStatusBadge status="RESUBMITTED" />}
                  </div>
                  <ul className="divide-y divide-slate-200">
                    {app.deficiencies.map((ticket) => (
                      <li key={ticket.id} className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-navy-900">
                              {ticket.noticeNo ?? "Notice"}
                            </span>
                            <DeficiencyStatusBadge status={ticket.status} />
                          </div>
                          <span className="text-xs text-slate-500">
                            Due {fmtDate(ticket.complianceDeadline)}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                          {ticket.deficiencyDetails}
                        </p>
                        <div className="mt-1 text-xs text-slate-500">
                          Raised by {ticket.raisedBy} on {fmtDate(ticket.createdAt)}
                          {ticket.resubmittedDocUrl ? ` · Response: ${ticket.resubmittedDocUrl}` : ""}
                        </div>
                        {ticket.status === "OPEN" && ticket.id === openNotice?.id && (
                          <div className="mt-3 border-t border-slate-200 pt-3">
                            {canResubmit ? (
                              <CaseActionForm
                                action={resubmitDeficiencyAction}
                                hidden={{ ticketId: ticket.id }}
                                fields={[
                                  {
                                    name: "evidenceUrl",
                                    label: "Evidence reference",
                                    type: "text",
                                    required: true,
                                    span: 2,
                                    placeholder: "e.g. Registered lease extension dated 12 Oct 2026",
                                  },
                                  {
                                    name: "revisedFacultyCount",
                                    label: "Corrected faculty count",
                                    type: "number",
                                    defaultValue: declaration?.facultyCount ?? app.institution.facultyCount,
                                    hint: "Leave a value here to update the declaration with the response.",
                                  },
                                  {
                                    name: "revisedBuiltUpAreaSqM",
                                    label: "Corrected built-up area (sqm)",
                                    type: "number",
                                    defaultValue: declaration?.builtUpAreaSqM ?? app.institution.builtUpAreaSqM,
                                  },
                                  {
                                    name: "note",
                                    label: "Note to the officer",
                                    type: "textarea",
                                    placeholder: "Explain what changed and where the evidence is.",
                                  },
                                ]}
                                submitLabel="Submit response"
                                pendingLabel="Submitting…"
                                submitIcon={<Send size={13} />}
                                description="Correcting a declared number updates the filing declaration and sends the case back for re-check."
                              />
                            ) : (
                              <p className="text-sm text-slate-600">
                                The college must respond. Switch the demo role to <strong>College</strong>.
                              </p>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            <div className="space-y-4">
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">Declared at filing</div>
                    <h2 className="panel-title mt-0.5">The numbers</h2>
                  </div>
                </div>
                <dl className="divide-y divide-slate-100">
                  {[
                    { label: "Students declared", value: fmtNumber(declaration?.studentIntake ?? app.institution.studentIntake) },
                    { label: "Full-time faculty", value: fmtNumber(declaration?.facultyCount ?? app.institution.facultyCount) },
                    { label: "Built-up area", value: `${fmtNumber(declaration?.builtUpAreaSqM ?? app.institution.builtUpAreaSqM)} sqm` },
                    { label: "Campus land", value: `${(declaration?.totalLandAcres ?? app.institution.totalLandAcres).toFixed(2)} acres` },
                    { label: "Lease valid to", value: fmtDate(declaration?.leaseExpiry ?? certificateExpiry("LEASE_DEED")) },
                    { label: "Fire certificate to", value: fmtDate(declaration?.fireExpiry ?? certificateExpiry("FIRE_SAFETY")) },
                    { label: "Building plan to", value: fmtDate(declaration?.buildingExpiry ?? certificateExpiry("BUILDING_PLAN")) },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <dt className="text-sm text-slate-600">{row.label}</dt>
                      <dd className="text-sm font-semibold text-navy-950">{row.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-navy-900">Rules passing</span>
                    <span className={`font-mono font-bold ${summary.flagged ? "text-red-700" : "text-emerald-700"}`}>
                      {summary.passed} / {summary.total}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full bg-slate-200">
                    <div
                      className={`h-2 ${summary.flagged ? "bg-red-600" : "bg-emerald-600"}`}
                      style={{ width: `${summary.score}%` }}
                    />
                  </div>
                  <Link href={`/applications/${app.id}?tab=rules`} className="mt-2 inline-flex text-xs font-semibold text-navy-800 underline">
                    See every rule and the exact shortfall
                  </Link>
                </div>
              </section>

              <section className="panel">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">Campus inspection</div>
                    <h2 className="panel-title mt-0.5">
                      {inspection ? inspection.committeeLead.split(",")[0] : "Not scheduled"}
                    </h2>
                  </div>
                  {inspection && <EvcReportBadge status={inspection.siteReportStatus} />}
                </div>
                {inspection ? (
                  <div className="space-y-2 px-4 py-3 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <CalendarClock size={14} className="text-slate-400" />
                      Visit on {fmtDate(inspection.scheduledDate)} · {inspection.committeeRegion} region
                    </div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={14} className="text-emerald-600" />
                      Conflict check passed
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin
                        size={14}
                        className={
                          inspection.siteReportStatus === "COMPLETED" && inspection.geofenceVerified
                            ? "text-emerald-600"
                            : "text-slate-400"
                        }
                      />
                      {inspection.siteReportStatus === "COMPLETED" && inspection.geofenceVerified
                        ? `Location verified at ${inspection.geofenceDistanceM ?? 0} m from campus`
                        : "No site report filed yet"}
                    </div>
                    {inspection.reportSummary && (
                      <p className="border-t border-slate-200 pt-2 leading-relaxed">
                        {inspection.reportSummary}
                      </p>
                    )}
                    <Link href="/inspections" className="btn btn-outline btn-xs mt-1">
                      <ClipboardCheck size={12} /> Open inspection desk
                    </Link>
                  </div>
                ) : (
                  <p className="px-4 py-4 text-sm text-slate-600">
                    {app.status === "SCRUTINY_CLEARED"
                      ? "The case is ready for an inspection. Schedule it above."
                      : "An inspection is scheduled only after every rule passes."}
                  </p>
                )}
              </section>

              {app.decisionAt && (
                <section className="panel border-t-4 border-t-emerald-600">
                  <div className="panel-header">
                    <div>
                      <div className="eyebrow">Final decision</div>
                      <h2 className="panel-title mt-0.5">{NEXT_STEP[app.status]}</h2>
                    </div>
                  </div>
                  <div className="px-4 py-3 text-sm text-slate-600">
                    <div>Recorded {fmtDateTime(app.decisionAt)}</div>
                    {app.approvalOrderNo && (
                      <div className="mt-1 font-mono text-xs text-navy-900">
                        Order {app.approvalOrderNo}
                      </div>
                    )}
                    {app.remarks && <p className="mt-2 leading-relaxed">{app.remarks}</p>}
                  </div>
                </section>
              )}
            </div>
          </section>
        </div>
      )}

      {tab === "rules" && (
        <div className="space-y-4">
          <section className="panel overflow-hidden">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Automatic check of the AICTE rulebook</div>
                <h2 className="panel-title mt-0.5">
                  {flagged.length === 0
                    ? `All ${summary.total} rules pass on the declared figures`
                    : `${flagged.length} of ${summary.total} rules are failing`}
                </h2>
              </div>
              {canRun && (
                <ActionButton
                  action={runAphAction}
                  fields={{ applicationId: app.id }}
                  label="Re-run checks"
                  pendingLabel="Checking…"
                  variant="outline"
                  size="xs"
                  icon={<RefreshCw size={12} />}
                />
              )}
            </div>
            <div className="divide-y divide-slate-200">
              {liveRules.map((rule) => {
                const passed = rule.status === "PASSED";
                return (
                  <div
                    key={rule.ruleCode}
                    className={`grid gap-3 px-4 py-4 sm:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_110px] sm:items-start ${
                      passed ? "" : "bg-red-50/40"
                    }`}
                  >
                    <div>
                      <div className="font-mono text-xs font-bold text-navy-900">{rule.ruleCode}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500">{rule.source}</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-navy-950">{rule.ruleName}</div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">{rule.requirement}</p>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div>
                        <span className="text-slate-500">Declared: </span>
                        <span className="font-mono font-semibold text-navy-900">{rule.submittedValue}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Required: </span>
                        <span className="font-mono font-semibold text-navy-900">{rule.requiredValue}</span>
                      </div>
                      <p className={`leading-relaxed ${passed ? "text-slate-600" : "font-medium text-red-800"}`}>
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
            <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-3 text-xs leading-relaxed text-slate-600">
              These results are computed from the filed declaration every time the page loads. There
              is no external model: the same numbers always produce the same result, which is why the
              output can be used in a formal notice.
            </div>
          </section>

          {canRaise && canRaiseDeficiency(app.status) && !openNotice && (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <div className="eyebrow">Officer action</div>
                  <h2 className="panel-title mt-0.5">Issue a formal deficiency notice</h2>
                </div>
              </div>
              <div className="p-4">
                <CaseActionForm
                  action={raiseDeficiencyAction}
                  hidden={{ applicationId: app.id }}
                  fields={[
                    {
                      name: "details",
                      label: "What must the college fix?",
                      type: "textarea",
                      required: true,
                      span: 2,
                      placeholder:
                        "State each failing rule, the figure declared and what is required.",
                      defaultValue:
                        flagged.length > 0
                          ? flagged
                              .map(
                                (rule) =>
                                  `${rule.ruleCode} ${rule.ruleName}: declared ${rule.submittedValue}; required ${rule.requiredValue}.`,
                              )
                              .join("\n")
                          : "",
                    },
                    {
                      name: "deadline",
                      label: "Response due by",
                      type: "date",
                      required: true,
                      defaultValue: deadline,
                    },
                  ]}
                  submitLabel="Issue notice"
                  pendingLabel="Issuing…"
                  variant="danger"
                  submitIcon={<AlertTriangle size={13} />}
                  description="The case returns to the college and a printable notice is generated."
                />
              </div>
            </section>
          )}
        </div>
      )}

      {tab === "documents" && (
        <div className="space-y-4">
          <EvidenceIntake
            applicationId={app.id}
            referenceNo={app.referenceNo}
            rows={evidenceRows}
            report={
              consistency ?? {
                annexures: 0,
                checksRun: 0,
                findings: [],
                high: 0,
                medium: 0,
                info: 0,
                generatedAt: new Date().toISOString(),
              }
            }
            canUpload={canUpload}
            canVerify={canVerify}
            canApply={canApply}
          />

          <section className="panel overflow-hidden">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Held by the college</div>
                <h2 className="panel-title mt-0.5">Statutory documents on record</h2>
              </div>
              <Link href="/documents" className="btn btn-outline btn-xs">
                All documents
              </Link>
            </div>
            <div className="table-wrap">
              <table className="data-table min-w-[560px]">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Reference</th>
                    <th>Valid to</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {app.institution.documents.map((document) => (
                    <tr key={document.id}>
                      <td className="font-semibold text-navy-950">
                        {EVIDENCE_TYPE_LABELS[document.docType as keyof typeof EVIDENCE_TYPE_LABELS] ??
                          document.docType.replaceAll("_", " ")}
                      </td>
                      <td className="font-mono text-xs text-slate-600">{document.documentRef}</td>
                      <td className="text-sm">{fmtDate(document.expiryDate)}</td>
                      <td>
                        <span className={`badge ${DOC_STATUS_META[document.status as DocStatus]?.tone ?? ""}`}>
                          {DOC_STATUS_META[document.status as DocStatus]?.label ?? document.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {tab === "history" && (
        <section className="panel overflow-hidden">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Nothing can be edited or deleted</div>
              <h2 className="panel-title mt-0.5">Case history</h2>
            </div>
            <Link href="/audit" className="btn btn-outline btn-xs">
              <ShieldCheck size={12} /> Verify full trail
            </Link>
          </div>
          <ul className="divide-y divide-slate-200">
            {app.auditLogs.map((log) => (
              <li key={log.id} className="grid gap-1.5 px-4 py-3 sm:grid-cols-[150px_minmax(0,1fr)_180px]">
                <div className="text-xs text-slate-500">{fmtDateTime(log.timestamp)}</div>
                <div>
                  <div className="text-sm font-semibold text-navy-950">
                    {auditActionLabel(log.action)}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{log.detail}</p>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    by {log.performedBy} · {log.role.replaceAll("_", " ").toLowerCase()}
                  </div>
                </div>
                <div className="sm:text-right">
                  <div className="font-mono text-[11px] text-slate-500" title={log.hashChecksum}>
                    {truncateHash(log.hashChecksum, 10, 6)}
                  </div>
                  <div className="text-[11px] text-slate-400">entry #{log.sequence}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
