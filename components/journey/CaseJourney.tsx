import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Crosshair,
  FileText,
  GitCommitHorizontal,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Stamp,
  Timer,
  Upload,
  Users,
} from "lucide-react";
import { GEOFENCE_RADIUS_M } from "@/lib/evc";
import { fmtDate, fmtDateTime, fmtNumber, truncateHash } from "@/lib/format";
import { JOURNEY_ROLE_TONE, journeyTabFor } from "@/lib/journey";
import type { CaseApp } from "@/lib/queries";
import {
  APPLICATION_TYPE_LABELS,
  PROCESSING_PATH_META,
  REGION_META,
  ROLE_META,
  auditActionLabel,
  type ApplicationType,
  type ProcessingPath,
  type Region,
  type Role,
} from "@/lib/types";
import { ConflictBadge, DeficiencyStatusBadge, EvcReportBadge, RuleStatusBadge, StatusBadge } from "@/components/ui/Badges";
import { MetricCard, MetricGrid } from "@/components/ui/MetricCard";
import { GeofenceRadar } from "@/components/evc/GeofenceRadar";

const DAY = 86_400_000;

function beatIcon(action: string): LucideIcon {
  switch (action) {
    case "APPLICATION_SUBMITTED":
      return FileText;
    case "APH_EVALUATION_RUN":
      return Scale;
    case "DEFICIENCY_ISSUED":
      return AlertTriangle;
    case "DEFICIENCY_RESUBMITTED":
      return Upload;
    case "DEFICIENCY_RESOLVED":
      return CheckCircle2;
    case "EVC_SCHEDULED":
      return Users;
    case "SITE_REPORT_SUBMITTED":
      return Crosshair;
    case "APPLICATION_APPROVED":
      return Stamp;
    case "APPLICATION_REJECTED":
      return ShieldAlert;
    case "SLA_ESCALATION_RAISED":
      return Timer;
    default:
      return GitCommitHorizontal;
  }
}

