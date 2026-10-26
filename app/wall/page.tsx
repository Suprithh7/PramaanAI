import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Gauge,
  Layers,
  MapPin,
  Radio,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Timer,
} from "lucide-react";
import Link from "next/link";
import { IndiaWallGrid } from "@/components/wall/IndiaWallGrid";
import { WallLive } from "@/components/wall/WallLive";
import { fmtNumber, fmtTime, truncateHash } from "@/lib/format";
import { auditActionLabel, PROCESSING_PATH_META, REGION_META, ROLE_META, type ProcessingPath, type Region, type Role } from "@/lib/types";
import { getWallData } from "@/lib/wall";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "National Command Wall",
};

type Tone = "navy" | "red" | "amber" | "emerald";

const RAIL: Record<Tone, string> = {
  navy: "bg-navy-400",
  red: "bg-red-400",
  amber: "bg-amber-400",
  emerald: "bg-emerald-400",
};

const VALUE: Record<Tone, string> = {
  navy: "text-white",
  red: "text-red-300",
  amber: "text-amber-300",
  emerald: "text-emerald-300",
};

function roleCode(role: string) {
  return ROLE_META[role as Role]?.short?.toUpperCase() ?? role;
}

function WallStat({
  label,
  value,
  detail,
  icon,
  tone = "navy",
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="relative overflow-hidden border border-white/10 bg-white/[0.035] p-3">
      <span className={`absolute inset-x-0 top-0 h-px ${RAIL[tone]}`} />
      <div className="flex items-start justify-between gap-2">
        <span className="text-[8px] font-semibold uppercase tracking-label text-navy-400">
          {label}
        </span>
        <span className="text-navy-500">{icon}</span>
      </div>
      <div
        className={`mt-2 font-serif text-[34px] font-semibold leading-none tabular-nums ${VALUE[tone]}`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[9px] leading-snug text-navy-400">{detail}</div>
    </div>
  );
}

function Instrument({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: number;
  caption: string;
  tone: Tone;
}) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, value)) / 100);
  const color = tone === "emerald" ? "#34d399" : tone === "amber" ? "#fbbf24" : "#f87171";

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-[92px] w-[92px] shrink-0">
        <svg viewBox="0 0 96 96" className="h-full w-full -rotate-90">
          <circle
            cx="48"
            cy="48"
            r="46"
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1"
            strokeDasharray="1 4"
          />
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="5"
          />
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="donut-arc"
            style={
              {
                "--offset": offset,
                "--circumference": circumference,
              } as React.CSSProperties
            }
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-serif text-[25px] font-semibold leading-none tabular-nums text-white">
            {value}
            <span className="ml-0.5 text-[10px] font-normal text-navy-400">%</span>
          </span>
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-[8px] font-semibold uppercase tracking-label text-navy-400">
          {label}
        </div>
        <div className="mt-0.5 text-[9px] leading-snug text-navy-500">{caption}</div>
      </div>
    </div>
  );
}

