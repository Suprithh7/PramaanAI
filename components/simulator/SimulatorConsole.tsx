"use client";

import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  FlaskConical,
  Gauge,
  Loader2,
  MapPin,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import {
  aphSummary,
  evaluateAphRules,
  type AphInput,
  type AphRuleResult,
} from "@/lib/aph";
import { fmtDecimal, fmtNumber } from "@/lib/format";
import {
  APPLICATION_TYPES,
  APPLICATION_TYPE_LABELS,
  DOC_STATUSES,
  DOC_STATUS_META,
  type ApplicationType,
  type DocStatus,
} from "@/lib/types";

export type SimSeed = {
  id: string;
  name: string;
  code: string;
  state: string;
  region: string;
  applicationType: string;
  totalLandAcres: number;
  builtUpAreaSqM: number;
  facultyCount: number;
  studentIntake: number;
  documents: Array<{ docType: string; status: string; expiryDate: string }>;
  baseline: { passed: number; flagged: number; status: string } | null;
};

type TwinState = {
  applicationType: ApplicationType;
  totalLandAcres: number;
  builtUpAreaSqM: number;
  facultyCount: number;
  studentIntake: number;
  leaseYears: number;
  leaseStatus: DocStatus;
  fireStatus: DocStatus;
  buildingStatus: DocStatus;
  undertakingStatus: DocStatus;
};

type Tone = "emerald" | "amber" | "red";

const TONE_TEXT: Record<Tone, string> = {
  emerald: "text-emerald-300",
  amber: "text-amber-300",
  red: "text-red-300",
};

const TONE_CHIP: Record<Tone, string> = {
  emerald: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  amber: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  red: "border-red-400/40 bg-red-400/10 text-red-200",
};

const TONE_RING: Record<Tone, string> = {
  emerald: "#34d399",
  amber: "#fbbf24",
  red: "#f87171",
};

const DAY_MS = 86_400_000;

const DEFAULT_STATE: TwinState = {
  applicationType: "INTAKE_EXPANSION",
  studentIntake: 1200,
  facultyCount: 63,
  builtUpAreaSqM: 13_200,
  totalLandAcres: 14,
  leaseYears: 34,
  leaseStatus: "VALID",
  fireStatus: "VALID",
  buildingStatus: "VALID",
  undertakingStatus: "VALID",
};

const CLEAR_STATE: TwinState = {
  applicationType: "NEW_INSTITUTE",
  studentIntake: 720,
  facultyCount: 52,
  builtUpAreaSqM: 8_200,
  totalLandAcres: 12.5,
  leaseYears: 38,
  leaseStatus: "VALID",
  fireStatus: "VALID",
  buildingStatus: "VALID",
  undertakingStatus: "VALID",
};

function isApplicationType(value: string): value is ApplicationType {
  return (APPLICATION_TYPES as readonly string[]).includes(value);
}

function isDocStatus(value: string): value is DocStatus {
  return (DOC_STATUSES as readonly string[]).includes(value);
}

function expiryFor(status: DocStatus, now: Date): Date {
  if (status === "EXPIRING_SOON") return new Date(now.getTime() + 21 * DAY_MS);
  if (status === "EXPIRED") return new Date(now.getTime() - 45 * DAY_MS);
  if (status === "PENDING_RENEWAL") return new Date(now.getTime() + 90 * DAY_MS);
  return new Date(now.getTime() + 300 * DAY_MS);
}

function buildInput(state: TwinState, now: Date): AphInput {
  return {
    applicationType: state.applicationType,
    institution: {
      name: "Digital twin",
      totalLandAcres: state.totalLandAcres,
      builtUpAreaSqM: state.builtUpAreaSqM,
      facultyCount: state.facultyCount,
      studentIntake: state.studentIntake,
    },
    documents: [
      {
        docType: "LEASE_DEED",
        status: state.leaseStatus,
        expiryDate: new Date(now.getTime() + state.leaseYears * 365.25 * DAY_MS),
      },
      {
        docType: "FIRE_SAFETY",
        status: state.fireStatus,
        expiryDate: expiryFor(state.fireStatus, now),
      },
      {
        docType: "BUILDING_PLAN",
        status: state.buildingStatus,
        expiryDate: expiryFor(state.buildingStatus, now),
      },
      {
        docType: "UNDERTAKING",
        status: state.undertakingStatus,
        expiryDate: new Date(now.getTime() + 365 * DAY_MS),
      },
    ],
    now,
  };
}

