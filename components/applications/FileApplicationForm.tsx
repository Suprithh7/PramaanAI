"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FilePlus2,
  Loader2,
  Scale,
  Sparkles,
} from "lucide-react";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import {
  aphSummary,
  declarationToAphInput,
  evaluateAphRules,
} from "@/lib/aph";
import {
  APPLICATION_TYPE_LABELS,
  APPLICATION_TYPES,
  type ActionResult,
} from "@/lib/types";

type Values = {
  programName: string;
  applicationType: string;
  studentIntake: string;
  facultyCount: string;
  builtUpAreaSqM: string;
  totalLandAcres: string;
  leaseExpiry: string;
  fireExpiry: string;
  buildingExpiry: string;
  undertakingSignedOn: string;
  remarks: string;
};

const EMPTY: Values = {
  programName: "",
  applicationType: "",
  studentIntake: "",
  facultyCount: "",
  builtUpAreaSqM: "",
  totalLandAcres: "",
  leaseExpiry: "",
  fireExpiry: "",
  buildingExpiry: "",
  undertakingSignedOn: "",
  remarks: "",
};

function TextField({
  name,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  hint,
  required = true,
  min,
  max,
  step,
  wide,
}: {
  name: keyof Values;
  label: string;
  value: string;
  onChange: (name: keyof Values, value: string) => void;
  type?: "text" | "number" | "date";
  placeholder?: string;
  hint?: string;
  required?: boolean;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label htmlFor={`filing-${name}`} className="field-label">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </label>
      <input
        id={`filing-${name}`}
        name={name}
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        autoComplete="off"
        className="input"
      />
      {hint && <p className="mt-1 text-[9px] leading-snug text-slate-500">{hint}</p>}
    </div>
  );
}

