import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Crosshair,
  FileCheck2,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { scheduleEvcAction, submitSiteReportAction } from "@/app/actions";
import {
  EVC_ROSTER,
  GEOFENCE_RADIUS_M,
  checkConflict,
} from "@/lib/evc";
import { daysUntil, fmtDate, fmtDateTime, fmtNumber, shortRef } from "@/lib/format";
import { liveDaysInStage, stageDeadline } from "@/lib/sla";
import { getPortfolio } from "@/lib/queries";
import { getSession } from "@/lib/session";
import {
  REGION_META,
  ROLE_META,
  can,
  type Region,
} from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConflictBadge, EvcReportBadge, SlaBadge, StatusBadge } from "@/components/ui/Badges";
import { CaseActionForm } from "@/components/case/CaseActionForm";
import { LiveStatutoryClock } from "@/components/case/LiveStatutoryClock";
import { GeofenceRadar } from "@/components/evc/GeofenceRadar";
import { ActionButton } from "@/components/ui/ActionFeedback";
import { runSlaSweepAction } from "@/app/actions";

export const dynamic = "force-dynamic";

type SearchParams = { inspection?: string; schedule?: string };

export default async function EvcPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSession();
  const params = await searchParams;
  const apps = await getPortfolio(session);
  const evcIdentity = session.role === "EVC_MEMBER";

  const visits = apps
    .flatMap((app) => app.inspections.map((inspection) => ({ inspection, app })))
    .filter(({ inspection }) => !evcIdentity || inspection.committeeLead === session.user.name)
    .sort((a, b) => {
      const weight = (status: string) => (status === "OVERDUE" ? 0 : status === "PENDING" ? 1 : 2);
      if (weight(a.inspection.siteReportStatus) !== weight(b.inspection.siteReportStatus)) {
        return weight(a.inspection.siteReportStatus) - weight(b.inspection.siteReportStatus);
      }
      return a.inspection.scheduledDate.getTime() - b.inspection.scheduledDate.getTime();
    });

  const selectedVisit =
    visits.find(({ inspection }) => inspection.id === params.inspection) ?? visits[0] ?? null;

  const scheduling = apps.filter((app) => app.status === "SCRUTINY_CLEARED");
  const selectedSchedule =
    scheduling.find((app) => app.id === params.schedule) ?? scheduling[0] ?? null;

  const pending = visits.filter(({ inspection }) => inspection.siteReportStatus === "PENDING").length;
  const overdue = visits.filter(({ inspection }) => inspection.siteReportStatus === "OVERDUE").length;
  const completed = visits.filter(({ inspection }) => inspection.siteReportStatus === "COMPLETED").length;
  const geofenced = visits.filter(({ inspection }) => inspection.geofenceVerified).length;
  const canSchedule = can(session.role, "SCHEDULE_EVC");
  const canReport =
    session.role === "EVC_MEMBER" &&
    !!selectedVisit &&
    selectedVisit.app.status === "EVC_SCHEDULED" &&
    selectedVisit.inspection.siteReportStatus !== "COMPLETED" &&
    selectedVisit.inspection.committeeLead === session.user.name;

  const eligible = selectedSchedule
    ? EVC_ROSTER.map((member) => ({ member, conflict: checkConflict(member, selectedSchedule.institution) }))
    : [];
  const eligibleMembers = eligible.filter((row) => row.conflict.passed).map((row) => row.member);
  const visitDate = selectedSchedule
    ? new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)
    : "";

  return (
    <>
      <PageHeader
        eyebrow={`${ROLE_META[session.role].short} authority · field verification`}
        title="EVC operations & inspection control"
        description="Constitute conflict-free Expert Visit Committees, track the geofenced inspection clock and file the site verification report. Reports can only be submitted from within 750 m of the campus."
        meta={
          <>
            <span className="badge border-indigo-300 bg-indigo-50 text-indigo-900">{visits.length} constituted</span>
            <span className="text-[10px] text-slate-600">{pending} awaiting report</span>
            <span className={`text-[10px] font-semibold ${overdue > 0 ? "text-red-700" : "text-emerald-700"}`}>
              {overdue} overdue
            </span>
            <span className="text-[10px] text-slate-600">{geofenced} geofence verified</span>
            {canSchedule && <span className="text-[10px] text-slate-600">{scheduling.length} awaiting constitution</span>}
          </>
        }
        actions={
          <>
            <Link href="/scrutiny" className="btn btn-outline">
              <ClipboardCheck size={11} /> Scrutiny desk
            </Link>
            {can(session.role, "RUN_SLA_SWEEP") && (
              <ActionButton
                action={runSlaSweepAction}
                fields={{}}
                label="Sweep inspection clocks"
                pendingLabel="Sweeping…"
                variant="outline"
                size="sm"
                icon={<ShieldAlert size={11} />}
              />
            )}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <MetricCard
          label="Inspection docket"
          value={visits.length}
          unit="visits"
          icon={<CalendarClock size={13} />}
          detail={evcIdentity ? "Assigned to this committee identity" : "Across all constituted committees"}
        />
        <MetricCard
          label="Report pending"
          value={pending}
          unit="visits"
          tone="amber"
          icon={<ClipboardCheck size={13} />}
          detail={`${completed} completed report${completed === 1 ? "" : "s"} on file`}
        />
        <MetricCard
          label="Report overdue"
          value={overdue}
          unit="visits"
          tone="red"
          icon={<ShieldAlert size={13} />}
          detail={overdue > 0 ? "Site report past the scheduled date" : "No inspection past its date"}
        />
        <MetricCard
          label="Geofence coverage"
          value={visits.length > 0 ? `${Math.round((geofenced / visits.length) * 100)}%` : "—"}
          tone="emerald"
          icon={<Crosshair size={13} />}
          detail={`${geofenced} of ${visits.length} reports device-verified`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="panel flex flex-col">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Overdue → pending → completed</div>
              <h2 className="panel-title mt-0.5">Inspection docket</h2>
            </div>
            <span className="font-mono text-[10px] text-slate-500">{visits.length} files</span>
          </div>

          {visits.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No inspections assigned"
                description={
                  evcIdentity
                    ? "Your committee has no constituted visits. The Regional Office will assign cases after scrutiny clearance."
                    : "No Expert Visit Committee has been constituted yet."
                }
                icon={<CalendarClock size={16} />}
              />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {visits.map(({ inspection, app }) => {
                const active = inspection.id === selectedVisit?.inspection.id;
                const remaining = daysUntil(inspection.scheduledDate);
                return (
                  <li key={inspection.id}>
                    <Link
                      href={`/evc?inspection=${inspection.id}`}
                      className={`block px-3.5 py-3 transition ${
                        active ? "border-l-2 border-brass-500 bg-brass-50/50" : "border-l-2 border-transparent hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono text-[10px] font-semibold text-navy-900">{shortRef(app.referenceNo)}</div>
                          <div className="mt-0.5 truncate text-[11px] font-medium text-navy-950">{app.institution.name}</div>
                          <div className="mt-0.5 flex items-center gap-1 text-[9px] text-slate-500">
                            <MapPin size={9} /> {app.institution.city} ·{" "}
                            {REGION_META[app.institution.region as Region]?.code ?? app.institution.region}
                          </div>
                        </div>
                        <ArrowUpRight size={11} className={active ? "text-brass-700" : "text-slate-300"} />
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        <EvcReportBadge status={inspection.siteReportStatus} />
                        <ConflictBadge passed={inspection.conflictCheckPassed} />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[9px]">
                        <span className="text-slate-500">
                          Visit {fmtDate(inspection.scheduledDate)}
                        </span>
                        <span
                          className={`font-mono font-semibold ${
                            inspection.siteReportStatus === "COMPLETED"
                              ? "text-emerald-700"
                              : remaining < 0
                                ? "text-red-700"
                                : remaining === 0
                                  ? "text-amber-700"
                                  : "text-slate-600"
                          }`}
                        >
                          {inspection.siteReportStatus === "COMPLETED"
                            ? "Filed"
                            : remaining < 0
                              ? `${Math.abs(remaining)}d late`
                              : remaining === 0
                                ? "Today"
                                : `T-${remaining}d`}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          </section>

        {selectedVisit ? (
          <div className="space-y-4">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <div className="eyebrow">
                    {selectedVisit.inspection.committeeRegion} committee ·{" "}
                    {selectedVisit.app.institution.state}
                  </div>
                  <h2 className="panel-title mt-0.5">{selectedVisit.app.institution.name}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <EvcReportBadge status={selectedVisit.inspection.siteReportStatus} />
                  <Link href={`/applications/${selectedVisit.app.id}?tab=evc`} className="btn btn-outline btn-xs">
                    Case EVC file <ArrowUpRight size={10} />
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-px bg-slate-200 md:grid-cols-3">
                <div className="bg-white p-3.5">
                  <div className="label">Committee lead</div>
                  <div className="mt-1 flex items-center gap-1.5 text-[12px] font-semibold text-navy-950">
                    <UserRoundCheck size={12} className="text-navy-700" /> {selectedVisit.inspection.committeeLead}
                  </div>
                  <div className="mt-0.5 text-[9px] leading-snug text-slate-500">
                    {selectedVisit.inspection.committeeAffiliation}
                  </div>
                  <div className="mt-2 font-mono text-[8px] uppercase tracking-label text-slate-400">
                    {selectedVisit.inspection.committeeRegion} region roster
                  </div>
                </div>
                <div className="bg-white p-3.5">
                  <div className="label">Scheduled visit</div>
                  <div className="mt-1 font-mono text-[12px] font-semibold text-navy-950">
                    {fmtDate(selectedVisit.inspection.scheduledDate)}
                  </div>
                  <div className="mt-0.5 text-[9px] text-slate-500">
                    {daysUntil(selectedVisit.inspection.scheduledDate) < 0
                      ? `${Math.abs(daysUntil(selectedVisit.inspection.scheduledDate))} day(s) past schedule`
                      : `${daysUntil(selectedVisit.inspection.scheduledDate)} day(s) remaining`}
                  </div>
                  <div className="mt-2 text-[8px] uppercase tracking-label text-slate-400">
                    Constituted {fmtDateTime(selectedVisit.inspection.createdAt)}
                  </div>
                </div>
                <div className="bg-white p-3.5">
                  <div className="label">Case status</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <StatusBadge status={selectedVisit.app.status} />
                    <SlaBadge
                      status={selectedVisit.app.slaStatus === "BREACHED" ? "BREACHED" : selectedVisit.app.slaStatus}
                      days={liveDaysInStage(selectedVisit.app.stageEnteredAt)}
                    />
                  </div>
                  <div className="mt-1.5 text-[9px] text-slate-500">
                    {selectedVisit.app.programName} · {fmtNumber(selectedVisit.app.intakeRequested)} seats
                  </div>
                  <div className="mt-1 font-mono text-[8px] text-slate-400">{selectedVisit.app.referenceNo}</div>
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <LiveStatutoryClock
                      variant="compact"
                      stageEnteredAt={selectedVisit.app.stageEnteredAt.toISOString()}
                      serverNow={new Date().toISOString()}
                      enteredLabel={fmtDate(selectedVisit.app.stageEnteredAt)}
                      deadlineLabel={fmtDate(stageDeadline(selectedVisit.app.stageEnteredAt))}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-0 border-t border-slate-200 md:grid-cols-2">
                <div className="border-b border-slate-200 p-4 md:border-b-0 md:border-r">
                  <div className="eyebrow flex items-center gap-1">
                    <ShieldCheck size={10} /> Conflict-of-interest verification
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <ConflictBadge passed={selectedVisit.inspection.conflictCheckPassed} />
                    <span className="font-mono text-[9px] text-slate-400">
                      {selectedVisit.inspection.committeeRegion} vs{" "}
                      {REGION_META[selectedVisit.app.institution.region as Region]?.label ?? selectedVisit.app.institution.region}
                    </span>
                  </div>
                  <p className="mt-2 text-[9px] leading-relaxed text-slate-600">
                    {selectedVisit.inspection.conflictNotes ??
                      "Committee region and affiliating university checked against the applicant institution."}
                  </p>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="eyebrow flex items-center gap-1">
                      <Crosshair size={10} /> Geofenced site verification
                    </div>
                    <span
                      className={`badge ${
                        selectedVisit.inspection.geofenceVerified
                          ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                          : "border-slate-300 bg-slate-50 text-slate-700"
                      }`}
                    >
                      {selectedVisit.inspection.geofenceVerified ? <CheckCircle2 size={9} /> : <MapPin size={9} />}
                      {selectedVisit.inspection.geofenceVerified ? "Device verified" : "Awaiting field report"}
                    </span>
                  </div>

                  <div className="mt-2.5 flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="mx-auto w-[180px] shrink-0 sm:mx-0">
                      <GeofenceRadar
                        compact
                        campus={{
                          latitude: selectedVisit.app.institution.latitude,
                          longitude: selectedVisit.app.institution.longitude,
                        }}
                        fix={{
                          coordinates: selectedVisit.inspection.geofenceCoordinates,
                          distanceM: selectedVisit.inspection.geofenceDistanceM,
                          verified: selectedVisit.inspection.geofenceVerified,
                        }}
                        campusLabel={`${selectedVisit.app.institution.city} campus`}
                      />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1.5">
                      {selectedVisit.inspection.geofenceDistanceM !== null && (
                        <div className="font-mono text-[10px] font-semibold text-navy-950">
                          {fmtNumber(Math.round(selectedVisit.inspection.geofenceDistanceM))} m from campus
                          <span className="ml-1 font-normal text-slate-500">
                            / {GEOFENCE_RADIUS_M} m limit
                          </span>
                        </div>
                      )}
                      <p className="text-[9px] leading-relaxed text-slate-600">
                        Campus datum {selectedVisit.app.institution.latitude.toFixed(4)}° N,{" "}
                        {selectedVisit.app.institution.longitude.toFixed(4)}° E. Reports are accepted only from
                        inside the {GEOFENCE_RADIUS_M} m geofence; the plot is drawn from the coordinates the field
                        device logged on submit.
                      </p>
                      <div className="font-mono text-[8px] leading-relaxed text-slate-400">
                        {selectedVisit.inspection.geofenceCoordinates
                          ? `Last fix ${selectedVisit.inspection.geofenceCoordinates}`
                          : "No device fix on record"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {selectedVisit.inspection.siteReportStatus === "COMPLETED" ? (
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">Expert Visit Committee report</div>
                    <h2 className="panel-title mt-0.5">Filed site verification</h2>
                  </div>
                  <span className="font-mono text-[9px] text-slate-500">
                    {fmtDateTime(selectedVisit.inspection.reportSubmittedAt)}
                  </span>
                </div>
                <div className="p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="badge border-emerald-300 bg-emerald-50 text-emerald-900">
                      {selectedVisit.inspection.recommendation?.replaceAll("_", " ") ?? "RECOMMENDED"}
                    </span>
                    <span className="font-mono text-[9px] text-slate-500">
                      Geofence {fmtNumber(Math.round(selectedVisit.inspection.geofenceDistanceM ?? 0))} m ·{" "}
                      {selectedVisit.inspection.geofenceCoordinates}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-700">{selectedVisit.inspection.reportSummary}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={`/applications/${selectedVisit.app.id}`} className="btn btn-outline btn-xs">
                      <FileCheck2 size={10} /> Open case file
                    </Link>
                    <Link href={`/audit?q=${selectedVisit.app.referenceNo}`} className="btn btn-ghost btn-xs">
                      Verify ledger evidence
                    </Link>
                  </div>
                </div>
              </section>
            ) : canReport ? (
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">Module 4 · field evidence</div>
                    <h2 className="panel-title mt-0.5">File site verification report</h2>
                  </div>
                  <span className="badge border-amber-300 bg-amber-50 text-amber-900">
                    {selectedVisit.inspection.siteReportStatus}
                  </span>
                </div>
                <div className="p-4">
                  <CaseActionForm
                    action={submitSiteReportAction}
                    hidden={{ inspectionId: selectedVisit.inspection.id }}
                    description="The report is accepted only when the field device is inside the campus geofence. Coordinates default to the campus centre for demonstration; move the device outside the radius to test the control."
                    fields={[
                      {
                        name: "reportSummary",
                        label: "Site inspection summary",
                        type: "textarea",
                        required: true,
                        placeholder: "Record the physical verification of land, built-up area, laboratories, faculty and safety systems…",
                        hint: "Minimum 20 characters. Filed into the case file and the hash-linked ledger.",
                      },
                      {
                        name: "recommendation",
                        label: "Committee recommendation",
                        type: "select",
                        required: true,
                        defaultValue: "RECOMMENDED",
                        options: [
                          { value: "RECOMMENDED", label: "Recommended for approval" },
                          { value: "CONDITIONAL", label: "Conditional — observations to close" },
                          { value: "NOT_RECOMMENDED", label: "Not recommended" },
                        ],
                      },
                      {
                        name: "deviceLatitude",
                        label: "Device latitude",
                        type: "number",
                        required: true,
                        step: 0.0001,
                        defaultValue: selectedVisit.app.institution.latitude,
                        hint: `Campus reference ${selectedVisit.app.institution.latitude.toFixed(4)}.`,
                      },
                      {
                        name: "deviceLongitude",
                        label: "Device longitude",
                        type: "number",
                        required: true,
                        step: 0.0001,
                        defaultValue: selectedVisit.app.institution.longitude,
                        hint: `Campus reference ${selectedVisit.app.institution.longitude.toFixed(4)}.`,
                      },
                    ]}
                    submitLabel="Submit geofenced report"
                    pendingLabel="Verifying location…"
                    variant="primary"
                    submitIcon={<Crosshair size={11} />}
                  />
                </div>
              </section>
            ) : (
              <section className="panel p-4">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert size={16} className="mt-0.5 shrink-0 text-slate-400" />
                  <div>
                    <div className="font-serif text-sm font-semibold text-navy-950">Site report not yet filed</div>
                    <p className="mt-1 text-[10px] leading-relaxed text-slate-600">
                      {selectedVisit.app.status !== "EVC_SCHEDULED"
                        ? "This inspection has already advanced the case. The report sits on the permanent case file."
                        : `Only the assigned committee lead (${selectedVisit.inspection.committeeLead}) can file this report from the field.`}
                    </p>
                    <Link href={`/applications/${selectedVisit.app.id}?tab=evc`} className="btn btn-outline btn-xs mt-2">
                      Open full inspection file
                    </Link>
                  </div>
                </div>
              </section>
            )}
          </div>
        ) : (
          <section className="panel flex items-center justify-center p-8">
            <EmptyState
              title="No inspection on file"
              description="Once a case clears scrutiny and a committee is constituted, the inspection file opens here."
              icon={<ClipboardCheck size={16} />}
            >
              {canSchedule && (
                <Link href="/scrutiny" className="btn btn-outline btn-xs">
                  Review scrutiny queue
                </Link>
              )}
            </EmptyState>
          </section>
        )}
      </div>

      {canSchedule && (
        <section className="panel mt-4">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Module 4 · committee constitution</div>
              <h2 className="panel-title mt-0.5">Cases awaiting an Expert Visit Committee</h2>
            </div>
            <span className="font-mono text-[10px] text-slate-500">{scheduling.length} cleared</span>
          </div>

          {scheduling.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No cases awaiting constitution"
                description="Every scrutiny-cleared case already has a committee on file."
                icon={<CheckCircle2 size={16} />}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
              <ul className="divide-y divide-slate-100 border-b border-slate-200 lg:border-b-0 lg:border-r">
                {scheduling.map((app) => (
                  <li key={app.id}>
                    <Link
                      href={`/evc?schedule=${app.id}${selectedVisit ? `&inspection=${selectedVisit.inspection.id}` : ""}`}
                      className={`block px-4 py-2.5 transition ${
                        app.id === selectedSchedule?.id ? "bg-brass-50/60" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] font-semibold text-navy-900">{shortRef(app.referenceNo)}</span>
                        <StatusBadge status={app.status} />
                      </div>
                      <div className="mt-1 truncate text-[11px] font-medium text-navy-950">{app.institution.name}</div>
                      <div className="mt-0.5 text-[9px] text-slate-500">
                        {app.institution.city} ·{" "}
                        {REGION_META[app.institution.region as Region]?.label ?? app.institution.region} ·{" "}
                        {app.programName}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="p-4">
                {selectedSchedule && (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="eyebrow">Conflict-of-interest screening</div>
                        <h3 className="font-serif text-sm font-semibold text-navy-950">
                          {selectedSchedule.institution.name}
                        </h3>
                        <p className="mt-0.5 text-[9px] text-slate-500">
                          Applicant region{" "}
                          {REGION_META[selectedSchedule.institution.region as Region]?.label ?? selectedSchedule.institution.region} ·
                          affiliating university {selectedSchedule.institution.affiliatingUniversity}
                        </p>
                      </div>
                      <span className="badge border-navy-300 bg-navy-50 text-navy-900">
                        {eligibleMembers.length}/{EVC_ROSTER.length} eligible
                      </span>
                    </div>

                    <div className="mt-3 overflow-x-auto">
                      <table className="data-table min-w-[560px]">
                        <thead>
                          <tr>
                            <th>Roster member</th>
                            <th className="w-[120px]">Region</th>
                            <th>Affiliation</th>
                            <th className="w-[150px]">Conflict check</th>
                          </tr>
                        </thead>
                        <tbody>
                          {eligible.map(({ member, conflict }) => (
                            <tr key={member.id} className={conflict.passed ? undefined : "bg-red-50/40"}>
                              <td>
                                <div className="text-[10px] font-semibold text-navy-950">{member.name}</div>
                                <div className="text-[8px] uppercase tracking-label text-slate-400">
                                  {member.specialisation}
                                </div>
                              </td>
                              <td className="font-mono text-[9px] text-slate-600">{member.region}</td>
                              <td className="text-[9px] text-slate-600">{member.affiliation}</td>
                              <td>
                                <ConflictBadge passed={conflict.passed} />
                                {!conflict.passed && (
                                  <div className="mt-0.5 text-[8px] leading-snug text-red-700">{conflict.reasons[0]}</div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {eligibleMembers.length === 0 ? (
                      <div className="mt-3 border border-red-300 bg-red-50 p-3 text-[10px] leading-relaxed text-red-900">
                        Every roster member is conflicted for this applicant. Refer the case to the Bureau for an ad-hoc committee.
                      </div>
                    ) : (
                      <div className="mt-4 border-t border-slate-200 pt-3">
                        <CaseActionForm
                          action={scheduleEvcAction}
                          hidden={{ applicationId: selectedSchedule.id }}
                          description="Only disinterested members are selectable. Constituting the committee advances the case to EVC_SCHEDULED and arms the geofence clock."
                          fields={[
                            {
                              name: "memberId",
                              label: "Committee member",
                              type: "select",
                              required: true,
                              defaultValue: eligibleMembers[0].id,
                              options: eligibleMembers.map((member) => ({
                                value: member.id,
                                label: `${member.name} · ${member.region} · ${member.specialisation}`,
                              })),
                            },
                            {
                              name: "scheduledDate",
                              label: "Inspection date",
                              type: "date",
                              required: true,
                              defaultValue: visitDate,
                              hint: "Must be a future date. The visit clock is monitored by the national SLA sweep.",
                            },
                          ]}
                          submitLabel="Constitute EVC & schedule visit"
                          pendingLabel="Constituting…"
                          variant="primary"
                          submitIcon={<CalendarClock size={11} />}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}