function seedToState(seed: SimSeed, now: Date): TwinState {
  const lease = seed.documents.find((doc) => doc.docType === "LEASE_DEED");
  const years = lease
    ? Math.max(0, (new Date(lease.expiryDate).getTime() - now.getTime()) / (365.25 * DAY_MS))
    : 0;
  const statusOf = (docType: string, fallback: DocStatus): DocStatus => {
    const doc = seed.documents.find((entry) => entry.docType === docType);
    return doc && isDocStatus(doc.status) ? doc.status : fallback;
  };

  return {
    applicationType: isApplicationType(seed.applicationType)
      ? seed.applicationType
      : "NEW_INSTITUTE",
    studentIntake: seed.studentIntake,
    facultyCount: seed.facultyCount,
    builtUpAreaSqM: seed.builtUpAreaSqM,
    totalLandAcres: seed.totalLandAcres,
    leaseYears: Math.round(years),
    leaseStatus: statusOf("LEASE_DEED", "PENDING_RENEWAL"),
    fireStatus: statusOf("FIRE_SAFETY", "PENDING_RENEWAL"),
    buildingStatus: statusOf("BUILDING_PLAN", "PENDING_RENEWAL"),
    undertakingStatus: statusOf("UNDERTAKING", "PENDING_RENEWAL"),
  };
}

function gapFor(rule: AphRuleResult, state: TwinState): string {
  switch (rule.ruleCode) {
    case "APH-101": {
      const required = Math.ceil(state.studentIntake / 15);
      const add = Math.max(0, required - state.facultyCount);
      return add > 0
        ? `Appoint ${add} more full-time faculty — ${required} required at this intake.`
        : "Reduce the requested intake or appoint additional faculty.";
    }
    case "APH-102": {
      const extra = Math.ceil(10 * state.studentIntake - state.builtUpAreaSqM);
      return extra > 0
        ? `Add ${fmtNumber(extra)} sqm of instructional and supporting built-up area.`
        : "File a revised architectural area statement.";
    }
    case "APH-103": {
      if (state.leaseStatus === "EXPIRED" || state.leaseStatus === "PENDING_RENEWAL") {
        return "Register a live lease deed before the scrutiny date.";
      }
      const shortfall = Math.ceil(Math.max(0, 30 - state.leaseYears));
      return shortfall > 0
        ? `Extend the lease by ${shortfall} year${shortfall === 1 ? "" : "s"} to reach 30 unexpired years.`
        : "Execute a registered lease extension.";
    }
    case "APH-104":
      return "Renew the fire safety certificate with the State Fire Department.";
    case "APH-105":
      return "File the sanctioned building plan revision covering the proposed programme.";
    case "APH-106":
      return "Upload a statutory undertaking signed by the head of institution.";
    case "APH-107":
      return `Acquire ${fmtDecimal(Math.max(0, 10 - state.totalLandAcres), 1)} more contiguous acres for the new campus.`;
    default:
      return rule.remarks;
  }
}

function RangeField({
  label,
  hint,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  return (
    <div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <label className="field-label mb-0">{label}</label>
          <div className="text-[8px] text-slate-400">{hint}</div>
        </div>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={Number.isInteger(value) ? value : value.toFixed(1)}
            min={min}
            max={max}
            step={step}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
            }}
            className="w-[68px] border border-slate-300 bg-white px-1.5 py-0.5 text-right font-mono text-[11px] font-semibold text-navy-950 outline-none focus:border-navy-500"
            aria-label={`${label} value`}
          />
          <span className="w-8 text-[8px] uppercase tracking-label text-slate-500">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        className="twin-range mt-0.5"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ "--fill": `${pct}%` } as CSSProperties}
        aria-label={label}
      />
      <div className="flex justify-between font-mono text-[8px] text-slate-400">
        <span>{fmtNumber(min)}</span>
        <span>{fmtNumber(max)}</span>
      </div>
    </div>
  );
}

