"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, RotateCcw, ShieldAlert, ShieldCheck } from "lucide-react";
import { aphSummary, declarationToAphInput, evaluateAphRules } from "@/lib/aph";
import { APPLICATION_TYPE_LABELS, type ApplicationType } from "@/lib/types";

const PLAIN_RULE: Record<string, string> = {
  "APH-101": "At most one teacher for every 15 students.",
  "APH-102": "At least 10 sq m of building space for each student.",
  "APH-103": "The land lease must still have 30 years left.",
  "APH-104": "The fire safety certificate must be current.",
  "APH-105": "The building plan must be sanctioned and current.",
  "APH-106": "A signed undertaking must be on file.",
  "APH-107": "A new college needs at least 10 acres of land.",
};

type Preset = "passing" | "failing";

const PRESETS: Record<Preset, {
  intake: number;
  faculty: number;
  builtUp: number;
  land: number;
  leaseYears: number;
  fireMonths: number;
  buildingMonths: number;
}> = {
  passing: {
    intake: 300,
    faculty: 24,
    builtUp: 4200,
    land: 12.5,
    leaseYears: 45,
    fireMonths: 14,
    buildingMonths: 30,
  },
  failing: {
    intake: 900,
    faculty: 30,
    builtUp: 5000,
    land: 6.5,
    leaseYears: 12,
    fireMonths: -2,
    buildingMonths: 20,
  },
};

function addMonths(base: Date, months: number) {
  const date = new Date(base);
  date.setMonth(date.getMonth() + months);
  return date;
}

function Slider({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  suffix: string;
}) {
  return (
    <div>
      <div className="flex items-end justify-between gap-2">
        <label htmlFor={id} className="field-label mb-0">
          {label}
        </label>
        <output htmlFor={id} className="font-mono text-sm font-semibold text-navy-950">
          {value.toLocaleString("en-IN")}
          <span className="ml-1 text-xs font-normal text-slate-500">{suffix}</span>
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full accent-navy-800"
      />
      <div className="mt-0.5 flex justify-between font-mono text-2xs text-slate-400">
        <span>{min.toLocaleString("en-IN")}</span>
        <span>{max.toLocaleString("en-IN")}</span>
      </div>
    </div>
  );
}