export function FileApplicationForm({
  action,
  institutionName,
  series,
  regionLabel,
}: {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  institutionName: string;
  series: string;
  regionLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [values, setValues] = useState<Values>(EMPTY);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const update = (name: keyof Values, value: string) =>
    setValues((current) => ({ ...current, [name]: value }));

  const projection = useMemo(() => {
    const intake = Number(values.studentIntake);
    const faculty = Number(values.facultyCount);
    const builtUp = Number(values.builtUpAreaSqM);
    const land = Number(values.totalLandAcres);
    const complete =
      Number.isInteger(intake) &&
      intake > 0 &&
      Number.isInteger(faculty) &&
      faculty > 0 &&
      Number.isInteger(builtUp) &&
      builtUp > 0 &&
      Number.isFinite(land) &&
      land > 0 &&
      values.leaseExpiry !== "" &&
      values.fireExpiry !== "" &&
      values.buildingExpiry !== "" &&
      values.undertakingSignedOn !== "";
    if (!complete) return null;

    const rules = evaluateAphRules(
      declarationToAphInput(
        values.applicationType || "EOA_EXTENSION",
        {
          studentIntake: intake,
          facultyCount: faculty,
          builtUpAreaSqM: builtUp,
          totalLandAcres: land,
          leaseExpiry: values.leaseExpiry,
          fireExpiry: values.fireExpiry,
          buildingExpiry: values.buildingExpiry,
          undertakingSignedOn: values.undertakingSignedOn,
        },
        institutionName,
      ),
    );
    return { rules, summary: aphSummary(rules) };
  }, [values, institutionName]);

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="eyebrow">Institution portal · declared particulars</div>
            <h2 className="panel-title mt-0.5">Application and capacity declaration</h2>
          </div>
          <span className="badge border-slate-300 bg-slate-50 text-slate-600">
            10-day scrutiny clock
          </span>
        </div>

        <form
          action={formAction}
          className="p-4"
          onSubmit={(event) => {
            if (
              !window.confirm(
                `File this application for ${institutionName}? The declared figures will be evaluated against all APH rules, a scrutiny brief will be generated, and both will be written to the audit ledger.`,
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
            <span className="eyebrow">A · Application particulars</span>
            <span className="font-mono text-[9px] text-slate-400">{series}####</span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <TextField
              name="programName"
              label="Programme name"
              value={values.programName}
              onChange={update}
              placeholder="e.g. B.Tech — Computer Science & Engineering"
              wide
            />
            <div>
              <label htmlFor="filing-applicationType" className="field-label">
                Application type<span className="ml-0.5 text-red-600">*</span>
              </label>
              <select
                id="filing-applicationType"
                name="applicationType"
                required
                value={values.applicationType}
                onChange={(event) => update("applicationType", event.target.value)}
                className="select"
              >
                <option value="" disabled>
                  Select the statutory application type
                </option>
                {APPLICATION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {APPLICATION_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[9px] leading-snug text-slate-500">
                New Institute filings add the APH-107 land test.
              </p>
            </div>
          </div>

          <div className="mb-2 mt-4 flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
            <span className="eyebrow">B · Declared capacity</span>
            <span className="text-[9px] text-slate-500">Drives APH-101, APH-102 and APH-107</span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <TextField
              name="studentIntake"
              label="Declared student strength"
              type="number"
              value={values.studentIntake}
              onChange={update}
              placeholder="Students on the rolls after this approval"
              min={1}
              max={100000}
              step={1}
            />
            <TextField
              name="facultyCount"
              label="Full-time faculty"
              type="number"
              value={values.facultyCount}
              onChange={update}
              placeholder="Sanctioned full-time posts"
              min={1}
              max={20000}
              step={1}
            />
            <TextField
              name="builtUpAreaSqM"
              label="Built-up area (sqm)"
              type="number"
              value={values.builtUpAreaSqM}
              onChange={update}
              placeholder="Instructional and supporting area"
              min={1000}
              max={2000000}
              step={1}
            />
            <TextField
              name="totalLandAcres"
              label="Campus land (acres)"
              type="number"
              value={values.totalLandAcres}
              onChange={update}
              placeholder="Contiguous land held"
              min={0.1}
              max={10000}
              step="0.01"
            />
          </div>

          <div className="mb-2 mt-4 flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
            <span className="eyebrow">C · Statutory validity dates</span>
            <span className="text-[9px] text-slate-500">Drives APH-103 to APH-105</span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <TextField
              name="leaseExpiry"
              label="Lease expiry"
              type="date"
              value={values.leaseExpiry}
              onChange={update}
              hint="APH-103 requires at least 30 unexpired years."
            />
            <TextField
              name="fireExpiry"
              label="Fire safety certificate expiry"
              type="date"
              value={values.fireExpiry}
              onChange={update}
              hint="APH-104 requires a certificate in force on the scrutiny date."
            />
            <TextField
              name="buildingExpiry"
              label="Building plan valid until"
              type="date"
              value={values.buildingExpiry}
              onChange={update}
              hint="APH-105 requires a sanctioned plan covering the declared area."
            />
            <TextField
              name="undertakingSignedOn"
              label="Statutory undertaking signed on"
              type="date"
              value={values.undertakingSignedOn}
              onChange={update}
              max={today}
              hint="APH-106 requires a signed undertaking from the head of institution."
            />
          </div>

          <div className="mt-4 border-t border-slate-200 pt-3">
            <label htmlFor="filing-remarks" className="field-label">
              Covering note
            </label>
            <textarea
              id="filing-remarks"
              name="remarks"
              rows={3}
              maxLength={500}
              value={values.remarks}
              onChange={(event) => update("remarks", event.target.value)}
              placeholder="Optional context for the regional office — revised laboratory block, faculty recruitment drive, prior reference."
              className="textarea"
            />
            <p className="mt-1 text-[9px] leading-snug text-slate-500">
              Recorded against the filing. The filing event is appended to the audit ledger.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-start gap-2 border-t border-slate-200 pt-3">
            <button type="submit" disabled={pending} className="btn btn-primary">
              {pending ? <Loader2 size={11} className="animate-spin" /> : <FilePlus2 size={11} />}
              {pending ? "Filing and evaluating…" : "File application and evaluate"}
            </button>
            <ActionFeedback state={state} />
          </div>
        </form>
      </section>

      <aside className="space-y-4 xl:sticky xl:top-4">
        <section className="panel overflow-hidden">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Live APH projection</div>
              <h2 className="panel-title mt-0.5">Rules evaluated as declared</h2>
            </div>
            <span className="badge border-brass-300 bg-brass-50 text-brass-800">
              {projection ? `${projection.summary.passed}/${projection.summary.total}` : "Awaiting figures"}
            </span>
          </div>

          {projection ? (
            <>
              <div className="grid grid-cols-3 gap-px border-b border-slate-200 bg-slate-200">
                <div className="bg-white px-3 py-2">
                  <div className="label">Readiness</div>
                  <div className="mt-0.5 font-serif text-xl font-semibold leading-none text-navy-950">
                    {projection.summary.score}%
                  </div>
                </div>
                <div className="bg-white px-3 py-2">
                  <div className="label">Passed</div>
                  <div className="mt-0.5 font-serif text-xl font-semibold leading-none text-emerald-700">
                    {projection.summary.passed}
                  </div>
                </div>
                <div className="bg-white px-3 py-2">
                  <div className="label">Flagged</div>
                  <div
                    className={`mt-0.5 font-serif text-xl font-semibold leading-none ${
                      projection.summary.flagged > 0 ? "text-red-700" : "text-slate-400"
                    }`}
                  >
                    {projection.summary.flagged}
                  </div>
                </div>
              </div>
              <ul className="divide-y divide-slate-100">
                {projection.rules.map((rule) => {
                  const passed = rule.status === "PASSED";
                  return (
                    <li key={rule.ruleCode} className="px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[9px] font-semibold text-navy-900">
                          {rule.ruleCode}
                        </span>
                        <span
                          className={`badge ${
                            passed
                              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                              : "border-red-300 bg-red-50 text-red-900"
                          }`}
                        >
                          {passed ? <CheckCircle2 size={8} /> : <AlertTriangle size={8} />}
                          {passed ? "Pass" : "Flagged"}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[9px] font-medium text-navy-950">{rule.ruleName}</div>
                      <div className="mt-0.5 font-mono text-[8px] leading-snug text-slate-500">
                        {rule.submittedValue}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-slate-200 bg-slate-50/70 px-3 py-2 text-[8px] leading-relaxed text-slate-500">
                Projection uses the declared figures above. Filing persists this matrix against the
                case.
              </div>
            </>
          ) : (
            <div className="px-4 py-6">
              <div className="flex items-start gap-2">
                <Scale size={14} className="mt-0.5 text-slate-400" />
                <div>
                  <div className="text-[10px] font-semibold text-navy-900">No projection yet</div>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
                    Enter the declared capacity and all four statutory dates. The six core APH rules
                    evaluate instantly; APH-107 appears when New Institute is selected.
                  </p>
                </div>
              </div>
              <ul className="mt-3 space-y-1.5 text-[9px] text-slate-500">
                <li>· Faculty–student ratio (1:15 ceiling)</li>
                <li>· Built-up area per student (10 sqm floor)</li>
                <li>· Lease tenure (30 unexpired years)</li>
                <li>· Fire safety, building plan and undertaking validity</li>
              </ul>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">On filing</div>
              <h2 className="panel-title mt-0.5">What is generated immediately</h2>
            </div>
            <Sparkles size={13} className="text-brass-600" />
          </div>
          <ol className="space-y-2 px-4 py-3 text-[10px] leading-relaxed text-slate-600">
            <li>
              <span className="font-mono text-[9px] text-brass-700">{series}####</span> allocated in
              the {regionLabel} series.
            </li>
            <li>Declared declaration stored against the case in Submitted status.</li>
            <li>
              APH rule matrix evaluated and persisted from these figures — no separate officer run
              needed for the first result.
            </li>
            <li>
              A scrutiny brief is composed from the same matrix, citing the observed and threshold
              values.
            </li>
            <li>
              <span className="font-mono text-[9px] text-slate-700">APPLICATION_FILED</span> and{" "}
              <span className="font-mono text-[9px] text-slate-700">FILING_BRIEF_GENERATED</span>{" "}
              appended to the hash-chained ledger.
            </li>
          </ol>
        </section>
      </aside>
    </div>
  );
}