export default async function NationalWallPage() {
  const data = await getWallData();
  const {
    regions,
    sla,
    rules,
    stages,
    deficiencies,
    inspections,
    docs,
    escalations,
    integrity,
    audit,
  } = data;

  const slaHealth = sla.total > 0 ? Math.round((sla.ON_TRACK / sla.total) * 100) : 100;
  const conformityTone: Tone = rules.rate >= 90 ? "emerald" : rules.rate >= 70 ? "amber" : "red";
  const slaTone: Tone = slaHealth >= 80 ? "emerald" : slaHealth >= 50 ? "amber" : "red";
  const stageTotal = Math.max(
    1,
    stages.scrutiny + stages.evc + stages.council + stages.decided,
  );

  const stageRows = [
    { label: "Scrutiny & deficiency", value: stages.scrutiny, color: "bg-[#6488a8]" },
    { label: "EVC inspection", value: stages.evc, color: "bg-brass-400" },
    { label: "Council review", value: stages.council, color: "bg-[#c4d3e0]" },
    { label: "Decided / closed", value: stages.decided, color: "bg-emerald-400" },
  ];

  const pathRows = (Object.keys(data.paths) as ProcessingPath[]).map((path) => ({
    path,
    label: PROCESSING_PATH_META[path].label,
    value: data.paths[path],
  }));

  const nearestNotice =
    deficiencies.nearestDays === null
      ? "No evidence windows open"
      : deficiencies.nearestDays < 0
        ? `Nearest notice overdue by ${Math.abs(deficiencies.nearestDays)} days`
        : `Nearest deadline in ${deficiencies.nearestDays} days`;

  return (
    <section className="wall-surface relative -mx-4 -mb-5 -mt-5 overflow-hidden border-y border-navy-800 text-white lg:-mx-6 xl:-mx-8">
      <div className="pointer-events-none absolute inset-0 wall-grid opacity-40" />
      <div className="pointer-events-none absolute -top-48 right-0 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(185,138,43,0.11),transparent_65%)]" />
      <div className="pointer-events-none absolute -bottom-56 left-1/4 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(52,83,116,0.28),transparent_70%)]" />

      <div className="relative border-b border-white/10 px-5 py-4 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-wider2 text-brass-300">
              <Radio size={10} />
              Live national operations · AICTE APH grid
            </div>
            <h1 className="mt-1.5 font-serif text-[30px] leading-none text-white sm:text-[34px]">
              National Command Wall
            </h1>
            <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-navy-300">
              Five regional grids, statutory clock pressure and the immutable audit chain in one
              operating picture.
              <span className="ml-1 text-navy-500">
                Aggregate telemetry · read-only · synced every 30 seconds.
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="border border-white/10 bg-white/[0.03] px-2.5 py-1.5">
              <div className="text-[8px] uppercase tracking-label text-navy-500">Ledger head</div>
              <div className="mt-0.5 font-mono text-[10px] text-emerald-300">
                {integrity.headHash ? truncateHash(integrity.headHash, 8, 6) : "genesis"}
              </div>
            </div>
            <div className="border border-white/10 bg-white/[0.03] px-2.5 py-1.5">
              <div className="text-[8px] uppercase tracking-label text-navy-500">Chain state</div>
              <div
                className={`mt-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-label ${
                  integrity.valid ? "text-emerald-300" : "text-red-300"
                }`}
              >
                {integrity.valid ? <ShieldCheck size={10} /> : <ShieldAlert size={10} />}
                {integrity.valid ? "Verified" : "Fault"} · {integrity.entries}
              </div>
            </div>
            <WallLive />
            <Link
              href="/"
              className="btn btn-xs border-white/20 bg-transparent text-white hover:bg-white/10"
            >
              Command centre <ArrowUpRight size={10} />
            </Link>
          </div>
        </div>
      </div>

      <div className="relative grid gap-3 px-5 py-5 lg:px-8 xl:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
        <section className="wall-panel flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
            <div>
              <div className="text-[8px] font-semibold uppercase tracking-label text-brass-300">
                India operations grid
              </div>
              <div className="mt-0.5 text-[10px] text-navy-400">
                Five regional grids · {data.activeCount} live filings
              </div>
            </div>
            <div className="flex items-center gap-2.5 text-[8px] font-medium uppercase tracking-label text-navy-500">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 bg-emerald-400" /> On track
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 bg-amber-400" /> Warning
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 bg-red-400" /> Breach
              </span>
            </div>
          </div>

          <div className="flex-1 px-3 pb-1 pt-3">
            <IndiaWallGrid rows={regions} totalActive={data.activeCount} />
          </div>

          <div className="grid grid-cols-3 gap-px border-t border-white/10 bg-white/10 text-center">
            <div className="bg-navy-950/80 px-2 py-2">
              <div className="font-mono text-[12px] font-semibold text-white">
                {inspections.geofenceVerified}/{inspections.total}
              </div>
              <div className="mt-0.5 text-[7px] uppercase tracking-label text-navy-500">
                Geofence verified
              </div>
            </div>
            <div className="bg-navy-950/80 px-2 py-2">
              <div
                className={`font-mono text-[12px] font-semibold ${
                  docs.expiring + docs.expired > 0 ? "text-amber-300" : "text-emerald-300"
                }`}
              >
                {docs.expiring + docs.expired}
              </div>
              <div className="mt-0.5 text-[7px] uppercase tracking-label text-navy-500">
                Documents at risk
              </div>
            </div>
            <div className="bg-navy-950/80 px-2 py-2">
              <div
                className={`font-mono text-[12px] font-semibold ${
                  escalations.penalty > 0 ? "text-red-300" : "text-emerald-300"
                }`}
              >
                {escalations.penalty}
              </div>
              <div className="mt-0.5 text-[7px] uppercase tracking-label text-navy-500">
                Penalty points live
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <WallStat
              label="Active filings"
              value={data.activeCount}
              detail={`${data.submissions} filings this cycle · ${data.approved} approved`}
              icon={<Layers size={12} />}
            />
            <WallStat
              label="SLA breaches"
              value={sla.BREACHED}
              tone={sla.BREACHED > 0 ? "red" : "emerald"}
              detail={`Oldest case ${data.oldestBreach} days in current stage`}
              icon={<Timer size={12} />}
            />
            <WallStat
              label="Open deficiencies"
              value={deficiencies.open}
              tone={deficiencies.open > 0 ? "red" : "emerald"}
              detail={nearestNotice}
              icon={<AlertTriangle size={12} />}
            />
            <WallStat
              label="APH conformity"
              value={`${rules.rate}%`}
              tone={conformityTone}
              detail={`${rules.passed} passed · ${rules.flagged} flagged controls`}
              icon={<Scale size={12} />}
            />
          </div>

          <section className="wall-panel flex flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
              <div>
                <div className="text-[8px] font-semibold uppercase tracking-label text-brass-300">
                  Conformity instruments
                </div>
                <div className="mt-0.5 text-[10px] text-navy-400">
                  National APH posture · cycle 2026–27
                </div>
              </div>
              <Gauge size={14} className="text-navy-500" />
            </div>

            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <Instrument
                label="APH conformity"
                value={rules.rate}
                caption={`${rules.total} persisted rule checks across every live filing.`}
                tone={conformityTone}
              />
              <Instrument
                label="SLA health"
                value={slaHealth}
                caption={`${sla.ON_TRACK} on track · ${sla.WARNING} warning · ${sla.BREACHED} breached.`}
                tone={slaTone}
              />
            </div>

            <div className="border-t border-white/10 px-4 py-3">
              <div className="flex items-center justify-between text-[8px] font-semibold uppercase tracking-label text-navy-500">
                <span>Statutory clock composition</span>
                <span className="font-mono normal-case tracking-normal">{sla.total} active</span>
              </div>
              <div className="bar-fill mt-1.5 flex h-2 w-full overflow-hidden bg-white/5">
                <span
                  className="bg-emerald-400"
                  style={{ width: `${(sla.ON_TRACK / Math.max(1, sla.total)) * 100}%` }}
                />
                <span
                  className="bg-amber-400"
                  style={{ width: `${(sla.WARNING / Math.max(1, sla.total)) * 100}%` }}
                />
                <span
                  className="bg-red-400"
                  style={{ width: `${(sla.BREACHED / Math.max(1, sla.total)) * 100}%` }}
                />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[9px]">
                <span className="flex items-center gap-1 text-navy-400">
                  <span className="h-1.5 w-1.5 bg-emerald-400" /> On track
                  <span className="ml-auto font-mono text-navy-200">{sla.ON_TRACK}</span>
                </span>
                <span className="flex items-center gap-1 text-navy-400">
                  <span className="h-1.5 w-1.5 bg-amber-400" /> Warning
                  <span className="ml-auto font-mono text-navy-200">{sla.WARNING}</span>
                </span>
                <span className="flex items-center gap-1 text-navy-400">
                  <span className="h-1.5 w-1.5 bg-red-400" /> Breached
                  <span className="ml-auto font-mono text-navy-200">{sla.BREACHED}</span>
                </span>
              </div>
            </div>

            <div className="grid divide-y divide-white/10 border-t border-white/10 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="px-4 py-3">
                <div className="flex items-center justify-between text-[8px] font-semibold uppercase tracking-label text-navy-500">
                  <span>Document register</span>
                  <span className="font-mono normal-case tracking-normal">
                    {docs.total} files · {docs.institutions} institutions
                  </span>
                </div>
                <div className="bar-fill mt-1.5 flex h-2 w-full overflow-hidden bg-white/5">
                  <span
                    className="bg-emerald-400"
                    style={{ width: `${(docs.valid / Math.max(1, docs.total)) * 100}%` }}
                  />
                  <span
                    className="bg-amber-400"
                    style={{ width: `${(docs.expiring / Math.max(1, docs.total)) * 100}%` }}
                  />
                  <span
                    className="bg-red-400"
                    style={{ width: `${(docs.expired / Math.max(1, docs.total)) * 100}%` }}
                  />
                  <span
                    className="bg-navy-400"
                    style={{ width: `${(docs.pending / Math.max(1, docs.total)) * 100}%` }}
                  />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[9px]">
                  <span className="flex items-center gap-1 text-navy-400">
                    <span className="h-1.5 w-1.5 bg-emerald-400" /> Valid
                    <span className="ml-auto font-mono text-navy-200">{docs.valid}</span>
                  </span>
                  <span className="flex items-center gap-1 text-navy-400">
                    <span className="h-1.5 w-1.5 bg-amber-400" /> Expiring
                    <span className="ml-auto font-mono text-navy-200">{docs.expiring}</span>
                  </span>
                  <span className="flex items-center gap-1 text-navy-400">
                    <span className="h-1.5 w-1.5 bg-red-400" /> Expired
                    <span className="ml-auto font-mono text-navy-200">{docs.expired}</span>
                  </span>
                  <span className="flex items-center gap-1 text-navy-400">
                    <span className="h-1.5 w-1.5 bg-navy-400" /> Pending
                    <span className="ml-auto font-mono text-navy-200">{docs.pending}</span>
                  </span>
                </div>
              </div>

              <div className="px-4 py-3">
                <div className="flex items-center justify-between text-[8px] font-semibold uppercase tracking-label text-navy-500">
                  <span>EVC field assurance</span>
                  <span className="font-mono normal-case tracking-normal">
                    {inspections.total} inspections
                  </span>
                </div>
                <div className="mt-2 space-y-1.5 text-[9px]">
                  <span className="flex items-center gap-1.5 text-navy-400">
                    <span className="h-1.5 w-1.5 bg-emerald-400" /> Reports filed
                    <span className="ml-auto font-mono text-navy-200">
                      {inspections.completed}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 text-navy-400">
                    <span className="h-1.5 w-1.5 bg-amber-400" /> Awaiting report
                    <span className="ml-auto font-mono text-navy-200">{inspections.pending}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-navy-400">
                    <span className="h-1.5 w-1.5 bg-red-400" /> Overdue
                    <span className="ml-auto font-mono text-navy-200">{inspections.overdue}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-navy-400">
                    <MapPin size={9} className="text-navy-500" /> Geofence locked
                    <span className="ml-auto font-mono text-navy-200">
                      {inspections.geofenceVerified}/{inspections.total}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 px-4 py-2 text-[9px] text-navy-400">
              <span className="flex items-center gap-1.5">
                <ShieldAlert size={10} className="text-red-300" />
                {escalations.open + escalations.acknowledged} live escalations
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={10} className="text-emerald-400" />
                {data.integrity.entries} ledger entries
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={10} className="text-navy-400" />
                {data.integrity.triggers.length} write guards armed
              </span>
            </div>

            <div className="mt-auto grid grid-cols-3 gap-px border-t border-white/10 bg-white/10 text-center">
              <div className="bg-navy-950/80 px-2 py-2">
                <div className="font-mono text-[13px] font-semibold text-white">
                  {fmtNumber(data.seatsUnderReview)}
                </div>
                <div className="mt-0.5 text-[7px] uppercase tracking-label text-navy-500">
                  Seats under review
                </div>
              </div>
              <div className="bg-navy-950/80 px-2 py-2">
                <div className="font-mono text-[13px] font-semibold text-white">
                  {data.institutionCount}
                </div>
                <div className="mt-0.5 text-[7px] uppercase tracking-label text-navy-500">
                  Institutions
                </div>
              </div>
              <div className="bg-navy-950/80 px-2 py-2">
                <div className="font-mono text-[13px] font-semibold text-white">
                  {data.stateCount}
                </div>
                <div className="mt-0.5 text-[7px] uppercase tracking-label text-navy-500">
                  States covered
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="relative grid gap-3 px-5 pb-5 lg:px-8 xl:grid-cols-12">
        <section className="wall-panel flex flex-col xl:col-span-5">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <div>
              <div className="text-[8px] font-semibold uppercase tracking-label text-brass-300">
                Statutory pipeline
              </div>
              <div className="mt-0.5 text-[10px] text-navy-400">
                {data.activeCount} active · {data.decidedCount} decided
              </div>
            </div>
            <Activity size={14} className="text-navy-500" />
          </div>

          <div className="p-4">
            <div className="bar-fill flex h-2.5 w-full overflow-hidden bg-white/5">
              {stageRows.map((row) => (
                <span
                  key={row.label}
                  className={row.color}
                  style={{ width: `${(row.value / stageTotal) * 100}%` }}
                />
              ))}
            </div>
            <div className="mt-3 space-y-1.5">
              {stageRows.map((row) => (
                <div key={row.label} className="flex items-center gap-2 text-[10px]">
                  <span className={`h-2 w-2 shrink-0 ${row.color}`} />
                  <span className="text-navy-300">{row.label}</span>
                  <span className="ml-auto font-mono text-white">{row.value}</span>
                  <span className="w-9 text-right font-mono text-[8px] text-navy-500">
                    {Math.round((row.value / stageTotal) * 100)}%
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-white/10 pt-3">
              <div className="flex items-center justify-between text-[8px] font-semibold uppercase tracking-label text-navy-500">
                <span>Processing path distribution</span>
                <span className="font-mono normal-case tracking-normal">
                  {data.activeCount} live
                </span>
              </div>
              <div className="mt-2 space-y-1.5">
                {pathRows.map((row, index) => (
                  <div key={row.path} className="flex items-center gap-2 text-[10px]">
                    <span className="w-[132px] shrink-0 truncate text-navy-400" title={row.label}>
                      {row.label}
                    </span>
                    <div className="h-1.5 flex-1 bg-white/5">
                      <span
                        className="bar-fill block h-full bg-brass-400"
                        style={{
                          width: `${(row.value / Math.max(1, data.activeCount)) * 100}%`,
                          animationDelay: `${index * 70}ms`,
                        }}
                      />
                    </div>
                    <span className="w-4 text-right font-mono text-white">{row.value}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[8px] leading-relaxed text-navy-500">
                Route resolved from application type and intake delta. EVC panels are mandatory on
                greenfield and EOA extension paths; enhanced intake routes to EVC plus SAC/SHC.
              </p>
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between border-t border-white/10 px-4 py-2 text-[9px] text-navy-500">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={10} className="text-emerald-400" />
              {data.approved} approvals · {data.decidedCount - data.approved} rejections
            </span>
            <Link
              href="/applications"
              className="inline-flex items-center gap-1 font-semibold uppercase tracking-label text-navy-300 transition hover:text-brass-200"
            >
              Register <ArrowUpRight size={9} />
            </Link>
          </div>
        </section>

        <section className="wall-panel flex flex-col xl:col-span-4">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <div>
              <div className="text-[8px] font-semibold uppercase tracking-label text-brass-300">
                Regional risk register
              </div>
              <div className="mt-0.5 text-[10px] text-navy-400">
                {escalations.open + escalations.acknowledged} live escalations
              </div>
            </div>
            <MapPin size={14} className="text-navy-500" />
          </div>

          <div className="flex-1">
            {regions.map((row) => {
              const meta = REGION_META[row.region as Region];
              const tone =
                row.breached > 0
                  ? "text-red-300"
                  : row.warning > 0
                    ? "text-amber-300"
                    : "text-emerald-300";
              return (
                <div
                  key={row.region}
                  className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-[7px] last:border-0"
                >
                  <span className="w-6 shrink-0 font-mono text-[8px] text-navy-500">
                    {meta.code}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 text-[10px]">
                      <span className="truncate text-navy-200">{meta.label}</span>
                      <span className="shrink-0 font-mono text-navy-400">{row.total} live</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      {row.dots.slice(0, 10).map((dot, index) => (
                        <span
                          key={index}
                          className={`h-1.5 w-1.5 ${
                            dot === "BREACHED"
                              ? "bg-red-400"
                              : dot === "WARNING"
                                ? "bg-amber-400"
                                : "bg-emerald-400"
                          }`}
                        />
                      ))}
                      {row.dots.length === 0 && (
                        <span className="text-[8px] text-navy-600">No active filings</span>
                      )}
                      <span className="ml-auto font-mono text-[8px] text-navy-500">
                        {row.penalty} pt
                      </span>
                    </div>
                  </div>
                  <div className={`w-8 shrink-0 text-right font-mono text-[11px] ${tone}`}>
                    {row.breached}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-white/10 px-4 py-2 text-[9px] text-navy-500">
            {escalations.penalty} penalty points live ·{" "}
            <span className="text-red-300">{sla.BREACHED} breach{sla.BREACHED === 1 ? "" : "es"}</span>{" "}
            past the 10-day clock
          </div>
        </section>

        <section className="wall-panel flex flex-col xl:col-span-3">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <div>
              <div className="text-[8px] font-semibold uppercase tracking-label text-brass-300">
                Immutable event stream
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-[10px] text-emerald-300">
                <ShieldCheck size={9} /> {integrity.valid ? "Chain verified" : "Integrity fault"}
              </div>
            </div>
            <Building2 size={14} className="text-navy-500" />
          </div>

          <div className="flex-1">
            {audit.slice(0, 5).map((entry) => (
              <div
                key={entry.sequence}
                className="border-b border-white/[0.06] px-3 py-[7px] last:border-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[8px] text-brass-300">
                    #{String(entry.sequence).padStart(4, "0")}
                  </span>
                  <span className="font-mono text-[8px] text-navy-500">
                    {fmtTime(entry.timestamp)}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[10px] text-navy-200">
                  {auditActionLabel(entry.action)}
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="text-[8px] uppercase tracking-label text-navy-600">
                    {roleCode(entry.role)}
                  </span>
                  <span className="truncate font-mono text-[8px] text-navy-500">
                    {truncateHash(entry.hashChecksum, 8, 5)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-auto border-t border-white/10 px-4 py-2">
            <Link
              href="/audit"
              className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-label text-navy-300 transition hover:text-brass-200"
            >
              Inspect ledger <ArrowUpRight size={9} />
            </Link>
          </div>
        </section>
      </div>

      <div className="relative flex items-center gap-3 border-t border-white/10 bg-[#06111d] py-2">
        <span className="flex shrink-0 items-center gap-1.5 border-r border-white/10 px-4 text-[8px] font-semibold uppercase tracking-wider2 text-brass-300">
          <Radio size={9} /> Ledger feed
        </span>
        <div className="wall-ticker-window relative flex-1 overflow-hidden">
          <div className="wall-ticker flex w-max items-center">
            {[0, 1].map((copy) => (
              <div
                key={copy}
                aria-hidden={copy === 1}
                className="flex shrink-0 items-center gap-6 pr-6"
              >
                {audit.slice(0, 10).map((entry) => (
                  <span key={`${copy}-${entry.sequence}`} className="flex items-center gap-2">
                    <span className="font-mono text-[8px] text-navy-600">
                      #{String(entry.sequence).padStart(4, "0")}
                    </span>
                    <span className="h-1 w-1 bg-brass-400/70" />
                    <span className="text-[9px] uppercase tracking-label text-navy-300">
                      {auditActionLabel(entry.action)}
                    </span>
                    <span className="font-mono text-[8px] text-navy-600">
                      {roleCode(entry.role)} · {fmtTime(entry.timestamp)} ·{" "}
                      {truncateHash(entry.hashChecksum, 4, 4)}
                    </span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