export function CaseJourney({
  app,
  ledger,
}: {
  app: CaseApp;
  ledger: { valid: boolean; entries: number; headHash: string | null };
}) {
  const beats = [...app.auditLogs].sort((a, b) => a.sequence - b.sequence);
  const rules = app.ruleChecks;
  const deficiency = app.deficiencies[0] ?? null;
  const inspection = app.inspections[0] ?? null;

  const passedRules = rules.filter((rule) => rule.status === "PASSED").length;
  const reRaised = deficiency
    ? rules.filter((rule) => deficiency.deficiencyDetails.includes(rule.ruleCode))
    : [];
  const actors = Array.from(new Set(beats.map((beat) => beat.performedBy)));
  const elapsedDays = app.decisionAt
    ? Math.max(0, Math.round((app.decisionAt.getTime() - app.submittedAt.getTime()) / DAY))
    : null;
  const remedyDays =
    deficiency?.resubmittedAt && deficiency?.createdAt
      ? Math.max(
          0,
          Math.round(
            (deficiency.resubmittedAt.getTime() - deficiency.createdAt.getTime()) / DAY,
          ),
        )
      : null;

  const regionMeta = REGION_META[app.institution.region as Region];
  const pathMeta = PROCESSING_PATH_META[app.processingPath as ProcessingPath];

  return (
    <>
      <div className="mb-4">
        <MetricGrid>
          <MetricCard
            label="Final outcome"
            value={app.status === "APPROVED" ? "Approved" : app.status.replaceAll("_", " ")}
            tone={app.status === "APPROVED" ? "emerald" : "navy"}
            icon={<Stamp size={12} />}
            detail={app.approvalOrderNo ? `Order ${app.approvalOrderNo}` : "Order not yet issued"}
            foot={app.decisionAt ? `Decided ${fmtDate(app.decisionAt)}` : "Decision pending"}
          />
          <MetricCard
            label="Clock consumed"
            value={elapsedDays ?? "—"}
            unit="days"
            icon={<Timer size={12} />}
            detail="Filing to council order"
            foot={`Filed ${fmtDate(app.submittedAt)}`}
          />
          <MetricCard
            label="Roles involved"
            value={actors.length}
            unit="actors"
            icon={<Users size={12} />}
            detail="No single desk can clear a file"
            foot={`${beats.length} recorded transitions`}
          />
          <MetricCard
            label="Machined checks"
            value={`${passedRules}/${rules.length}`}
            tone={reRaised.length > 0 ? "amber" : "emerald"}
            icon={<Scale size={12} />}
            detail={
              reRaised.length > 0
                ? `${reRaised.length} re-opened by an officer finding`
                : "All controls clear"
            }
            foot="APH 2026–27 norm set"
          />
          <MetricCard
            label="Field evidence"
            value={inspection?.geofenceDistanceM != null ? Math.round(inspection.geofenceDistanceM) : "—"}
            unit="metres"
            tone={inspection?.geofenceVerified ? "emerald" : "slate"}
            icon={<Crosshair size={12} />}
            detail={
              inspection?.geofenceVerified
                ? `Inside the ${GEOFENCE_RADIUS_M} m campus geofence`
                : "No verified device fix"
            }
            foot={inspection?.geofenceCoordinates ?? "No coordinates on record"}
          />
          <MetricCard
            label="Ledger chain"
            value={ledger.valid ? "Verified" : "Fault"}
            tone={ledger.valid ? "emerald" : "red"}
            icon={ledger.valid ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
            detail={`${ledger.entries} entries in the national chain`}
            foot={ledger.headHash ? `Head ${truncateHash(ledger.headHash, 8, 6)}` : "Genesis"}
          />
        </MetricGrid>
      </div>

      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <div className="eyebrow">Evidence chain · {beats.length} recorded transitions</div>
            <h2 className="panel-title mt-0.5">The file, event by event</h2>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link href={`/applications/${app.id}`} className="btn btn-outline btn-xs">
              Open the live case file <ArrowUpRight size={10} />
            </Link>
            <Link href={`/audit?q=${app.referenceNo}`} className="btn btn-ghost btn-xs">
              Verify in the ledger
            </Link>
          </div>
        </div>

        <ol className="divide-y divide-slate-100">
          {beats.map((beat, index) => {
            const Icon = beatIcon(beat.action);
            const roleTone =
              JOURNEY_ROLE_TONE[beat.role] ?? "border-slate-300 bg-slate-100 text-slate-700";
            const roleLabel = ROLE_META[beat.role as Role]?.label ?? beat.role;
            const tab = journeyTabFor(beat.action);
            const deepHref =
              tab && tab !== "case"
                ? `/applications/${app.id}?tab=${tab}`
                : `/applications/${app.id}`;
            const stateHeld = beat.previousState === beat.newState;

            return (
              <li key={beat.id} className="relative bg-white">
                <div className="flex gap-3.5 px-4 py-4">
                  <div className="flex w-16 shrink-0 flex-col items-center">
                    <span className="flex h-8 w-8 items-center justify-center border border-navy-200 bg-navy-50 text-navy-800">
                      <Icon size={14} strokeWidth={1.8} />
                    </span>
                    <span className="mt-1.5 font-mono text-[8px] font-semibold text-slate-400">
                      STEP {String(index + 1).padStart(2, "0")}
                    </span>
                    {index < beats.length - 1 && (
                      <span className="mt-1.5 w-px flex-1 bg-slate-200" aria-hidden="true" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`badge ${roleTone}`}>{roleLabel}</span>
                      <span className="text-[11px] font-semibold text-navy-950">
                        {beat.performedBy}
                      </span>
                      <span className="ml-auto flex items-center gap-1 font-mono text-[9px] text-slate-400">
                        <CalendarClock size={9} />
                        {fmtDateTime(beat.timestamp)}
                      </span>
                    </div>

                    <div className="mt-2 text-[12px] font-semibold text-navy-900">
                      {auditActionLabel(beat.action)}
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {beat.previousState ? (
                        <StatusBadge status={beat.previousState} />
                      ) : (
                        <span className="badge border-slate-300 bg-white text-slate-600">
                          No prior state
                        </span>
                      )}
                      {stateHeld ? (
                        <span className="text-[9px] italic text-slate-500">
                          state held during evaluation
                        </span>
                      ) : (
                        <>
                          <ArrowRight size={10} className="text-slate-400" />
                          <StatusBadge status={beat.newState ?? ""} />
                        </>
                      )}
                    </div>

                    {beat.detail && (
                      <p className="mt-2 text-[11px] leading-relaxed text-slate-700">
                        {beat.detail}
                      </p>
                    )}

                    {beat.action === "APH_EVALUATION_RUN" && rules.length > 0 && (
                      <div className="mt-2.5 border border-slate-200">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-2.5 py-1.5">
                          <span className="text-[8px] font-semibold uppercase tracking-label text-slate-500">
                            APH 2026–27 rule matrix · {rules.length} controls
                          </span>
                          <span className="font-mono text-[9px] font-semibold text-slate-600">
                            {passedRules}/{rules.length} machine-checked
                          </span>
                        </div>
                        <ul className="divide-y divide-slate-100">
                          {rules.map((rule) => {
                            const flag = reRaised.some((item) => item.id === rule.id);
                            return (
                              <li key={rule.id} className="px-2.5 py-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[9px] font-semibold text-navy-800">
                                    {rule.ruleCode}
                                  </span>
                                  <span className="truncate text-[10px] font-medium text-navy-950">
                                    {rule.ruleName}
                                  </span>
                                  <span className="ml-auto shrink-0">
                                    <RuleStatusBadge status={rule.status} />
                                  </span>
                                </div>
                                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[8px] text-slate-500">
                                  <span>
                                    required{" "}
                                    <span className="text-slate-700">{rule.requiredValue}</span>
                                  </span>
                                  <span>
                                    declared{" "}
                                    <span className="text-slate-700">{rule.submittedValue}</span>
                                  </span>
                                </div>
                                {flag && deficiency && (
                                  <div className="mt-1 flex items-start gap-1.5 border-l-2 border-amber-400 bg-amber-50/70 px-2 py-1">
                                    <AlertTriangle
                                      size={9}
                                      className="mt-0.5 shrink-0 text-amber-600"
                                    />
                                    <span className="text-[9px] leading-snug text-amber-900">
                                      The machine-checkable layer passed on the declared record. The
                                      officer re-opened this control by documentary inspection —
                                      see notice {deficiency.noticeNo}.
                                    </span>
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {beat.action === "DEFICIENCY_ISSUED" && deficiency && (
                      <div className="mt-2.5 border border-red-200 bg-red-50/40">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-200 px-2.5 py-1.5">
                          <span className="text-[8px] font-semibold uppercase tracking-label text-red-700">
                            Formal notice {deficiency.noticeNo}
                          </span>
                          <span className="flex items-center gap-1 font-mono text-[9px] text-red-800">
                            <CalendarClock size={9} />
                            evidence due {fmtDate(deficiency.complianceDeadline)}
                          </span>
                        </div>
                        <p className="px-2.5 py-2 text-[10px] leading-relaxed text-slate-700">
                          {deficiency.deficiencyDetails}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 border-t border-red-200 px-2.5 py-1.5">
                          <DeficiencyStatusBadge status={deficiency.status} />
                          <span className="font-mono text-[8px] text-slate-500">
                            raised by {deficiency.raisedBy}
                          </span>
                          <Link
                            href={`/applications/${app.id}/notice?ticket=${deficiency.id}`}
                            className="btn btn-outline btn-xs ml-auto"
                          >
                            Print the notice <ArrowUpRight size={10} />
                          </Link>
                        </div>
                      </div>
                    )}

                    {beat.action === "DEFICIENCY_RESUBMITTED" && deficiency?.resubmittedAt && (
                      <div className="mt-2.5 border border-amber-200 bg-amber-50/40 px-2.5 py-2">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="flex items-center gap-1 text-[9px] font-semibold text-amber-900">
                            <Upload size={10} />
                            Evidence filed {fmtDateTime(deficiency.resubmittedAt)}
                          </span>
                          {remedyDays !== null && (
                            <span className="font-mono text-[9px] text-amber-800">
                              {remedyDays} day{remedyDays === 1 ? "" : "s"} into the evidence window
                            </span>
                          )}
                        </div>
                        {deficiency.resubmittedDocUrl && (
                          <p className="mt-1 break-all font-mono text-[8px] text-slate-500">
                            {deficiency.resubmittedDocUrl}
                          </p>
                        )}
                      </div>
                    )}

                    {beat.action === "DEFICIENCY_RESOLVED" && deficiency?.resolvedAt && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-2 border border-emerald-200 bg-emerald-50/40 px-2.5 py-2">
                        <span className="flex items-center gap-1 text-[9px] font-semibold text-emerald-900">
                          <CheckCircle2 size={10} />
                          Deficiency closed {fmtDateTime(deficiency.resolvedAt)}
                        </span>
                      </div>
                    )}

                    {beat.action === "EVC_SCHEDULED" && inspection && (
                      <div className="mt-2.5 grid grid-cols-1 gap-px border border-slate-200 bg-slate-200 sm:grid-cols-3">
                        <div className="bg-white px-2.5 py-2">
                          <div className="label">Committee lead</div>
                          <div className="mt-0.5 text-[11px] font-semibold text-navy-950">
                            {inspection.committeeLead}
                          </div>
                          <div className="text-[9px] leading-snug text-slate-500">
                            {inspection.committeeAffiliation}
                          </div>
                        </div>
                        <div className="bg-white px-2.5 py-2">
                          <div className="label">Visit date</div>
                          <div className="mt-0.5 font-mono text-[11px] font-semibold text-navy-950">
                            {fmtDate(inspection.scheduledDate)}
                          </div>
                          <div className="text-[9px] text-slate-500">
                            {inspection.committeeRegion} region roster
                          </div>
                        </div>
                        <div className="bg-white px-2.5 py-2">
                          <div className="label">Conflict screen</div>
                          <div className="mt-0.5">
                            <ConflictBadge passed={inspection.conflictCheckPassed} />
                          </div>
                          <div className="mt-0.5 text-[9px] leading-snug text-slate-500">
                            {inspection.conflictNotes ?? "Region and affiliation checked."}
                          </div>
                        </div>
                      </div>
                    )}

                    {beat.action === "SITE_REPORT_SUBMITTED" && inspection && (
                      <div className="mt-2.5 border border-slate-200">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-2.5 py-1.5">
                          <span className="flex items-center gap-1 text-[8px] font-semibold uppercase tracking-label text-slate-500">
                            <Crosshair size={10} /> Geofenced field evidence
                          </span>
                          <span className="font-mono text-[9px] font-semibold text-emerald-700">
                            {fmtNumber(Math.round(inspection.geofenceDistanceM ?? 0))} m from campus ·
                            limit {GEOFENCE_RADIUS_M} m
                          </span>
                        </div>
                        <div className="grid gap-3 p-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                          <GeofenceRadar
                            compact
                            campus={{
                              latitude: app.institution.latitude,
                              longitude: app.institution.longitude,
                            }}
                            fix={{
                              coordinates: inspection.geofenceCoordinates,
                              distanceM: inspection.geofenceDistanceM,
                              verified: inspection.geofenceVerified,
                            }}
                            campusLabel={`${app.institution.city} campus`}
                          />
                          <div className="min-w-0 space-y-2">
                            <p className="text-[10px] leading-relaxed text-slate-700">
                              {inspection.reportSummary}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <EvcReportBadge status={inspection.siteReportStatus} />
                              {inspection.recommendation && (
                                <span className="badge border-emerald-300 bg-emerald-50 text-emerald-900">
                                  {inspection.recommendation.replaceAll("_", " ")}
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[8px] text-slate-400">
                              device fix {inspection.geofenceCoordinates} · filed{" "}
                              {fmtDateTime(inspection.reportSubmittedAt)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {(beat.action === "APPLICATION_APPROVED" ||
                      beat.action === "APPLICATION_REJECTED") && (
                      <div
                        className={`mt-2.5 border ${
                          beat.action === "APPLICATION_APPROVED"
                            ? "border-emerald-300 bg-emerald-50/50"
                            : "border-slate-300 bg-slate-50"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 px-2.5 py-1.5">
                          <span className="flex items-center gap-1 text-[8px] font-semibold uppercase tracking-label text-slate-600">
                            <Stamp size={10} />
                            {beat.action === "APPLICATION_APPROVED"
                              ? "Council order"
                              : "Rejection order"}{" "}
                            {app.approvalOrderNo ?? "—"}
                          </span>
                          <span className="font-mono text-[9px] text-slate-600">
                            effective {fmtDate(app.decisionAt)}
                          </span>
                        </div>
                        <p className="px-2.5 py-2 text-[10px] leading-relaxed text-slate-700">
                          {app.remarks ?? "No remarks recorded against the order."}
                        </p>
                      </div>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[8px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <GitCommitHorizontal size={9} /> ledger #{beat.sequence}
                      </span>
                      <span>hash {truncateHash(beat.hashChecksum)}</span>
                      <span>
                        prev{" "}
                        {beat.previousHash ? truncateHash(beat.previousHash) : "GENESIS"}
                      </span>
                      <Link
                        href={deepHref}
                        className="ml-auto font-sans text-[9px] font-semibold text-navy-700 hover:text-navy-900"
                      >
                        Inspect in the case workspace →
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border border-slate-300 bg-white px-4 py-2.5 text-[9px] text-slate-500">
        <span>
          {app.institution.name} · {app.institution.code} · {regionMeta?.label ?? app.institution.region}
        </span>
        <span className="flex items-center gap-2 font-mono">
          <span>
            {APPLICATION_TYPE_LABELS[app.applicationType as ApplicationType] ?? app.applicationType}
          </span>
          <span className="text-slate-300">|</span>
          <span>{pathMeta?.route ?? app.processingPath}</span>
          <span className="text-slate-300">|</span>
          <span>SLA · {app.slaStatus.replaceAll("_", " ")}</span>
        </span>
      </div>
    </>
  );
}