export function PreCheckSimulator() {
  const [now] = useState(() => new Date());
  const [applicationType, setApplicationType] = useState<ApplicationType>("NEW_INSTITUTE");
  const [intake, setIntake] = useState(PRESETS.passing.intake);
  const [faculty, setFaculty] = useState(PRESETS.passing.faculty);
  const [builtUp, setBuiltUp] = useState(PRESETS.passing.builtUp);
  const [land, setLand] = useState(PRESETS.passing.land);
  const [leaseYears, setLeaseYears] = useState(PRESETS.passing.leaseYears);
  const [fireMonths, setFireMonths] = useState(PRESETS.passing.fireMonths);
  const [buildingMonths, setBuildingMonths] = useState(PRESETS.passing.buildingMonths);

  const applyPreset = (preset: Preset) => {
    const values = PRESETS[preset];
    setIntake(values.intake);
    setFaculty(values.faculty);
    setBuiltUp(values.builtUp);
    setLand(values.land);
    setLeaseYears(values.leaseYears);
    setFireMonths(values.fireMonths);
    setBuildingMonths(values.buildingMonths);
  };

  const results = useMemo(() => {
    const input = declarationToAphInput(
      applicationType,
      {
        studentIntake: intake,
        facultyCount: faculty,
        builtUpAreaSqM: builtUp,
        totalLandAcres: land,
        leaseExpiry: addMonths(now, Math.round(leaseYears * 12)),
        fireExpiry: addMonths(now, fireMonths),
        buildingExpiry: addMonths(now, buildingMonths),
        undertakingSignedOn: now,
      },
      "Your college",
      now,
    );
    return evaluateAphRules(input);
  }, [applicationType, intake, faculty, builtUp, land, leaseYears, fireMonths, buildingMonths, now]);

  const summary = aphSummary(results);
  const failing = results.filter((rule) => rule.status !== "PASSED");

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <section className="panel h-fit">
        <div className="panel-header">
          <div>
            <div className="eyebrow">Step 1 · move the numbers</div>
            <h2 className="panel-title mt-0.5">Your college, on paper</h2>
          </div>
          <RotateCcw size={16} className="text-slate-400" />
        </div>

        <div className="space-y-4 p-4">
          <div>
            <label htmlFor="application-type" className="field-label">
              What are you applying for?
            </label>
            <select
              id="application-type"
              value={applicationType}
              onChange={(event) => setApplicationType(event.target.value as ApplicationType)}
              className="select"
            >
              {(Object.keys(APPLICATION_TYPE_LABELS) as ApplicationType[]).map((key) => (
                <option key={key} value={key}>
                  {APPLICATION_TYPE_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <Slider
            id="intake"
            label="Students you want to admit"
            value={intake}
            onChange={setIntake}
            min={60}
            max={2000}
            step={20}
            suffix="students"
          />
          <Slider
            id="faculty"
            label="Full-time teachers"
            value={faculty}
            onChange={setFaculty}
            min={4}
            max={200}
            step={1}
            suffix="teachers"
          />
          <Slider
            id="built-up"
            label="Built-up area"
            value={builtUp}
            onChange={setBuiltUp}
            min={1000}
            max={40000}
            step={200}
            suffix="sq m"
          />
          <Slider
            id="land"
            label="Contiguous land"
            value={land}
            onChange={setLand}
            min={1}
            max={60}
            step={0.5}
            suffix="acres"
          />
          <Slider
            id="lease"
            label="Years left on the land lease"
            value={leaseYears}
            onChange={setLeaseYears}
            min={0}
            max={90}
            step={1}
            suffix="years"
          />
          <Slider
            id="fire"
            label="Fire certificate valid for"
            value={fireMonths}
            onChange={setFireMonths}
            min={-12}
            max={48}
            step={1}
            suffix="months"
          />
          <Slider
            id="building"
            label="Building plan valid for"
            value={buildingMonths}
            onChange={setBuildingMonths}
            min={-12}
            max={60}
            step={1}
            suffix="months"
          />

          <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
            <button type="button" onClick={() => applyPreset("passing")} className="btn btn-outline btn-xs">
              Load a strong college
            </button>
            <button type="button" onClick={() => applyPreset("failing")} className="btn btn-ghost btn-xs">
              Load a weak college
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Step 2 · the rules check themselves</div>
              <h2 className="panel-title mt-0.5">
                {summary.passed} of {summary.total} rules pass
              </h2>
            </div>
            <span
              className={`badge ${
                summary.flagged === 0
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-red-300 bg-red-50 text-red-900"
              }`}
            >
              {summary.flagged === 0 ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
              {summary.flagged === 0
                ? "Ready to submit"
                : `${summary.flagged} problem${summary.flagged === 1 ? "" : "s"} to fix`}
            </span>
          </div>

          <div className="p-4">
            <div className="h-2 w-full overflow-hidden bg-slate-200">
              <div
                className={`h-full transition-all duration-300 ${
                  summary.flagged === 0 ? "bg-emerald-600" : "bg-red-500"
                }`}
                style={{ width: `${summary.score}%` }}
              />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              {summary.flagged === 0
                ? "Every rule is satisfied. An officer still reviews the file, but nothing here will be auto-flagged."
                : `${failing
                    .map((rule) => rule.ruleName)
                    .join(", ")} ${failing.length === 1 ? "is" : "are"} failing. Fix these before filing, or the officer will send the file back as a deficiency notice.`}
            </p>
          </div>

          <ul className="divide-y divide-slate-100">
            {results.map((rule) => {
              const passed = rule.status === "PASSED";
              return (
                <li key={rule.ruleCode} className={`px-4 py-3 ${passed ? "" : "bg-red-50/40"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-2xs font-semibold text-slate-400">{rule.ruleCode}</span>
                        <span className="text-sm font-semibold text-navy-950">{rule.ruleName}</span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">{PLAIN_RULE[rule.ruleCode]}</p>
                      <p className="mt-1.5 font-mono text-2xs leading-relaxed text-slate-500">
                        {rule.submittedValue}
                      </p>
                      {!passed && (
                        <p className="mt-1.5 text-xs leading-relaxed text-red-800">{rule.remarks}</p>
                      )}
                    </div>
                    <span
                      className={`badge shrink-0 ${
                        passed
                          ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                          : "border-red-300 bg-red-50 text-red-900"
                      }`}
                    >
                      {passed ? <CheckCircle2 size={12} /> : <ShieldAlert size={12} />}
                      {passed ? "Pass" : "Fail"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="panel border-l-2 border-l-brass-500 p-4">
          <p className="text-xs leading-relaxed text-slate-600">
            <span className="font-semibold text-navy-900">Nothing here is a guess.</span> The same rule function runs
            when a college files an application and when an officer opens the case. These numbers are not saved —
            this page is a mirror of the real check.
          </p>
        </div>
      </section>
    </div>
  );
}