function StatusField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: DocStatus;
  onChange: (value: DocStatus) => void;
}) {
  const tone =
    value === "VALID"
      ? "text-emerald-800"
      : value === "EXPIRING_SOON"
        ? "text-amber-800"
        : value === "EXPIRED"
          ? "text-red-800"
          : "text-slate-600";

  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <select
        className={`select ${tone}`}
        value={value}
        onChange={(event) => onChange(event.target.value as DocStatus)}
      >
        {DOC_STATUSES.map((status) => (
          <option key={status} value={status}>
            {DOC_STATUS_META[status].label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ScoreRing({
  score,
  passed,
  total,
  tone,
}: {
  score: number;
  passed: number;
  total: number;
  tone: Tone;
}) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100);

  return (
    <div className="relative h-[150px] w-[150px] shrink-0">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle
          cx="64"
          cy="64"
          r="60"
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
          strokeDasharray="1 4"
        />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="7"
        />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={TONE_RING[tone]}
          strokeWidth="7"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[7px] font-semibold uppercase tracking-wider2 text-navy-500">
          Readiness
        </span>
        <span className="mt-0.5 font-serif text-[38px] font-semibold leading-none tabular-nums text-white">
          {score}
          <span className="ml-0.5 text-[13px] font-normal text-navy-400">%</span>
        </span>
        <span className="mt-1 font-mono text-[8px] text-navy-500">
          {passed}/{total} clear
        </span>
      </div>
    </div>
  );
}

export function SimulatorConsole({ seeds, nowIso }: { seeds: SimSeed[]; nowIso: string }) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [state, setState] = useState<TwinState>(() => ({ ...DEFAULT_STATE }));
  const [seedId, setSeedId] = useState("");

  const seed = seeds.find((entry) => entry.id === seedId) ?? null;

  const { results, summary, ratio } = useMemo(() => {
    const evaluated = evaluateAphRules(buildInput(state, now));
    return {
      results: evaluated,
      summary: aphSummary(evaluated),
      ratio:
        state.facultyCount > 0
          ? state.studentIntake / state.facultyCount
          : Number.POSITIVE_INFINITY,
    };
  }, [state, now]);

  const flaggedRules = results.filter((rule) => rule.status === "DEFICIENCY_FLAGGED");
  const tone: Tone =
    summary.flagged === 0 ? "emerald" : summary.flagged <= 2 ? "amber" : "red";
  const verdict =
    summary.flagged === 0
      ? {
          title: "CLEARED TO FILE",
          copy: `All ${summary.total} APH controls pass. This profile can move to regional scrutiny without a deficiency notice.`,
        }
      : summary.flagged <= 2
        ? {
            title: "CONDITIONAL FILING",
            copy: `${summary.flagged} control${summary.flagged === 1 ? "" : "s"} flagged. Close the corrective brief below to avoid a formal deficiency notice.`,
          }
        : {
            title: "HIGH DEFICIENCY RISK",
            copy: `${summary.flagged} of ${summary.total} controls flagged. Filed unchanged, this profile is likely to receive a formal notice.`,
          };

  const ratioLabel = Number.isFinite(ratio) ? `1:${ratio.toFixed(2)}` : "—";
  const summaryLine = [
    `${fmtNumber(state.studentIntake)} seats`,
    `${fmtNumber(state.facultyCount)} faculty`,
    `${ratioLabel}`,
    `${fmtNumber(state.builtUpAreaSqM)} sqm`,
    `${fmtDecimal(state.totalLandAcres, 1)} acres`,
    `${state.leaseYears} yr lease`,
  ].join(" · ");

  const baseline = seed?.baseline ?? null;
  const baselineDelta = baseline ? baseline.flagged - summary.flagged : 0;

  const [aiAdvice, setAiAdvice] = useState<{ answer: string; citations: string[] } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  async function runAiOptimizationAdvice() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: `Analyze this proposed technical institution configuration for statutory compliance under AICTE Approval Process Handbook (APH 2026-27):
- Application Category: ${state.applicationType}
- Sanctioned Student Intake: ${state.studentIntake}
- Full-Time Faculty: ${state.facultyCount} (FSR 1:${Number.isFinite(ratio) ? ratio.toFixed(2) : "N/A"})
- Built-up Area: ${state.builtUpAreaSqM} sqm (${state.studentIntake > 0 ? (state.builtUpAreaSqM / state.studentIntake).toFixed(2) : "N/A"} sqm/student)
- Campus Land: ${state.totalLandAcres} acres
- Unexpired Land Lease: ${state.leaseYears} years (Status: ${state.leaseStatus})
- Fire Safety Certificate: ${state.fireStatus}
- Building Sanction Plan: ${state.buildingStatus}

Give an executive statutory review citing APH norm clauses and exact adjustments needed to achieve 100% compliance.`,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiAdvice({ answer: data.answer, citations: data.citations || [] });
      }
    } catch {
      //
    } finally {
      setAiLoading(false);
    }
  }

  function update(patch: Partial<TwinState>) {
    setState((previous) => ({ ...previous, ...patch }));
  }

  function loadSeed(id: string) {
    if (!id) {
      setState({ ...DEFAULT_STATE });
      setSeedId("");
      return;
    }
    const found = seeds.find((entry) => entry.id === id);
    if (!found) return;
    setState(seedToState(found, now));
    setSeedId(id);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[370px_minmax(0,1fr)]">
      <section className="panel flex flex-col self-start">
        <div className="panel-header">
          <div>
            <div className="eyebrow flex items-center gap-1">
              <SlidersHorizontal size={10} /> Regulatory Controls
            </div>
            <h2 className="panel-title mt-0.5">Institution parameters</h2>
          </div>
          <span className="badge border-slate-300 bg-slate-50 text-slate-600">Simulated Profile</span>
        </div>

        <div className="border-b border-slate-200 p-3">
          <label htmlFor="twin-seed" className="field-label">
            Load Registered AICTE Institution Baseline
          </label>
          <select
            id="twin-seed"
            className="select"
            value={seedId}
            onChange={(event) => loadSeed(event.target.value)}
          >
            <option value="">Custom simulated profile</option>
            {seeds.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.code} · {entry.name}
              </option>
            ))}
          </select>
          <p className="mt-1.5 flex items-start gap-1 text-[9px] leading-snug text-slate-500">
            {seed ? (
              <>
                <MapPin size={9} className="mt-[2px] shrink-0 text-slate-400" />
                {seed.region} · {seed.state} · {seed.documents.length} statutory document
                {seed.documents.length === 1 ? "" : "s"} loaded
              </>
            ) : (
              "Select an institution to load its verified capacity and documents, or adjust custom figures below."
            )}
          </p>
          {baseline && (
            <div className="mt-2 border border-slate-200 bg-slate-50 px-2 py-1.5">
              <div className="flex items-center justify-between text-[8px] uppercase tracking-label text-slate-500">
                <span>Persisted baseline</span>
                <span className="font-mono normal-case tracking-normal text-navy-800">
                  {baseline.passed}P / {baseline.flagged}F
                </span>
              </div>
              <div className="mt-0.5 text-[8px] uppercase tracking-label text-slate-400">
                Latest filing · {baseline.status.replaceAll("_", " ")}
              </div>
            </div>
          )}
        </div>

        <div className="border-b border-slate-200 bg-brass-50/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-navy-950 font-semibold text-[10px]">
              <Sparkles size={12} className="text-brass-700" />
              <span>Gemini AI Compliance Advisor</span>
            </div>
            <button
              type="button"
              disabled={aiLoading}
              onClick={runAiOptimizationAdvice}
              className="btn btn-brass btn-xs inline-flex items-center gap-1"
            >
              {aiLoading ? <Loader2 size={9} className="animate-spin" /> : <Sparkles size={9} />}
              {aiLoading ? "Consulting Gemini…" : "Analyze Compliance"}
            </button>
          </div>
          {aiAdvice && (
            <div className="mt-2.5 border border-brass-300 bg-white p-2.5 text-[10px] leading-relaxed text-navy-950">
              <div className="whitespace-pre-line text-slate-700">{aiAdvice.answer}</div>
              {aiAdvice.citations.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1 border-t border-slate-100 pt-1.5 text-[8px] text-slate-500">
                  <span className="font-semibold uppercase tracking-wider">Citations:</span>
                  {aiAdvice.citations.map((c, i) => (
                    <span key={i} className="border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono text-navy-800">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3.5 p-3">
          <div>
            <div className="field-label">Application class</div>
            <div className="grid grid-cols-3 gap-px border border-slate-300 bg-slate-300">
              {APPLICATION_TYPES.map((type) => {
                const active = state.applicationType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={active}
                    onClick={() => update({ applicationType: type })}
                    className={`px-1 py-2 text-[9px] font-semibold uppercase tracking-label transition ${
                      active
                        ? "bg-navy-900 text-white"
                        : "bg-white text-slate-600 hover:bg-navy-50 hover:text-navy-900"
                    }`}
                  >
                    {APPLICATION_TYPE_LABELS[type]}
                  </button>
                );
              })}
            </div>
          </div>

          <RangeField
            label="Sanctioned intake"
            hint="Students proposed for admission"
            value={state.studentIntake}
            min={60}
            max={6000}
            step={10}
            unit="seats"
            onChange={(studentIntake) => update({ studentIntake })}
          />
          <RangeField
            label="Full-time faculty"
            hint="Headcount on the institution register"
            value={state.facultyCount}
            min={5}
            max={600}
            step={1}
            unit="fac."
            onChange={(facultyCount) => update({ facultyCount })}
          />
          <RangeField
            label="Built-up area"
            hint="Instructional and supporting area"
            value={state.builtUpAreaSqM}
            min={1000}
            max={80_000}
            step={100}
            unit="sqm"
            onChange={(builtUpAreaSqM) => update({ builtUpAreaSqM })}
          />
          <RangeField
            label="Contiguous land"
            hint="Required for new institutes"
            value={state.totalLandAcres}
            min={1}
            max={60}
            step={0.1}
            unit="acres"
            onChange={(totalLandAcres) => update({ totalLandAcres })}
          />
          <RangeField
            label="Unexpired lease"
            hint="Registered lease tenure remaining"
            value={state.leaseYears}
            min={0}
            max={50}
            step={1}
            unit="yrs"
            onChange={(leaseYears) => update({ leaseYears })}
          />
        </div>

        <div className="border-t border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="field-label mb-0">Statutory evidence</span>
            <span className="text-[8px] uppercase tracking-label text-slate-400">
              Drives APH-103–106
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <StatusField
              label="Lease deed"
              value={state.leaseStatus}
              onChange={(leaseStatus) => update({ leaseStatus })}
            />
            <StatusField
              label="Fire safety"
              value={state.fireStatus}
              onChange={(fireStatus) => update({ fireStatus })}
            />
            <StatusField
              label="Building plan"
              value={state.buildingStatus}
              onChange={(buildingStatus) => update({ buildingStatus })}
            />
            <StatusField
              label="Undertaking"
              value={state.undertakingStatus}
              onChange={(undertakingStatus) => update({ undertakingStatus })}
            />
          </div>
        </div>

        <div className="mt-auto flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-3 py-2.5">
          <button type="button" onClick={() => loadSeed("")} className="btn btn-outline btn-xs">
            <RotateCcw size={10} /> Reset
          </button>
        </div>
      </section>

      <div className="space-y-4">
        <section className="relative overflow-hidden border border-navy-800 bg-navy-950 text-white shadow-panel">
          <div className="pointer-events-none absolute inset-0 wall-grid opacity-30" />
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(185,138,43,0.12),transparent_65%)]" />

          <div className="relative flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center border border-brass-400/40 bg-brass-400/10 text-brass-300">
                <FlaskConical size={12} />
              </span>
              <div>
                <div className="text-[8px] font-semibold uppercase tracking-wider2 text-brass-300">
                  APH digital twin
                </div>
                <div className="font-mono text-[8px] text-navy-500">
                  APH-2026-27 // REV 4.2.1
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[8px] uppercase tracking-label">
              <span className="text-navy-500">
                {seed ? `Source · ${seed.code}` : "Custom scenario"}
              </span>
              <span className="flex items-center gap-1 text-emerald-300">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                Engine live
              </span>
            </div>
          </div>

          <div className="relative flex flex-wrap items-center gap-5 border-b border-white/10 px-4 py-4">
            <ScoreRing score={summary.score} passed={summary.passed} total={summary.total} tone={tone} />
            <div className="min-w-[220px] flex-1">
              <div className="flex flex-wrap items-center gap-2 text-[8px] uppercase tracking-label text-navy-500">
                <span>{seed ? seed.name : "Digital twin"}</span>
                <span className="text-navy-700">/</span>
                <span>{APPLICATION_TYPE_LABELS[state.applicationType]}</span>
              </div>
              <div className={`mt-1 font-serif text-[23px] font-semibold leading-tight ${TONE_TEXT[tone]}`}>
                {verdict.title}
              </div>
              <p className="mt-1 max-w-xl text-[10px] leading-relaxed text-navy-300">
                {verdict.copy}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className={`inline-flex items-center gap-1 border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-label ${TONE_CHIP.emerald}`}>
                  <CheckCircle2 size={8} /> {summary.passed} passed
                </span>
                <span className={`inline-flex items-center gap-1 border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-label ${summary.flagged > 0 ? TONE_CHIP.red : "border-white/10 bg-white/[0.03] text-navy-400"}`}>
                  <AlertTriangle size={8} /> {summary.flagged} flagged
                </span>
                <span className="inline-flex items-center gap-1 border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-label text-navy-300">
                  <Gauge size={8} /> {summary.total} controls
                </span>
                <span className="inline-flex items-center gap-1 border border-brass-400/30 bg-brass-400/10 px-1.5 py-0.5 font-mono text-[8px] font-semibold text-brass-200">
                  {ratioLabel}
                </span>
              </div>
              <div className="mt-2 font-mono text-[8px] uppercase tracking-label text-navy-500">
                {summaryLine}
              </div>
              {baseline && (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[9px]">
                  <span className="text-navy-400">
                    Persisted baseline · latest filing{" "}
                    <span className="font-mono text-navy-200">
                      {baseline.passed}P / {baseline.flagged}F
                    </span>
                  </span>
                  <span
                    className={`flex items-center gap-1 font-semibold uppercase tracking-label ${
                      baselineDelta > 0
                        ? "text-emerald-300"
                        : baselineDelta < 0
                          ? "text-red-300"
                          : "text-navy-300"
                    }`}
                  >
                    <BadgeCheck size={9} />
                    {baselineDelta > 0
                      ? `Twin clears ${baselineDelta}`
                      : baselineDelta < 0
                        ? `Twin adds ${Math.abs(baselineDelta)}`
                        : "Twin matches baseline"}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="relative border-b border-white/10 px-4 py-2">
            <div className="flex items-center justify-between text-[8px] font-semibold uppercase tracking-label text-navy-500">
              <span>APH control matrix</span>
              <span className="font-mono normal-case tracking-normal">
                {summary.total} checks executed
              </span>
            </div>
          </div>

          <div className="relative divide-y divide-white/[0.06]">
            {results.map((rule) => {
              const flagged = rule.status === "DEFICIENCY_FLAGGED";
              return (
                <div
                  key={rule.ruleCode}
                  className={`grid grid-cols-[66px_minmax(0,1fr)] gap-3 px-4 py-2.5 ${
                    flagged ? "bg-red-500/[0.055]" : ""
                  }`}
                >
                  <div>
                    <div
                      className={`font-mono text-[9px] font-semibold ${
                        flagged ? "text-red-300" : "text-brass-300"
                      }`}
                    >
                      {rule.ruleCode}
                    </div>
                    <div
                      className={`mt-1 inline-flex items-center gap-1 text-[7px] font-semibold uppercase tracking-label ${
                        flagged ? "text-red-300" : "text-emerald-300"
                      }`}
                    >
                      {flagged ? <XCircle size={8} /> : <CheckCircle2 size={8} />}
                      {flagged ? "Flag" : "Pass"}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-[11px] font-semibold text-white">{rule.ruleName}</span>
                      <span className="font-mono text-[8px] text-navy-500">
                        {rule.requiredValue}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[9px] leading-snug text-navy-300">
                      {rule.submittedValue}
                    </div>
                    {flagged && (
                      <div className="mt-1 flex items-start gap-1 text-[9px] leading-snug text-amber-200">
                        <ArrowRight size={9} className="mt-[2px] shrink-0" />
                        <span>{gapFor(rule, state)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Corrective brief · generated from the twin</div>
              <h2 className="panel-title mt-0.5">What must change before filing</h2>
            </div>
            <span
              className={`badge ${
                flaggedRules.length > 0
                  ? "border-red-300 bg-red-50 text-red-900"
                  : "border-emerald-300 bg-emerald-50 text-emerald-900"
              }`}
            >
              {flaggedRules.length > 0
                ? `${flaggedRules.length} corrective action${flaggedRules.length === 1 ? "" : "s"}`
                : "No action required"}
            </span>
          </div>

          {flaggedRules.length === 0 ? (
            <div className="flex items-start gap-3 p-4">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-700" />
              <div>
                <div className="text-xs font-semibold text-emerald-900">
                  Digital twin clears every APH control
                </div>
                <p className="mt-1 max-w-2xl text-[10px] leading-relaxed text-slate-600">
                  The same checks will pass at the scrutiny desk for this profile. Keep the
                  statutory evidence current through the filing window — a certificate that lapses
                  before scrutiny re-opens the deficiency.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-px bg-slate-200 sm:grid-cols-2 xl:grid-cols-3">
              {flaggedRules.map((rule) => (
                <div key={rule.ruleCode} className="bg-white p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] font-semibold text-red-700">
                      {rule.ruleCode}
                    </span>
                    <span className="badge border-red-200 bg-red-50 text-[8px] text-red-800">
                      Gap
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] font-semibold text-navy-950">
                    {rule.ruleName}
                  </div>
                  <div className="mt-1.5 border-l-2 border-red-400 bg-red-50/60 px-2 py-1.5 text-[10px] font-medium leading-snug text-red-900">
                    {gapFor(rule, state)}
                  </div>
                  <div className="mt-1.5 text-[9px] leading-snug text-slate-600">
                    {rule.remarks}
                  </div>
                  <div className="mt-1.5 text-[8px] uppercase tracking-label text-slate-400">
                    Source · {rule.source}
                  </div>
                </div>
              ))}
            </div>
          )}

          {flaggedRules.length > 0 && (
            <div className="border-t border-navy-800 bg-navy-950 px-4 py-4 text-white">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border border-red-400/40 bg-red-500/10 text-red-300">
                    <AlertTriangle size={13} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[8px] font-semibold uppercase tracking-label text-brass-300">
                      If filed unchanged
                    </div>
                    <div className="mt-1 text-[13px] font-semibold leading-snug">
                      Formal deficiency notice under APH 2026–27
                    </div>
                    <p className="mt-1 max-w-xl text-[10px] leading-relaxed text-navy-400">
                      The scrutiny desk raises a deficiency ticket against{" "}
                      {flaggedRules.length} control{flaggedRules.length === 1 ? "" : "s"}, opens an
                      10-day evidence window, and the file returns as RE_SCRUTINY. The transition is
                      sealed in the SHA-256 ledger.
                    </p>
                  </div>
                </div>
                <div className="grid shrink-0 grid-cols-3 gap-px bg-white/10 text-center">
                  <div className="bg-navy-950 px-3 py-2">
                    <div className="font-mono text-[13px] font-semibold text-red-300">10 d</div>
                    <div className="mt-0.5 text-[7px] uppercase tracking-label text-navy-500">
                      Evidence window
                    </div>
                  </div>
                  <div className="bg-navy-950 px-3 py-2">
                    <div className="font-mono text-[13px] font-semibold text-amber-300">
                      RE_SCRUTINY
                    </div>
                    <div className="mt-0.5 text-[7px] uppercase tracking-label text-navy-500">
                      Return route
                    </div>
                  </div>
                  <div className="bg-navy-950 px-3 py-2">
                    <div className="font-mono text-[13px] font-semibold text-white">
                      {flaggedRules.length}
                    </div>
                    <div className="mt-0.5 text-[7px] uppercase tracking-label text-navy-500">
                      Linked controls
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-2 text-[9px] text-slate-500">
            <span>
              Simulation only · no application, document or ledger row is created.
            </span>
            <Link
              href="/wall"
              className="inline-flex items-center gap-1 font-semibold uppercase tracking-label text-navy-700 hover:text-navy-900"
            >
              Open national wall <ArrowRight size={9} />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
