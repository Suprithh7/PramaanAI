import Link from "next/link";
import type { ReactNode } from "react";
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
import { runSlaSweepAction, scheduleEvcAction, submitSiteReportAction } from "@/app/actions";
import { EVC_ROSTER, GEOFENCE_RADIUS_M, checkConflict } from "@/lib/evc";
import { daysUntil, fmtDate, fmtDateTime, fmtNumber, shortRef } from "@/lib/format";
import { getPortfolio } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { REGION_META, type Region, can } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConflictBadge, EvcReportBadge, StatusBadge } from "@/components/ui/Badges";
import { CaseActionForm } from "@/components/case/CaseActionForm";
import { GeofenceRadar } from "@/components/evc/GeofenceRadar";
import { ActionButton } from "@/components/ui/ActionFeedback";

export const dynamic = "force-dynamic";

type SearchParams = { inspection?: string; schedule?: string };

function visitTiming(date: Date, filed: boolean) {
  if (filed) return "Report filed";
  const remaining = daysUntil(date);
  if (remaining < 0) return `${Math.abs(remaining)} day${Math.abs(remaining) === 1 ? "" : "s"} late`;
  if (remaining === 0) return "Visit is today";
  return `Visit in ${remaining} day${remaining === 1 ? "" : "s"}`;
}

