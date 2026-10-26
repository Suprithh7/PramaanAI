import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Landmark,
  MapPin,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Timer,
  Users,
} from "lucide-react";
import { attestLedgerAction, runSlaSweepAction } from "./actions";
import {
  activeApps,
  deficiencyStats,
  documentStats,
  escalationStats,
  inspectionStats,
  regionStats,
  ruleStats,
  slaCounts,
  stageBuckets,
} from "@/lib/analytics";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { getLedgerIntegritySummary } from "@/lib/audit";
import { getDocuments, getPortfolio } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { can } from "@/lib/types";
import { REGION_META, ROLE_META, type Region } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { ShowcaseRail } from "@/components/showcase/ShowcaseRail";
import { MetricCard, MetricGrid } from "@/components/ui/MetricCard";
import { ActionButton } from "@/components/ui/ActionFeedback";
import { RoleBanner } from "@/components/command/RoleBanner";
import { SlaHeatmap } from "@/components/command/SlaHeatmap";
import { StatutoryClockBand } from "@/components/command/StatutoryClockBand";
import { PipelinePanel } from "@/components/command/PipelinePanel";
import { PriorityTable } from "@/components/command/PriorityTable";
import { DeficiencyInbox } from "@/components/command/DeficiencyInbox";
import { EscalationPanel } from "@/components/command/EscalationPanel";
import { DocumentExposure } from "@/components/command/DocumentExposure";
import { LedgerStream } from "@/components/command/LedgerStream";
import { InspectionBoard } from "@/components/command/InspectionBoard";

export const dynamic = "force-dynamic";

const TITLES: Record<string, { eyebrow: string; title: string; description: string }> = {
  INSTITUTION_ADMIN: {
    eyebrow: "Institutional tenant · applicant workspace",
    title: "Institution compliance workspace",
    description:
      "Track live filings, respond to formal deficiencies and keep every statutory annexure current. All actions are written to the national ledger.",
  },
  REGIONAL_OFFICER: {
    eyebrow: "Regional office · APH scrutiny",
    title: "Regional command centre",
    description:
      "Run automated APH rule evaluation, issue formal deficiency notices and constitute Expert Visit Committees within the statutory clock.",
  },
  EVC_MEMBER: {
    eyebrow: "Expert Visit Committee · field operations",
    title: "Expert visit command",
    description:
      "Conduct geofenced campus inspections, verify conflict-of-interest clearance and file the committee's site report.",
  },
  COMPLIANCE_HEAD: {
    eyebrow: "National compliance · command centre",
    title: "National compliance command centre",
    description:
      "Monitor statutory SLAs across five regions, APH compliance, document exposure and the cryptographic audit chain in one operating picture.",
  },
  BUREAU_OFFICER: {
    eyebrow: "AICTE Bureau · Member Secretary's office",
    title: "Bureau oversight command centre",
    description:
      "Resolve escalated cases, apply regional penalties and record final council decisions with a reasoned order.",
  },
};

