"use client";

import { useEffect, useRef, useState, useActionState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Fingerprint,
  Loader2,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { applyExtractionAction, confirmEvidenceTypeAction, runGeminiEvidenceAuditAction, uploadEvidenceAction, verifyEvidenceAction } from "@/app/actions";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import { CopyButton } from "@/components/ui/CopyButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConsistencyPanel } from "@/components/case/ConsistencyPanel";
import { fmtDateTime, truncateHash } from "@/lib/format";
import {
  EVIDENCE_INTEGRITY_META,
  EVIDENCE_TYPES,
  EVIDENCE_TYPE_LABELS,
  type ConsistencyReport,
  type EvidenceIntegrity,
  type EvidenceRow,
  type EvidenceType,
  type ExtractedField,
} from "@/lib/evidence-types";
const APPLICABLE_FIELDS = new Set(["builtUpAreaSqM", "facultyCount", "intake", "landAcres"]);

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function confidenceTone(value: number): { text: string; bar: string } {
  if (value >= 0.85) return { text: "text-emerald-700", bar: "bg-emerald-600" };
  if (value >= 0.6) return { text: "text-brass-700", bar: "bg-brass-500" };
  return { text: "text-red-700", bar: "bg-red-500" };
}

function IntegrityBadge({ integrity }: { integrity: EvidenceIntegrity }) {
  const meta = EVIDENCE_INTEGRITY_META[integrity];
  return (
    <span className={`badge ${meta.tone}`}>
      {integrity === "VERIFIED" ? (
        <ShieldCheck size={9} />
      ) : integrity === "TAMPERED" ? (
        <AlertTriangle size={9} />
      ) : (
        <Fingerprint size={9} />
      )}
      {meta.label}
    </span>
  );
}

function VerifyButton({ evidenceId }: { evidenceId: string }) {
  const [state, formAction, pending] = useActionState(verifyEvidenceAction, null);
  return (
    <div className="flex flex-col items-start gap-1">
      <form action={formAction}>
        <input type="hidden" name="evidenceId" value={evidenceId} />
        <button type="submit" disabled={pending} className="btn btn-outline btn-xs">
          {pending ? <Loader2 size={9} className="animate-spin" /> : <ShieldCheck size={9} />}
          {pending ? "Rehashing…" : "Recheck digest"}
        </button>
      </form>
      {state && <ActionFeedback state={state} className="max-w-[280px]" />}
    </div>
  );
}

function GeminiAuditButton({ evidenceId }: { evidenceId: string }) {
  const [state, formAction, pending] = useActionState(runGeminiEvidenceAuditAction, null);
  return (
    <div className="flex flex-col items-start gap-1">
      <form action={formAction}>
        <input type="hidden" name="evidenceId" value={evidenceId} />
        <button
          type="submit"
          disabled={pending}
          className="btn btn-brass btn-xs inline-flex items-center gap-1"
          title="Run Gemini 3 Flash deep forensic scrutiny & tamper detection"
        >
          {pending ? <Loader2 size={9} className="animate-spin" /> : <Sparkles size={9} />}
          {pending ? "Auditing with Gemini…" : "Gemini AI audit"}
        </button>
      </form>
      {state && <ActionFeedback state={state} className="max-w-[320px]" />}
    </div>
  );
}

function ApplyButton({ evidenceId, disabled }: { evidenceId: string; disabled: boolean }) {
  const [state, formAction, pending] = useActionState(applyExtractionAction, null);
  return (
    <div className="flex flex-wrap items-start justify-end gap-2">
      <form
        action={formAction}
        onSubmit={(event) => {
          if (
            !window.confirm(
              "Overwrite the institution profile with the extracted numeric values and append an audit event?",
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="evidenceId" value={evidenceId} />
        <button type="submit" disabled={pending || disabled} className="btn btn-emerald btn-xs">
          {pending ? <Loader2 size={9} className="animate-spin" /> : <FileText size={9} />}
          {pending ? "Applying…" : "Apply fields to profile"}
        </button>
      </form>
      {state && <ActionFeedback state={state} className="max-w-[320px]" />}
    </div>
  );
}

function ConfirmType({ evidenceId, current }: { evidenceId: string; current: EvidenceType }) {
  const [state, formAction, pending] = useActionState(confirmEvidenceTypeAction, null);
  return (
    <form action={formAction} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="evidenceId" value={evidenceId} />
      <div>
        <label htmlFor={`confirm-type-${evidenceId}`} className="field-label">
          Officer-confirmed type
        </label>
        <select
          id={`confirm-type-${evidenceId}`}
          name="docType"
          className="select h-8 w-[196px]"
          defaultValue={current === "OTHER" ? "" : current}
        >
          <option value="" disabled>
            Select verified type
          </option>
          {EVIDENCE_TYPES.filter((type) => type !== "OTHER").map((type) => (
            <option key={type} value={type}>
              {EVIDENCE_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={pending} className="btn btn-primary btn-xs">
        {pending ? <Loader2 size={9} className="animate-spin" /> : <CheckCircle2 size={9} />}
        {pending ? "Recording…" : "Confirm type"}
      </button>
      {state && <ActionFeedback state={state} className="max-w-[320px]" />}
    </form>
  );
}

function FieldCell({ field }: { field: ExtractedField }) {
  const tone = confidenceTone(field.confidence);
  const percent = Math.round(field.confidence * 100);
  return (
    <div className="bg-white px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[8px] font-semibold uppercase tracking-label text-slate-500">
          {field.label}
        </span>
        <span className={`font-mono text-[8px] font-semibold ${tone.text}`}>{percent}%</span>
      </div>
      <div className="mt-1 font-mono text-[13px] font-semibold leading-tight text-navy-950">
        {field.value}
      </div>
      <div className="mt-1.5 h-1 w-full bg-slate-100" aria-hidden="true">
        <div className={`h-1 ${tone.bar}`} style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-1.5 truncate font-mono text-[8px] text-slate-400" title={field.snippet}>
        {field.snippet}
      </div>
    </div>
  );
}

export function EvidenceIntake({
  applicationId,
  referenceNo,
  rows,
  report,
  canUpload,
  canVerify,
  canApply,
}: {
  applicationId: string;
  referenceNo: string;
  rows: EvidenceRow[];
  report: ConsistencyReport;
  canUpload: boolean;
  canVerify: boolean;
  canApply: boolean;
}) {
  const [state, formAction, pending] = useActionState(uploadEvidenceAction, null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [docType, setDocType] = useState<"AUTO" | EvidenceType>("AUTO");
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.id ?? null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.ok) {
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [state]);

  useEffect(() => {
    setSelectedId(rows[0]?.id ?? null);
  }, [rows.length]);

  const stored = rows.length;
  const withText = rows.filter((row) => row.hasTextLayer).length;
  const verified = rows.filter((row) => row.integrity === "VERIFIED").length;
  const tampered = rows.filter((row) => row.integrity === "TAMPERED").length;
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0] ?? null;
  const canApplySelected =
    !!selected &&
    selected.hasTextLayer &&
    selected.fields.some((field) => APPLICABLE_FIELDS.has(field.key));

  function acceptFiles(list: FileList | null) {
    const next = list?.[0];
    if (!next) return;
    setFile(next);
  }

  return (
    <>
      {canUpload && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Annexure intake · {referenceNo}</div>
              <h2 className="panel-title mt-0.5">Upload statutory evidence</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge border-slate-300 bg-slate-50 text-slate-600">PDF · max 8 MB</span>
              <span className="font-mono text-[9px] text-slate-500">{stored} stored</span>
            </div>
          </div>
          <form action={formAction} className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_248px]">
            <input type="hidden" name="applicationId" value={applicationId} />
            <div
              role="button"
              tabIndex={0}
              aria-label="Choose a PDF annexure"
              onClick={() => inputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                if (inputRef.current && event.dataTransfer.files.length > 0) {
                  inputRef.current.files = event.dataTransfer.files;
                }
                acceptFiles(event.dataTransfer.files);
              }}
              className={`flex min-h-[136px] cursor-pointer flex-col items-center justify-center gap-1.5 border-2 border-dashed px-4 py-4 text-center outline-none transition ${
                dragging
                  ? "border-brass-500 bg-brass-50/60"
                  : file
                    ? "border-emerald-400 bg-emerald-50/40"
                    : "border-slate-300 bg-slate-50/60 hover:border-navy-400 hover:bg-navy-50/40 focus-visible:border-navy-500"
              }`}
            >
              {file ? (
                <FileText size={22} className="text-emerald-700" />
              ) : (
                <Upload size={22} className="text-slate-400" />
              )}
              {file ? (
                <>
                  <div className="max-w-full truncate text-[11px] font-semibold text-navy-950">
                    {file.name}
                  </div>
                  <div className="font-mono text-[9px] text-slate-500">
                    {formatBytes(file.size)} · ready for extraction
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[11px] font-semibold text-navy-900">
                    Drop a PDF annexure or click to browse
                  </div>
                  <div className="text-[9px] text-slate-500">
                    Lease deed · fire safety · building plan · undertaking
                  </div>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                name="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(event) => acceptFiles(event.target.files)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <div>
                <label htmlFor="evidence-doc-type" className="field-label">
                  Declared document type
                </label>
                <select
                  id="evidence-doc-type"
                  name="docType"
                  className="select"
                  value={docType}
                  onChange={(event) => setDocType(event.target.value as "AUTO" | EvidenceType)}
                >
                  <option value="AUTO">Auto-detect from text</option>
                  {EVIDENCE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {EVIDENCE_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn btn-primary" disabled={pending || !file}>
                {pending ? <Loader2 size={11} className="animate-spin" /> : <Fingerprint size={11} />}
                {pending ? "Extracting · hashing…" : "Ingest & hash annexure"}
              </button>
              <ActionFeedback state={state} />
            </div>
          </form>
        </section>
      )}

      <section className="panel overflow-hidden">
        <div className="panel-header">
          <div>
            <div className="eyebrow">Evidence register · digest referenced</div>
            <h2 className="panel-title mt-0.5">Stored annexures</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3 font-mono text-[9px] uppercase tracking-label text-slate-500">
            <span>{stored} stored</span>
            <span>{withText} text layer</span>
            <span className={verified > 0 ? "text-emerald-700" : undefined}>{verified} verified</span>
            {tampered > 0 && <span className="text-red-700">{tampered} mismatch</span>}
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No annexures stored for this case"
              description={
                canUpload
                  ? "Upload a PDF annexure to extract fields, classify the document and bind it to a SHA-256 digest."
                  : "The institution has not yet filed any PDF annexure against this case."
              }
              icon={<FileText size={16} />}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[860px]">
              <thead>
                <tr>
                  <th className="w-[252px]">Annexure</th>
                  <th className="w-[172px]">Classification</th>
                  <th className="w-[158px]">Integrity</th>
                  <th className="w-[176px]">SHA-256</th>
                  <th className="w-[78px]">Size</th>
                  <th className="w-[136px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="flex items-start gap-1.5">
                        <FileText size={12} className="mt-0.5 shrink-0 text-slate-400" />
                        <div className="min-w-0">
                          <div
                            className="truncate text-[10px] font-semibold text-navy-950"
                            title={row.fileName}
                          >
                            {row.fileName}
                          </div>
                          <div className="mt-0.5 truncate text-[8px] uppercase tracking-label text-slate-400">
                            {row.uploadedBy} · {fmtDateTime(row.createdAt)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="text-[9px] font-semibold text-navy-900">
                        {EVIDENCE_TYPE_LABELS[row.docType]}
                      </div>
                      <div className="mt-0.5 font-mono text-[8px] text-slate-500">
                        {row.detectedType.replaceAll("_", " ")} · {Math.round(row.typeConfidence * 100)}%
                      </div>
                      {row.referenceMatch !== null && (
                        <div
                          className={`mt-1 flex items-center gap-1 text-[8px] font-semibold uppercase tracking-label ${
                            row.referenceMatch ? "text-emerald-700" : "text-red-700"
                          }`}
                        >
                          {row.referenceMatch ? (
                            <CheckCircle2 size={8} />
                          ) : (
                            <AlertTriangle size={8} />
                          )}
                          {row.referenceMatch ? "Matches prior version" : "Differs from prior version"}
                        </div>
                      )}
                      {row.needsReview && (
                        <div className="mt-1 flex items-center gap-1 text-[8px] font-semibold uppercase tracking-label text-amber-700">
                          <AlertTriangle size={8} /> Review type
                        </div>
                      )}
                    </td>
                    <td>
                      <IntegrityBadge integrity={row.integrity} />
                      <div className="mt-1 font-mono text-[8px] text-slate-400">
                        {row.verifyCount} recheck{row.verifyCount === 1 ? "" : "s"}
                        {row.lastVerifiedAt ? ` · ${fmtDateTime(row.lastVerifiedAt)}` : ""}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <span className="hash" title={row.sha256}>
                          {truncateHash(row.sha256, 8, 6)}
                        </span>
                        <CopyButton value={row.sha256} label="" />
                      </div>
                      <div className="mt-1 font-mono text-[8px] text-slate-400">
                        {row.textChars} chars
                      </div>
                    </td>
                    <td className="num font-mono text-[9px] text-slate-600">
                      {formatBytes(row.sizeBytes)}
                    </td>
                    <td>
                      <div className="flex flex-col items-start gap-1.5">
                        <div className="flex flex-wrap items-center gap-1">
                          {canVerify && <VerifyButton evidenceId={row.id} />}
                          {canVerify && <GeminiAuditButton evidenceId={row.id} />}
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedId(row.id)}
                          aria-pressed={selected?.id === row.id}
                          className={`btn btn-xs ${
                            selected?.id === row.id ? "btn-primary" : "btn-outline"
                          }`}
                        >
                          <Fingerprint size={9} />
                          {row.fields.length} field{row.fields.length === 1 ? "" : "s"}
                          {row.geminiAudit && (
                            <span className="ml-1 inline-flex items-center gap-0.5 font-mono text-[8px] font-semibold text-brass-700">
                              <Sparkles size={7} /> {row.geminiAudit.forensicAudit.authenticityScore}%
                            </span>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConsistencyPanel
        report={report}
        availableIds={rows.map((row) => row.id)}
        onSelect={setSelectedId}
      />

      {selected && (
        <section className="panel overflow-hidden">
          <div className="panel-header">
            <div className="min-w-0">
              <div className="eyebrow">Field-level extraction · confidence scored</div>
              <h2 className="panel-title mt-0.5 truncate">{selected.fileName}</h2>
            </div>
            <div className="flex items-center gap-2">
              {canVerify && <GeminiAuditButton evidenceId={selected.id} />}
              {canApply && (
                <ApplyButton evidenceId={selected.id} disabled={!canApplySelected} />
              )}
            </div>
          </div>

          {selected.geminiAudit ? (
            <div className="border-b border-slate-200 bg-navy-950 p-4 text-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center border border-brass-400/40 bg-brass-500/20 text-brass-300">
                    <Sparkles size={13} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white">
                        Gemini 3 Flash Forensic Scrutiny
                      </span>
                      <span className="border border-brass-400/30 bg-brass-400/10 px-1.5 py-0.5 font-mono text-[8px] text-brass-300">
                        AICTE Norm Audit
                      </span>
                    </div>
                    <p className="mt-0.5 text-[9px] text-navy-300">
                      Class: {selected.geminiAudit.documentTypeDetected} · Institution:{" "}
                      {selected.geminiAudit.institutionNamed ?? "Applicant"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-[8px] uppercase tracking-wider text-navy-400">
                      Authenticity Score
                    </div>
                    <div
                      className={`font-serif text-lg font-bold leading-none ${
                        selected.geminiAudit.forensicAudit.authenticityScore >= 80
                          ? "text-emerald-400"
                          : "text-amber-400"
                      }`}
                    >
                      {selected.geminiAudit.forensicAudit.authenticityScore}/100
                    </div>
                  </div>
                  <span
                    className={`border px-2 py-1 text-[9px] font-semibold uppercase tracking-label ${
                      selected.geminiAudit.forensicAudit.integrityRating === "VERIFIED"
                        ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                        : selected.geminiAudit.forensicAudit.integrityRating === "TAMPER_SUSPECTED"
                          ? "border-red-400/40 bg-red-400/10 text-red-300"
                          : "border-amber-400/40 bg-amber-400/10 text-amber-300"
                    }`}
                  >
                    {selected.geminiAudit.forensicAudit.integrityRating}
                  </span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3 text-[10px]">
                <div className="border border-white/10 bg-white/[0.03] p-2">
                  <span className="block text-[8px] uppercase tracking-wider text-navy-400">
                    Authority Seal
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 font-medium text-white">
                    {selected.geminiAudit.forensicAudit.sealDetected ? (
                      <CheckCircle2 size={10} className="text-emerald-400" />
                    ) : (
                      <AlertTriangle size={10} className="text-amber-400" />
                    )}
                    {selected.geminiAudit.forensicAudit.sealDetected
                      ? "Competent Seal Identified"
                      : "No Competent Seal"}
                  </span>
                </div>
                <div className="border border-white/10 bg-white/[0.03] p-2">
                  <span className="block text-[8px] uppercase tracking-wider text-navy-400">
                    Signatory Verification
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 font-medium text-white">
                    {selected.geminiAudit.forensicAudit.signatureDetected ? (
                      <CheckCircle2 size={10} className="text-emerald-400" />
                    ) : (
                      <AlertTriangle size={10} className="text-amber-400" />
                    )}
                    {selected.geminiAudit.forensicAudit.signatureDetected
                      ? "Authorized Signature Present"
                      : "Missing Signatory"}
                  </span>
                </div>
                <div className="border border-white/10 bg-white/[0.03] p-2">
                  <span className="block text-[8px] uppercase tracking-wider text-navy-400">
                    Date &amp; Expiry Consistency
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 font-medium text-white">
                    {selected.geminiAudit.forensicAudit.dateConsistencyCheck ? (
                      <CheckCircle2 size={10} className="text-emerald-400" />
                    ) : (
                      <AlertTriangle size={10} className="text-amber-400" />
                    )}
                    {selected.geminiAudit.forensicAudit.dateConsistencyCheck
                      ? "Validity Dates Verified"
                      : "Date Anomaly Detected"}
                  </span>
                </div>
              </div>

              <div className="mt-2.5 border-t border-white/10 pt-2 text-[10px] leading-relaxed text-slate-200">
                <span className="mb-0.5 block text-[8px] font-semibold uppercase tracking-wider text-brass-300">
                  Forensic Scrutiny Finding:
                </span>
                {selected.geminiAudit.forensicAudit.officialSummary}
              </div>

              {selected.geminiAudit.forensicAudit.tamperFlags.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[9px] text-amber-300">
                  <span className="font-semibold uppercase tracking-label text-amber-400">
                    Tamper Indicators:
                  </span>
                  {selected.geminiAudit.forensicAudit.tamperFlags.map((flag, idx) => (
                    <span
                      key={idx}
                      className="border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5"
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              )}

              {selected.geminiAudit.aphComplianceRemarks && (
                <div className="mt-2 text-[9px] italic text-navy-300">
                  APH Note: {selected.geminiAudit.aphComplianceRemarks}
                </div>
              )}
            </div>
          ) : canVerify ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brass-300/40 bg-brass-50/60 px-4 py-2.5 text-[10px]">
              <div className="flex items-center gap-2 text-navy-950">
                <Sparkles size={12} className="text-brass-700" />
                <span>
                  Run <strong>Gemini Multi-Modal Forensic Scrutiny</strong> to verify issuing seals,
                  signatures, altered dates, and APH norm conformity.
                </span>
              </div>
              <GeminiAuditButton evidenceId={selected.id} />
            </div>
          ) : null}

          {!selected.needsReview && selected.reviewedAt && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-emerald-200 bg-emerald-50/60 px-4 py-2 text-[9px] text-emerald-900">
              <CheckCircle2 size={10} className="text-emerald-700" />
              <span className="font-semibold uppercase tracking-label text-emerald-800">
                Type confirmed
              </span>
              <span>
                {selected.reviewedBy} · filed as {EVIDENCE_TYPE_LABELS[selected.docType]}
              </span>
              <span className="font-mono text-[8px] text-emerald-700/70">
                {fmtDateTime(selected.reviewedAt)} IST
              </span>
            </div>
          )}

          {selected.needsReview && (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5">
              <div className="flex items-start gap-1.5 text-[9px] leading-relaxed text-amber-900">
                <AlertTriangle size={10} className="mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold uppercase tracking-label">Manual review required</span>
                  <span className="ml-1.5">
                    {selected.note ??
                      `Classifier confidence ${Math.round(selected.typeConfidence * 100)}% is below the 60% review floor.`}
                  </span>
                </div>
              </div>
              {canVerify ? (
                <ConfirmType evidenceId={selected.id} current={selected.docType} />
              ) : (
                <div className="mt-1 text-[8px] uppercase tracking-label text-amber-800/70">
                  Awaiting officer confirmation
                </div>
              )}
            </div>
          )}

          {(selected.drivers.length > 0 || selected.runnerUp) && (
            <div className="border-b border-slate-200 bg-slate-50/60 px-4 py-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px]">
                <span className="font-semibold uppercase tracking-label text-slate-500">Why this class</span>
                <span className="font-mono font-semibold text-navy-950">
                  {selected.detectedType.replaceAll("_", " ")} ·{" "}
                  {Math.round(selected.typeConfidence * 100)}%
                </span>
                {selected.runnerUp && (
                  <span className="text-slate-500">
                    next {selected.runnerUp.type.replaceAll("_", " ")} ·{" "}
                    {selected.runnerUp.probability >= 0.005
                      ? `${Math.round(selected.runnerUp.probability * 100)}%`
                      : "<1%"}
                  </span>
                )}
                {selected.drivers.length > 0 && (
                  <>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-500">signals</span>
                    {selected.drivers.map((driver) => (
                      <span
                        key={driver.token}
                        className="border border-slate-300 bg-white px-1 font-mono text-[8px] text-slate-700"
                      >
                        {driver.token.replaceAll("_", " ")}
                      </span>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {selected.fields.length === 0 ? (
            <div className="px-4 py-4 text-[10px] text-slate-600">
              {selected.note ?? "No statutory fields were matched in this annexure."}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-px bg-slate-200 sm:grid-cols-2 xl:grid-cols-3">
              {selected.fields.map((field) => (
                <FieldCell key={field.key} field={field} />
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-2 text-[9px] text-slate-500">
            <span className="font-mono uppercase tracking-label">
              {selected.hasTextLayer ? `${selected.textChars} text chars` : "No text layer"} ·{" "}
              {selected.verifyCount} digest recheck{selected.verifyCount === 1 ? "" : "s"}
            </span>
            <span className="font-mono text-[8px] text-slate-400">
              ref {truncateHash(selected.sha256, 12, 8)}
            </span>
          </div>
        </section>
      )}
    </>
  );
}