export default async function InspectionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSession();
  const params = await searchParams;
  const apps = await getPortfolio(session);
  const isInspector = session.role === "EVC_MEMBER";

  const visits = apps
    .flatMap((app) => app.inspections.map((inspection) => ({ inspection, app })))
    .filter(({ inspection }) => !isInspector || inspection.committeeLead === session.user.name)
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

  const awaiting = visits.filter(({ inspection }) => inspection.siteReportStatus !== "COMPLETED").length;
  const overdue = visits.filter(({ inspection }) => inspection.siteReportStatus === "OVERDUE").length;
  const completed = visits.filter(({ inspection }) => inspection.siteReportStatus === "COMPLETED").length;
  const geofenced = visits.filter(
    ({ inspection }) => inspection.siteReportStatus === "COMPLETED" && inspection.geofenceVerified,
  ).length;
  const canSchedule = can(session.role, "SCHEDULE_EVC");
  const reportFiled = selectedVisit?.inspection.siteReportStatus === "COMPLETED";
  const presenceVerified = reportFiled && !!selectedVisit?.inspection.geofenceVerified;
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

  const metrics: Array<{
    label: string;
    value: number | string;
    unit?: string;
    detail: string;
    tone?: "navy" | "red" | "amber" | "emerald";
    icon: ReactNode;
  }> = [
    {
      label: "Visits on record",
      value: visits.length,
      unit: "visits",
      detail: "Every committee set up so far",
      icon: <CalendarClock size={15} />,
    },
    {
      label: "Waiting for a report",
      value: awaiting,
      unit: "visits",
      detail: `${completed} of ${visits.length} reports already filed`,
      tone: "amber",
      icon: <ClipboardCheck size={15} />,
    },
    {
      label: "Past the visit date",
      value: overdue,
      unit: "visits",
      detail: overdue > 0 ? "The inspector has not filed yet" : "Nothing is overdue",
      tone: overdue > 0 ? "red" : "emerald",
      icon: <ShieldAlert size={15} />,
    },
    {
      label: "Location verified",
      value: completed > 0 ? `${Math.round((geofenced / completed) * 100)}%` : "—",
      detail:
        completed > 0
          ? `${geofenced} of ${completed} filed report${completed === 1 ? "" : "s"} confirmed on campus`
          : "No report filed yet",
      tone: "emerald",
      icon: <Crosshair size={15} />,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Field inspection"
        title="Inspections that cannot be faked"
        description="Before a college is approved, someone has to stand on its campus. Here the inspector must be physically present, and the committee cannot contain anyone connected to the applicant."
        meta={
          <>
            <span className="badge border-navy-300 bg-navy-50 text-navy-900">{visits.length} inspections</span>
            <span className="text-xs text-slate-600">{awaiting} waiting for a report</span>
            <span className={`text-xs font-semibold ${overdue > 0 ? "text-red-700" : "text-emerald-700"}`}>
              {overdue} past the visit date
            </span>
            <span className="text-xs text-slate-600">{geofenced} confirmed on campus</span>
          </>
        }
        actions={
          <>
            <Link href="/scrutiny" className="btn btn-outline">
              <ClipboardCheck size={13} /> Officer review
            </Link>
            {can(session.role, "RUN_SLA_SWEEP") && (
              <ActionButton
                action={runSlaSweepAction}
                fields={{}}
                label="Check overdue visits"
                pendingLabel="Checking…"
                variant="outline"
                size="sm"
                icon={<ShieldAlert size={13} />}
              />
            )}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            unit={metric.unit}
            detail={metric.detail}
            tone={metric.tone}
            icon={metric.icon}
          />
        ))}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <article className="panel p-4">
          <div className="flex items-center gap-2 text-navy-900">
            <ShieldCheck size={16} />
            <h2 className="font-serif text-base font-semibold">No conflicts</h2>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
            An inspector is refused if they work in the applicant&apos;s region or teach at its affiliating
            university. The check runs before the visit is scheduled.
          </p>
        </article>
        <article className="panel p-4">
          <div className="flex items-center gap-2 text-navy-900">
            <Crosshair size={16} />
            <h2 className="font-serif text-base font-semibold">Real presence</h2>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
            The site report is accepted only from inside {GEOFENCE_RADIUS_M} m of the campus. The distance below is
            worked out from the coordinates the device sends.
          </p>
        </article>
        <article className="panel p-4">
          <div className="flex items-center gap-2 text-navy-900">
            <ClipboardCheck size={16} />
            <h2 className="font-serif text-base font-semibold">Locked record</h2>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
            The report and the location are written to a tamper-evident log. Changing a past entry breaks the chain
            and is caught on the audit page.
          </p>
        </article>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <section className="panel flex flex-col">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Overdue first</div>
              <h2 className="panel-title mt-0.5">Visit list</h2>
            </div>
            <span className="font-mono text-xs text-slate-500">{visits.length}</span>
          </div>

          {visits.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No inspections yet"
                description={
                  isInspector
                    ? "No visit has been assigned to you. The regional office assigns an inspector once a case clears the rule check."
                    : "No inspection committee has been set up yet."
                }
                icon={<CalendarClock size={18} />}
              />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {visits.map(({ inspection, app }) => {
                const active = inspection.id === selectedVisit?.inspection.id;
                return (
                  <li key={inspection.id}>
                    <Link
                      href={`/inspections?inspection=${inspection.id}`}
                      className={`block border-l-2 px-4 py-3 transition ${
                        active
                          ? "border-brass-500 bg-brass-50/50"
                          : "border-transparent hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono text-2xs font-semibold text-navy-900">
                            {shortRef(app.referenceNo)}
                          </div>
                          <div className="mt-0.5 truncate text-xs font-semibold text-navy-950">
                            {app.institution.name}
                          </div>
                          <div className="mt-1 flex items-center gap-1 text-2xs text-slate-500">
                            <MapPin size={10} /> {app.institution.city} ·{" "}
                            {REGION_META[app.institution.region as Region]?.label ?? app.institution.region}
                          </div>
                        </div>
                        <ArrowUpRight size={13} className={active ? "text-brass-700" : "text-slate-300"} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <EvcReportBadge status={inspection.siteReportStatus} />
                        <ConflictBadge passed={inspection.conflictCheckPassed} />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-2xs">
                        <span className="text-slate-500">{fmtDate(inspection.scheduledDate)}</span>
                        <span
                          className={`font-mono font-semibold ${
                            inspection.siteReportStatus === "COMPLETED"
                              ? "text-emerald-700"
                              : daysUntil(inspection.scheduledDate) < 0
                                ? "text-red-700"
                                : "text-slate-600"
                          }`}
                        >
                          {visitTiming(
                            inspection.scheduledDate,
                            inspection.siteReportStatus === "COMPLETED",
                          )}
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
                  <div className="eyebrow">Selected visit</div>
                  <h2 className="panel-title mt-0.5">{selectedVisit.app.institution.name}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedVisit.app.institution.city} ·{" "}
                    {REGION_META[selectedVisit.app.institution.region as Region]?.label ??
                      selectedVisit.app.institution.region}{" "}
                    · {selectedVisit.app.programName}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <EvcReportBadge status={selectedVisit.inspection.siteReportStatus} />
                  <Link href={`/applications/${selectedVisit.app.id}`} className="btn btn-outline btn-xs">
                    Open case <ArrowUpRight size={11} />
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-px bg-slate-200 md:grid-cols-3">
                <div className="bg-white p-4">
                  <div className="label">Inspector</div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-navy-950">
                    <UserRoundCheck size={14} className="text-navy-700" />{" "}
                    {selectedVisit.inspection.committeeLead}
                  </div>
                  <div className="mt-1 text-xs leading-snug text-slate-600">
                    {selectedVisit.inspection.committeeAffiliation}
                  </div>
                </div>
                <div className="bg-white p-4">
                  <div className="label">Visit date</div>
                  <div className="mt-1.5 font-mono text-sm font-semibold text-navy-950">
                    {fmtDate(selectedVisit.inspection.scheduledDate)}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    {visitTiming(
                      selectedVisit.inspection.scheduledDate,
                      selectedVisit.inspection.siteReportStatus === "COMPLETED",
                    )}
                  </div>
                  <div className="mt-2 text-2xs uppercase tracking-label text-slate-400">
                    Set up {fmtDateTime(selectedVisit.inspection.createdAt)}
                  </div>
                </div>
                <div className="bg-white p-4">
                  <div className="label">Where the case stands</div>
                  <div className="mt-1.5">
                    <StatusBadge status={selectedVisit.app.status} />
                  </div>
                  <div className="mt-2 text-xs leading-relaxed text-slate-600">
                    {selectedVisit.inspection.siteReportStatus === "COMPLETED"
                      ? "The inspection report is filed. The Bureau can now record a decision."
                      : "The inspector still has to visit the campus and file a location-stamped report."}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-0 border-t border-slate-200 md:grid-cols-2">
                <div className="border-b border-slate-200 p-4 md:border-b-0 md:border-r">
                  <div className="eyebrow flex items-center gap-1">
                    <ShieldCheck size={12} /> Committee conflict check
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <ConflictBadge passed={selectedVisit.inspection.conflictCheckPassed} />
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">
                    {selectedVisit.inspection.conflictNotes ??
                      "The inspector's region and university were checked against the applicant's."}
                  </p>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="eyebrow flex items-center gap-1">
                      <Crosshair size={12} /> Proof of presence
                    </div>
                    <span
                      className={`badge ${
                        presenceVerified
                          ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                          : "border-slate-300 bg-slate-50 text-slate-700"
                      }`}
                    >
                      {presenceVerified ? <CheckCircle2 size={11} /> : <MapPin size={11} />}
                      {presenceVerified ? "On campus" : "No report yet"}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="mx-auto w-[180px] shrink-0 sm:mx-0">
                      <GeofenceRadar
                        compact
                        campus={{
                          latitude: selectedVisit.app.institution.latitude,
                          longitude: selectedVisit.app.institution.longitude,
                        }}
                        fix={{
                          coordinates: reportFiled ? selectedVisit.inspection.geofenceCoordinates : null,
                          distanceM: reportFiled ? selectedVisit.inspection.geofenceDistanceM : null,
                          verified: presenceVerified,
                        }}
                        campusLabel={`${selectedVisit.app.institution.city} campus`}
                      />
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      {reportFiled && selectedVisit.inspection.geofenceDistanceM !== null && (
                        <div className="font-mono text-xs font-semibold text-navy-950">
                          {fmtNumber(Math.round(selectedVisit.inspection.geofenceDistanceM))} m from the campus
                          <span className="ml-1 font-normal text-slate-500">
                            (limit {GEOFENCE_RADIUS_M} m)
                          </span>
                        </div>
                      )}
                      <p className="text-xs leading-relaxed text-slate-600">
                        Campus centre {selectedVisit.app.institution.latitude.toFixed(4)}° N,{" "}
                        {selectedVisit.app.institution.longitude.toFixed(4)}° E. A report is accepted only from
                        inside the dashed circle.
                      </p>
                      <div className="font-mono text-2xs leading-relaxed text-slate-400">
                        {reportFiled && selectedVisit.inspection.geofenceCoordinates
                          ? `Recorded at ${selectedVisit.inspection.geofenceCoordinates}`
                          : "No location recorded — nothing to show until the report is filed"}
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
                    <div className="eyebrow">Filed inspection report</div>
                    <h2 className="panel-title mt-0.5">What the inspector found</h2>
                  </div>
                  <span className="font-mono text-2xs text-slate-500">
                    {fmtDateTime(selectedVisit.inspection.reportSubmittedAt)}
                  </span>
                </div>
                <div className="p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="badge border-emerald-300 bg-emerald-50 text-emerald-900">
                      {selectedVisit.inspection.recommendation?.replaceAll("_", " ") ?? "RECOMMENDED"}
                    </span>
                    <span className="font-mono text-2xs text-slate-500">
                      Recorded {fmtNumber(Math.round(selectedVisit.inspection.geofenceDistanceM ?? 0))} m from campus
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-700">{selectedVisit.inspection.reportSummary}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={`/applications/${selectedVisit.app.id}`} className="btn btn-outline btn-xs">
                      <FileCheck2 size={11} /> Open case file
                    </Link>
                    <Link href={`/audit?q=${selectedVisit.app.referenceNo}`} className="btn btn-ghost btn-xs">
                      Check the audit log
                    </Link>
                  </div>
                </div>
              </section>
            ) : canReport ? (
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <div className="eyebrow">Inspector&apos;s report</div>
                    <h2 className="panel-title mt-0.5">File the site report</h2>
                  </div>
                  <span className="badge border-amber-300 bg-amber-50 text-amber-900">
                    {selectedVisit.inspection.siteReportStatus === "OVERDUE" ? "OVERDUE" : "PENDING"}
                  </span>
                </div>
                <div className="p-4">
                  <CaseActionForm
                    action={submitSiteReportAction}
                    hidden={{ inspectionId: selectedVisit.inspection.id }}
                    description="The form starts at the campus centre. To see the control work, replace the latitude with 12.9000 and submit — the report will be refused."
                    fields={[
                      {
                        name: "reportSummary",
                        label: "What did you see on campus?",
                        type: "textarea",
                        required: true,
                        placeholder:
                          "Land, buildings, laboratories, faculty present, safety systems, library and workshop…",
                        hint: "At least 20 characters. This goes into the case file and the audit log.",
                      },
                      {
                        name: "recommendation",
                        label: "Your recommendation",
                        type: "select",
                        required: true,
                        defaultValue: "RECOMMENDED",
                        options: [
                          { value: "RECOMMENDED", label: "Recommended for approval" },
                          { value: "CONDITIONAL", label: "Conditional — some points to fix" },
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
                        hint: `Campus is at ${selectedVisit.app.institution.latitude.toFixed(4)}.`,
                      },
                      {
                        name: "deviceLongitude",
                        label: "Device longitude",
                        type: "number",
                        required: true,
                        step: 0.0001,
                        defaultValue: selectedVisit.app.institution.longitude,
                        hint: `Campus is at ${selectedVisit.app.institution.longitude.toFixed(4)}.`,
                      },
                    ]}
                    submitLabel="Submit report"
                    pendingLabel="Checking your location…"
                    variant="primary"
                    submitIcon={<Crosshair size={13} />}
                  />
                </div>
              </section>
            ) : (
              <section className="panel p-4">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert size={18} className="mt-0.5 shrink-0 text-slate-400" />
                  <div>
                    <div className="font-serif text-base font-semibold text-navy-950">
                      The report has not been filed
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      {selectedVisit.app.status !== "EVC_SCHEDULED"
                        ? "This inspection has already moved the case forward. The report stays on the case file."
                        : `Only the assigned inspector (${selectedVisit.inspection.committeeLead}) can file this report.`}
                    </p>
                    <p className="mt-1.5 text-xs text-slate-500">
                      Switch to <span className="font-semibold text-navy-900">Demo view as → Inspector</span> in the
                      top bar to submit it.
                    </p>
                  </div>
                </div>
              </section>
            )}
          </div>
        ) : (
          <section className="panel flex items-center justify-center p-8">
            <EmptyState
              title="Pick a visit"
              description="Choose an inspection from the list to see the committee, the location record and the report."
              icon={<ClipboardCheck size={18} />}
            />
          </section>
        )}
      </div>

      {canSchedule && (
        <section className="panel mt-4">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Ready for inspection</div>
              <h2 className="panel-title mt-0.5">Cases waiting for an inspector</h2>
              <p className="mt-1 text-xs text-slate-500">
                These applications passed every rule check. Choose an inspector with no connection to the college.
              </p>
            </div>
            <span className="font-mono text-xs text-slate-500">{scheduling.length} ready</span>
          </div>

          {scheduling.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Nothing waiting"
                description="Every case that cleared the rule check already has a committee."
                icon={<CheckCircle2 size={18} />}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
              <ul className="divide-y divide-slate-100 border-b border-slate-200 lg:border-b-0 lg:border-r">
                {scheduling.map((app) => (
                  <li key={app.id}>
                    <Link
                      href={`/inspections?schedule=${app.id}${
                        selectedVisit ? `&inspection=${selectedVisit.inspection.id}` : ""
                      }`}
                      className={`block px-4 py-3 transition ${
                        app.id === selectedSchedule?.id ? "bg-brass-50/60" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-2xs font-semibold text-navy-900">
                          {shortRef(app.referenceNo)}
                        </span>
                        <StatusBadge status={app.status} />
                      </div>
                      <div className="mt-1 truncate text-xs font-semibold text-navy-950">
                        {app.institution.name}
                      </div>
                      <div className="mt-0.5 text-2xs text-slate-500">
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
                        <div className="eyebrow">Who can inspect this college</div>
                        <h3 className="font-serif text-base font-semibold text-navy-950">
                          {selectedSchedule.institution.name}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Region{" "}
                          {REGION_META[selectedSchedule.institution.region as Region]?.label ??
                            selectedSchedule.institution.region}{" "}
                          · university {selectedSchedule.institution.affiliatingUniversity}
                        </p>
                      </div>
                      <span className="badge border-navy-300 bg-navy-50 text-navy-900">
                        {eligibleMembers.length} of {EVC_ROSTER.length} eligible
                      </span>
                    </div>

                    <div className="mt-3 overflow-x-auto">
                      <table className="data-table min-w-[560px]">
                        <thead>
                          <tr>
                            <th>Inspector</th>
                            <th className="w-[130px]">Region</th>
                            <th>Institution</th>
                            <th className="w-[170px]">Conflict check</th>
                          </tr>
                        </thead>
                        <tbody>
                          {eligible.map(({ member, conflict }) => (
                            <tr key={member.id} className={conflict.passed ? undefined : "bg-red-50/40"}>
                              <td>
                                <div className="text-xs font-semibold text-navy-950">{member.name}</div>
                                <div className="text-2xs uppercase tracking-label text-slate-400">
                                  {member.specialisation}
                                </div>
                              </td>
                              <td className="font-mono text-2xs text-slate-600">{member.region}</td>
                              <td className="text-xs text-slate-600">{member.affiliation}</td>
                              <td>
                                <ConflictBadge passed={conflict.passed} />
                                {!conflict.passed && (
                                  <div className="mt-1 text-2xs leading-snug text-red-700">
                                    {conflict.reasons[0]}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {eligibleMembers.length === 0 ? (
                      <div className="mt-3 border border-red-300 bg-red-50 p-3 text-xs leading-relaxed text-red-900">
                        Every inspector has a connection to this college. The case must go to the Bureau for an
                        outside committee.
                      </div>
                    ) : (
                      <div className="mt-4 border-t border-slate-200 pt-3">
                        <CaseActionForm
                          action={scheduleEvcAction}
                          hidden={{ applicationId: selectedSchedule.id }}
                          description="Only inspectors with no connection can be picked. Scheduling moves the case to the inspection stage and starts the visit clock."
                          fields={[
                            {
                              name: "memberId",
                              label: "Inspector",
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
                              label: "Visit date",
                              type: "date",
                              required: true,
                              defaultValue: visitDate,
                              hint: "Must be in the future. The national overdue check watches this date.",
                            },
                          ]}
                          submitLabel="Schedule the visit"
                          pendingLabel="Scheduling…"
                          variant="primary"
                          submitIcon={<CalendarClock size={13} />}
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