export default async function CommandCentrePage() {
  const session = await getSession();
  const role = session.role;
  const copy = TITLES[role];

  const [portfolio, documents, integrity, recentAudit] = await Promise.all([
    getPortfolio(session),
    getDocuments(session),
    getLedgerIntegritySummary(),
    prisma.auditLog.findMany({
      where:
        role === "INSTITUTION_ADMIN" && session.tenant
          ? { institutionId: session.tenant.id }
          : {},
      orderBy: { sequence: "desc" },
      take: 10,
      include: { application: { select: { referenceNo: true } } },
    }),
  ]);

  const active = activeApps(portfolio);
  const sla = slaCounts(portfolio);
  const deficiencies = deficiencyStats(portfolio);
  const escalations = escalationStats(portfolio);
  const inspections = inspectionStats(portfolio);
  const docs = documentStats(documents);
  const rules = ruleStats(portfolio);
  const stages = stageBuckets(portfolio);

  const assignedVisits = portfolio
    .flatMap((app) => app.inspections)
    .filter((inspection) => inspection.committeeLead === session.user.name);
  const overdueAssigned = assignedVisits.filter(
    (inspection) => inspection.siteReportStatus === "OVERDUE",
  ).length;

  const regionMeta = session.user.region
    ? REGION_META[session.user.region as Region]
    : session.tenant
      ? REGION_META[session.tenant.region as Region]
      : null;

  const jurisdiction =
    role === "INSTITUTION_ADMIN"
      ? session.tenant?.name ?? "No tenant selected"
      : role === "COMPLIANCE_HEAD"
        ? "All five AICTE regions"
        : role === "BUREAU_OFFICER"
          ? "National escalation desk"
          : role === "EVC_MEMBER"
            ? "Committee pool · all regions"
            : regionMeta?.label ?? "Northern Region";

  const priorityTitle =
    role === "REGIONAL_OFFICER"
      ? "Scrutiny & EVC docket"
      : role === "BUREAU_OFFICER"
        ? "Bureau intervention docket"
        : "National priority docket";

  const priorityCaption =
    role === "REGIONAL_OFFICER"
      ? "Cases awaiting regional action, ranked by clock pressure"
      : role === "BUREAU_OFFICER"
        ? "Escalated and council-stage cases requiring a bureau decision"
        : "All active filings ranked by statutory clock pressure";

  return (
    <>
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        meta={
          <>
            <span className="badge border-navy-300 bg-navy-50 text-navy-900">
              <Shield size={9} /> {ROLE_META[role].label}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-slate-600">
              <MapPin size={10} className="text-slate-400" /> {jurisdiction}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-slate-600">
              <CalendarClock size={10} className="text-slate-400" /> {fmtDate(new Date())} · IST
            </span>
            <span
              className={`flex items-center gap-1 text-[10px] ${
                integrity.valid ? "text-emerald-800" : "text-red-800"
              }`}
            >
              {integrity.valid ? <ShieldCheck size={10} /> : <ShieldAlert size={10} />}
              Ledger {integrity.valid ? "verified" : "integrity fault"} · {integrity.entries} entries
            </span>
          </>
        }
        actions={
          <>
            {can(role, "RUN_SLA_SWEEP") && (
              <ActionButton
                action={runSlaSweepAction}
                fields={{}}
                label="Run SLA sweep"
                pendingLabel="Sweeping…"
                variant="primary"
                icon={<Timer size={11} />}
                confirm="Recompute every active statutory clock and auto-raise escalations for breached cases?"
              />
            )}
            {can(role, "ATTEST_LEDGER") && (
              <ActionButton
                action={attestLedgerAction}
                fields={{}}
                label="Attest ledger"
                pendingLabel="Hashing…"
                variant="outline"
                icon={<ShieldCheck size={11} />}
              />
            )}
            {role === "INSTITUTION_ADMIN" && (
              <Link href="/applications" className="btn btn-primary">
                Filing register <ArrowRight size={11} />
              </Link>
            )}
            {role === "EVC_MEMBER" && (
              <Link href="/evc" className="btn btn-primary">
                Visit console <ArrowRight size={11} />
              </Link>
            )}
          </>
        }
      />

      <ShowcaseRail
        activeCount={active.length}
        breachCount={sla.BREACHED}
        ruleRate={rules.rate}
      />

      <div className="space-y-4">
        {!integrity.valid && (
          <RoleBanner
            tone="red"
            eyebrow="Critical · ledger integrity"
            title={`Hash chain broken at entry #${integrity.brokenAtSequence ?? "unknown"}`}
            icon={<ShieldAlert size={16} />}
            actions={
              <Link href="/audit" className="btn btn-danger btn-xs">
                Open audit trail
              </Link>
            }
          />
        )}

        {role === "INSTITUTION_ADMIN" && deficiencies.open > 0 && (
          <RoleBanner
            tone={deficiencies.nearestDays !== null && deficiencies.nearestDays < 0 ? "red" : "amber"}
            eyebrow="Action required · formal deficiency"
            title={`${deficiencies.open} open notice${deficiencies.open === 1 ? "" : "s"} for ${session.tenant?.name ?? "this institution"}`}
            icon={<AlertTriangle size={16} />}
            actions={
              <Link href="/applications" className="btn btn-danger btn-xs">
                Respond now <ArrowRight size={10} />
              </Link>
            }
          />
        )}

        {role === "COMPLIANCE_HEAD" && (
          <RoleBanner
            tone={sla.BREACHED > 0 ? "red" : "emerald"}
            eyebrow="National statutory clock"
            title={
              sla.BREACHED > 0
                ? `${sla.BREACHED} of ${sla.total} active cases exceed the 10-day limit`
                : `All ${sla.total} active cases are within the 10-day statutory limit`
            }
            icon={sla.BREACHED > 0 ? <Activity size={16} /> : <CheckCircle2 size={16} />}
            actions={
              <Link href="/escalations" className="btn btn-outline btn-xs">
                SLA matrix <ArrowRight size={10} />
              </Link>
            }
          />
        )}

        {role === "BUREAU_OFFICER" && (
          <RoleBanner
            tone={escalations.open > 0 ? "red" : escalations.acknowledged > 0 ? "amber" : "emerald"}
            eyebrow="Bureau escalation desk"
            title={
              escalations.open > 0
                ? `${escalations.open} escalation${escalations.open === 1 ? "" : "s"} await acknowledgement`
                : escalations.acknowledged > 0
                  ? `${escalations.acknowledged} acknowledged escalation${escalations.acknowledged === 1 ? "" : "s"} under resolution`
                  : "No live escalations on the national register"
            }
            icon={<Landmark size={16} />}
            actions={
              <Link href="/escalations" className="btn btn-danger btn-xs">
                Escalation matrix <ArrowRight size={10} />
              </Link>
            }
          />
        )}

        {role === "REGIONAL_OFFICER" && (
          <RoleBanner
            tone={sla.BREACHED > 0 ? "red" : deficiencies.open > 0 ? "amber" : "emerald"}
            eyebrow={`${regionMeta?.label ?? "Regional"} jurisdiction`}
            title={
              sla.BREACHED > 0
                ? `${sla.BREACHED} case${sla.BREACHED === 1 ? "" : "s"} breach the scrutiny clock`
                : deficiencies.open > 0
                  ? `${deficiencies.open} formal notice${deficiencies.open === 1 ? "" : "s"} await institutional evidence`
                  : "Scrutiny queue is within the statutory clock"
            }
            icon={<Scale size={16} />}
            actions={
              <Link href="/scrutiny" className="btn btn-outline btn-xs">
                Scrutiny desk <ArrowRight size={10} />
              </Link>
            }
          />
        )}

        {role === "EVC_MEMBER" && (
          <RoleBanner
            tone={overdueAssigned > 0 ? "red" : assignedVisits.length > 0 ? "amber" : "emerald"}
            eyebrow="Field operations · assigned committees"
            title={
              overdueAssigned > 0
                ? `${overdueAssigned} assigned site report${overdueAssigned === 1 ? "" : "s"} overdue`
                : assignedVisits.length > 0
                  ? `${assignedVisits.length} visit${assignedVisits.length === 1 ? "" : "s"} assigned to ${session.user.name}`
                  : "No visits assigned to this committee identity"
            }
            icon={<ClipboardCheck size={16} />}
            actions={
              <Link href="/evc" className="btn btn-primary btn-xs">
                Open visit console <ArrowRight size={10} />
              </Link>
            }
          />
        )}

        {role === "INSTITUTION_ADMIN" ? (
          <>
            <MetricGrid>
              <MetricCard
                label="Active filings"
                value={active.length}
                icon={<FileText size={12} />}
                detail={`${stages.scrutiny} scrutiny · ${stages.evc} EVC · ${stages.council} council`}
                href="/applications"
                foot={`${session.tenant?.code ?? "Tenant"} portfolio`}
              />
              <MetricCard
                label="Open deficiencies"
                value={deficiencies.open}
                tone={deficiencies.open > 0 ? "red" : "emerald"}
                icon={<AlertTriangle size={12} />}
                detail={
                  deficiencies.nearestDays === null
                    ? "No open evidence window"
                    : deficiencies.nearestDays < 0
                      ? `${Math.abs(deficiencies.nearestDays)} days overdue`
                      : `${deficiencies.nearestDays} days to respond`
                }
                href="/applications"
                foot="Formal notices"
              />
              <MetricCard
                label="Under re-scrutiny"
                value={deficiencies.resubmitted}
                tone="amber"
                icon={<ClipboardCheck size={12} />}
                detail="Evidence filed, awaiting regional review"
                href="/applications?status=RE_SCRUTINY"
                foot={`${deficiencies.resolved} resolved notices`}
              />
              <MetricCard
                label="Documents at risk"
                value={docs.expiring + docs.expired}
                tone={docs.expired > 0 ? "red" : docs.expiring > 0 ? "amber" : "emerald"}
                icon={<FileText size={12} />}
                detail={`${docs.expiring} expiring · ${docs.expired} expired`}
                href="/compliance"
                foot={`${docs.valid} of ${docs.total} valid`}
              />
              <MetricCard
                label="SLA breaches"
                value={sla.BREACHED}
                tone={sla.BREACHED > 0 ? "red" : "emerald"}
                icon={<Timer size={12} />}
                detail={`${sla.WARNING} approaching the 10-day limit`}
                foot={`${sla.total} active filings`}
              />
              <MetricCard
                label="APH pass rate"
                value={`${rules.rate}%`}
                tone={rules.flagged > 0 ? "amber" : "emerald"}
                icon={<Scale size={12} />}
                detail={`${rules.passed} passed · ${rules.flagged} flagged`}
                foot={`${rules.total} persisted checks`}
              />
            </MetricGrid>

            <StatutoryClockBand apps={portfolio} />

            <PriorityTable
              apps={portfolio}
              title="Institutional filing docket"
              caption={`Every filing held by ${session.tenant?.name ?? "the selected tenant"}`}
            />

            <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
              <DeficiencyInbox apps={portfolio} role={role} />
              <DocumentExposure documents={documents} national={false} />
            </div>

            <LedgerStream
              entries={recentAudit}
              valid={integrity.valid}
              totalEntries={integrity.entries}
              headHash={integrity.headHash}
              title="Tenant audit trail"
              limit={6}
            />
          </>
        ) : role === "EVC_MEMBER" ? (
          <>
            <MetricGrid>
              <MetricCard
                label="Assigned visits"
                value={assignedVisits.length}
                tone="brass"
                icon={<ClipboardCheck size={12} />}
                detail={assignedVisits.length > 0 ? session.user.name : "No matching committee lead"}
                href="/evc"
                foot="Conflict-cleared committees"
              />
              <MetricCard
                label="Reports overdue"
                value={inspections.overdue}
                tone={inspections.overdue > 0 ? "red" : "emerald"}
                icon={<AlertTriangle size={12} />}
                detail="Field reports past the scheduled visit"
                href="/evc"
                foot={`${inspections.pending} pending in pool`}
              />
              <MetricCard
                label="Committee pool"
                value={inspections.total}
                icon={<Users size={12} />}
                detail={`${inspections.pending} pending · ${inspections.completed} filed`}
                href="/evc"
                foot="All constituted visits"
              />
              <MetricCard
                label="Geofence verified"
                value={inspections.geofenceVerified}
                tone="emerald"
                icon={<MapPin size={12} />}
                detail="Reports captured inside 750 m"
                foot="Haversine campus check"
              />
              <MetricCard
                label="Conflict clearances"
                value={inspections.total - inspections.conflicts}
                tone={inspections.conflicts > 0 ? "red" : "emerald"}
                icon={<Scale size={12} />}
                detail={`${inspections.conflicts} conflict${inspections.conflicts === 1 ? "" : "s"} detected`}
                foot="Region & affiliation checks"
              />
              <MetricCard
                label="Completed reports"
                value={inspections.completed}
                tone="navy"
                icon={<CheckCircle2 size={12} />}
                detail="Recommendations on file"
                foot="Accepted into the case file"
              />
            </MetricGrid>

            <InspectionBoard apps={portfolio} currentLead={session.user.name} limit={6} />

            <div className="grid gap-4 xl:grid-cols-3 [&>*]:min-w-0">
              <div className="min-w-0 xl:col-span-2">
                <PriorityTable
                  apps={portfolio.filter((app) => app.inspections.length > 0)}
                  title="Inspection-linked cases"
                  caption="Cases with a constituted Expert Visit Committee"
                  onlyActive={false}
                />
              </div>
              <PipelinePanel apps={portfolio} />
            </div>

            <LedgerStream
              entries={recentAudit}
              valid={integrity.valid}
              totalEntries={integrity.entries}
              headHash={integrity.headHash}
              title="Inspection audit trail"
              limit={6}
            />
          </>
        ) : (
          <>
            <MetricGrid>
              <MetricCard
                label="Active applications"
                value={active.length}
                icon={<FileText size={12} />}
                detail={`${stages.scrutiny} scrutiny · ${stages.evc} EVC · ${stages.council} council`}
                href="/applications"
                foot={`${stages.decided} decided`}
              />
              <MetricCard
                label="SLA breaches"
                value={sla.BREACHED}
                tone={sla.BREACHED > 0 ? "red" : "emerald"}
                icon={<Activity size={12} />}
                detail={`${sla.WARNING} approaching · ${sla.ON_TRACK} on track`}
                href="/escalations"
                foot="10-day statutory limit"
              />
              <MetricCard
                label="Open deficiencies"
                value={deficiencies.open}
                tone={deficiencies.open > 0 ? "red" : "emerald"}
                icon={<AlertTriangle size={12} />}
                detail={
                  deficiencies.nearestDays === null
                    ? "No open evidence window"
                    : `${deficiencies.nearestDays} days to nearest deadline`
                }
                href="/scrutiny"
                foot={`${deficiencies.resubmitted} under re-scrutiny`}
              />
              <MetricCard
                label="Escalation penalty"
                value={escalations.penalty}
                unit="pts"
                tone={escalations.penalty > 0 ? "red" : "emerald"}
                icon={<ShieldAlert size={12} />}
                detail={`${escalations.open} open · ${escalations.acknowledged} acknowledged`}
                href="/escalations"
                foot={`${escalations.total} tickets on register`}
              />
              <MetricCard
                label="EVC reports pending"
                value={inspections.pending}
                tone={inspections.overdue > 0 ? "amber" : "navy"}
                icon={<ClipboardCheck size={12} />}
                detail={`${inspections.overdue} overdue · ${inspections.completed} filed`}
                href="/evc"
                foot={`${inspections.geofenceVerified} geofence verified`}
              />
              <MetricCard
                label="APH pass rate"
                value={`${rules.rate}%`}
                tone={rules.flagged > 0 ? "amber" : "emerald"}
                icon={<Scale size={12} />}
                detail={`${rules.passed} passed · ${rules.flagged} flagged`}
                href="/applications"
                foot={`${rules.total} persisted rule checks`}
              />
            </MetricGrid>

            <SlaHeatmap rows={regionStats(portfolio)} />

            <StatutoryClockBand apps={portfolio} />

            <div className="grid gap-4 xl:grid-cols-3 [&>*]:min-w-0">
              <div className="min-w-0 xl:col-span-2">
                <PriorityTable
                  apps={portfolio}
                  title={priorityTitle}
                  caption={priorityCaption}
                  href={role === "BUREAU_OFFICER" ? "/escalations" : "/scrutiny"}
                />
              </div>
              <PipelinePanel apps={portfolio} />
            </div>

            <div className="grid gap-4 xl:grid-cols-3 [&>*]:min-w-0">
              <DeficiencyInbox apps={portfolio} role={role} />
              <EscalationPanel apps={portfolio} />
              <DocumentExposure documents={documents} national />
            </div>

            <LedgerStream
              entries={recentAudit}
              valid={integrity.valid}
              totalEntries={integrity.entries}
              headHash={integrity.headHash}
              title="National audit ledger"
              limit={6}
            />
          </>
        )}
      </div>
    </>
  );
}
