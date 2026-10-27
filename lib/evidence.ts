import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { predict, type DocClassifierModel } from "./classifier-core";
import {
  EVIDENCE_FIELD_LABELS,
  EVIDENCE_TYPES,
  type ClassifierDriver,
  type EvidenceFieldKey,
  type EvidenceIntegrity,
  type EvidenceRow,
  type EvidenceType,
  type ExtractedField,
} from "./evidence-types";
import modelJson from "./model/doc-classifier.json";

const MODEL = modelJson as DocClassifierModel;

export const MAX_EVIDENCE_BYTES = 8 * 1024 * 1024;

const STORAGE_ROOT = path.join(process.cwd(), "storage", "evidence");

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function isPdf(bytes: Uint8Array): boolean {
  return (
    bytes.length > 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

export async function saveEvidenceFile(id: string, bytes: Uint8Array): Promise<string> {
  await fs.mkdir(STORAGE_ROOT, { recursive: true });
  const absolute = path.join(STORAGE_ROOT, `${id}.pdf`);
  await fs.writeFile(absolute, bytes);
  return path.relative(process.cwd(), absolute).split(path.sep).join("/");
}

function resolveStoragePath(storagePath: string): string {
  const absolute = path.resolve(process.cwd(), storagePath);
  if (!absolute.startsWith(path.resolve(STORAGE_ROOT) + path.sep)) {
    throw new Error("Evidence path escapes the storage root.");
  }
  return absolute;
}

export async function readEvidenceFile(storagePath: string): Promise<Buffer> {
  return fs.readFile(resolveStoragePath(storagePath));
}

export async function rehashStored(storagePath: string): Promise<string> {
  const bytes = await readEvidenceFile(storagePath);
  return sha256Hex(new Uint8Array(bytes));
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  // pdf.js transfers the underlying buffer, so hand it a copy.
  const pdf = await getDocumentProxy(bytes.slice());
  const { text } = (await extractText(pdf, { mergePages: true })) as { text: string | string[] };
  return Array.isArray(text) ? text.join("\n") : text;
}

function normalize(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

type RawField = {
  key: EvidenceFieldKey;
  value: string;
  confidence: number;
  snippet: string;
};

function snippetAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 32);
  const end = Math.min(text.length, index + length + 48);
  return `…${text.slice(start, end).trim()}…`;
}

function clampConfidence(value: number): number {
  return Number(Math.min(0.97, Math.max(0.2, value)).toFixed(2));
}

function toNumber(raw: string): number {
  return Number(raw.replace(/,/g, "").trim());
}

const MONTH_INDEX: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8,
  september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

function isoFromParts(year: string, month: number, day: string): string | null {
  const y = Number(year);
  const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(d) || d < 1 || d > 31) return null;
  return `${String(y).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseDate(raw: string): string | null {
  const value = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/.exec(value);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Textual dates are parsed as UTC so the calendar day never shifts with the
  // server timezone (IST would otherwise roll 31 March back to 30 March).
  const dayFirst = /^(\d{1,2})\s+([A-Za-z]{3,9}),?\s+(\d{4})$/.exec(value);
  if (dayFirst) {
    const month = MONTH_INDEX[dayFirst[2].toLowerCase()];
    if (month !== undefined) return isoFromParts(dayFirst[3], month, dayFirst[1]);
  }

  const monthFirst = /^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/.exec(value);
  if (monthFirst) {
    const month = MONTH_INDEX[monthFirst[1].toLowerCase()];
    if (month !== undefined) return isoFromParts(monthFirst[3], month, monthFirst[2]);
  }

  return null;
}

function cleanInstitution(raw: string): string {
  const cut = raw.split(
    /\s+(?:Land|Plot|Total|Built|Constructed|Covered|Faculty|Teaching|Intake|Lease|Tenure|Valid|Expiry|Address|Survey|Registration|Rent|Monthly)\b/i,
  )[0];
  return cut.replace(/[.,;:\s]+$/, "").slice(0, 90);
}

export function extractFields(rawText: string): ExtractedField[] {
  const text = normalize(rawText);
  const fields: RawField[] = [];

  const push = (
    key: EvidenceFieldKey,
    match: RegExpExecArray | null,
    value: string,
    base: number,
    plausible: boolean,
  ) => {
    if (!match || !value) return;
    const tight = value.length <= 24;
    const confidence = clampConfidence(base * (plausible ? 1 : 0.45) + (tight ? 0.04 : 0));
    fields.push({ key, value, confidence, snippet: snippetAround(text, match.index, match[0].length) });
  };

  const named = /(?:name\s+of\s+(?:the\s+)?(?:institution|institute)|institution\s+name|name\s+of\s+applicant)\s*[:\-–]\s*([A-Za-z0-9&.,'()\- ]{6,90})/i.exec(text);
  if (named) {
    push("institutionName", named, cleanInstitution(named[1]), 0.92, true);
  } else {
    const fallback = /([A-Z][A-Za-z&.'-]+(?:\s+[A-Z][A-Za-z&.'-]+){0,4}\s+(?:Institute|College|University|Academy)(?:\s+of\s+[A-Z][A-Za-z&.' -]{2,40})?)/.exec(text);
    if (fallback) push("institutionName", fallback, cleanInstitution(fallback[1]), 0.6, true);
  }

  const builtUp = /(?:built[\s-]?up\s+area|constructed\s+area|covered\s+area|total\s+built[\s-]?up\s+area)[^\d]{0,40}([\d][\d,]*(?:\.\d+)?)\s*(sq\.?\s*m(?:tr|et(?:er|re)s?)?|sqm|m2|m²|sq\.?\s*ft|sqft|square\s*feet)/i.exec(text);
  if (builtUp) {
    const raw = toNumber(builtUp[1]);
    const unit = builtUp[2].toLowerCase();
    const sqm = /ft|feet/.test(unit) ? raw * 0.09290304 : raw;
    const value = Math.round(sqm).toLocaleString("en-IN");
    push("builtUpAreaSqM", builtUp, value, 0.93, sqm >= 1000 && sqm <= 2_000_000);
  }

  const land = /(?:land\s+area|total\s+land|extent\s+of\s+land|plot\s+area)[^\d]{0,40}([\d][\d,]*(?:\.\d+)?)\s*(acres?|hectares?|ha)\b/i.exec(text);
  if (land) {
    const raw = toNumber(land[1]);
    const unit = land[2].toLowerCase();
    const acres = /hect|^ha$/.test(unit) ? raw * 2.4710538 : raw;
    push("landAcres", land, acres.toFixed(2), 0.93, acres >= 0.1 && acres <= 10_000);
  }

  const faculty = /(?:faculty|teaching\s+staff|teachers|trained\s+faculty)[^\d]{0,40}([\d][\d,]*)\b/i.exec(text);
  if (faculty) {
    const value = toNumber(faculty[1]);
    push("facultyCount", faculty, value.toLocaleString("en-IN"), 0.88, value >= 1 && value <= 20_000);
  }

  const intake = /(?:sanctioned\s+intake|approved\s+intake|admission\s+intake|annual\s+intake|total\s+intake|intake\s+of)\s*(?:of\s*)?([\d][\d,]*)\b/i.exec(text);
  if (intake) {
    const value = toNumber(intake[1]);
    push("intake", intake, value.toLocaleString("en-IN"), 0.9, value >= 1 && value <= 100_000);
  } else {
    const loose = /\bintake\b[^\d]{0,30}([\d][\d,]*)\b/i.exec(text);
    if (loose) {
      const value = toNumber(loose[1]);
      push("intake", loose, value.toLocaleString("en-IN"), 0.62, value >= 1 && value <= 100_000);
    }
  }

  const lease = /(?:lease|tenure|period\s+of\s+lease)[^.]{0,80}?(\d{1,3})\s*(?:years?|yrs?)/i.exec(text);
  if (lease) {
    const value = Number(lease[1]);
    push("leaseYears", lease, String(value), 0.9, value >= 5 && value <= 99);
  }

  const expiry = /(?:valid\s+(?:up\s+)?to|valid\s+(?:till|until)|expiry(?:\s+date)?|expires?\s+on|date\s+of\s+expiry)[^\d]{0,25}(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-z]{3,9},?\s+\d{4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i.exec(text);
  if (expiry) {
    const iso = parseDate(expiry[1]);
    if (iso) push("expiryDate", expiry, iso, 0.9, true);
  }

  const seen = new Set<EvidenceFieldKey>();
  return fields
    .filter((field) => {
      if (seen.has(field.key)) return false;
      seen.add(field.key);
      return true;
    })
    .sort((a, b) => EVIDENCE_FIELD_ORDER.indexOf(a.key) - EVIDENCE_FIELD_ORDER.indexOf(b.key))
    .map((field) => ({ ...field, label: EVIDENCE_FIELD_LABELS[field.key] }));
}

const EVIDENCE_FIELD_ORDER: EvidenceFieldKey[] = [
  "institutionName",
  "landAcres",
  "builtUpAreaSqM",
  "facultyCount",
  "intake",
  "leaseYears",
  "expiryDate",
];

export type ProcessedEvidence = {
  sha256: string;
  textChars: number;
  hasTextLayer: boolean;
  detectedType: EvidenceType;
  typeConfidence: number;
  fields: ExtractedField[];
  drivers: ClassifierDriver[];
  runnerUp: { type: string; probability: number } | null;
  note: string | null;
  extractedJson: string;
};

export async function processEvidencePdf(bytes: Uint8Array): Promise<ProcessedEvidence> {
  const sha256 = sha256Hex(bytes);
  let text = "";
  let extractionError: string | null = null;

  try {
    text = await extractPdfText(bytes);
  } catch (error) {
    extractionError = error instanceof Error ? error.message : "unknown parser error";
  }

  const hasTextLayer = text.replace(/\s+/g, "").length >= 60;
  const classification = predict(MODEL, text);
  const detectedType: EvidenceType = (EVIDENCE_TYPES as readonly string[]).includes(classification.type)
    ? (classification.type as EvidenceType)
    : "OTHER";

  const fields = hasTextLayer ? extractFields(text) : [];

  let note: string | null = null;
  if (!hasTextLayer) {
    note = extractionError
      ? `PDF text layer unreadable (${extractionError}). Attach a text-based copy or confirm the document type manually.`
      : "No text layer detected — scanned annexure. Confirm the document type manually before filing.";
  } else if (fields.length === 0) {
    note = "Text extracted but no statutory fields matched. Enter values manually.";
  }

  return {
    sha256,
    textChars: text.replace(/\s+/g, "").length,
    hasTextLayer,
    detectedType,
    typeConfidence: classification.confidence,
    fields,
    drivers: classification.drivers,
    runnerUp: classification.runnerUp,
    note,
    extractedJson: JSON.stringify({
      fields,
      note,
      drivers: classification.drivers,
      runnerUp: classification.runnerUp,
      classifier: MODEL.version,
    }),
  };
}

type EvidenceSource = {
  id: string;
  docType: string;
  detectedType: string;
  typeConfidence: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  textChars: number;
  hasTextLayer: boolean;
  integrity: string;
  referenceMatch: boolean | null;
  referenceOfId: string | null;
  verifyCount: number;
  lastVerifiedAt: Date | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  uploadedBy: string;
  uploadedRole: string;
  createdAt: Date;
  extracted: string;
};

export function toEvidenceRow(record: EvidenceSource): EvidenceRow {
  let fields: ExtractedField[] = [];
  let note: string | null = null;
  let drivers: ClassifierDriver[] = [];
  let runnerUp: { type: string; probability: number } | null = null;
  try {
    const parsed = JSON.parse(record.extracted) as {
      fields?: ExtractedField[];
      note?: string | null;
      drivers?: ClassifierDriver[];
      runnerUp?: { type: string; probability: number } | null;
    };
    fields = Array.isArray(parsed.fields) ? parsed.fields : [];
    note = parsed.note ?? null;
    drivers = Array.isArray(parsed.drivers)
      ? parsed.drivers.filter(
          (driver): driver is ClassifierDriver =>
            !!driver && typeof driver.token === "string" && typeof driver.weight === "number",
        )
      : [];
    runnerUp =
      parsed.runnerUp && typeof parsed.runnerUp.type === "string"
        ? parsed.runnerUp
        : null;
  } catch {
    fields = [];
  }

  const docType = (EVIDENCE_TYPES as readonly string[]).includes(record.docType)
    ? (record.docType as EvidenceType)
    : "OTHER";

  return {
    id: record.id,
    docType,
    detectedType: (EVIDENCE_TYPES as readonly string[]).includes(record.detectedType)
      ? (record.detectedType as EvidenceType)
      : "OTHER",
    typeConfidence: record.typeConfidence,
    fileName: record.fileName,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    sha256: record.sha256,
    textChars: record.textChars,
    hasTextLayer: record.hasTextLayer,
    integrity: (["UNVERIFIED", "VERIFIED", "TAMPERED"] as const).includes(
      record.integrity as EvidenceIntegrity,
    )
      ? (record.integrity as EvidenceIntegrity)
      : "UNVERIFIED",
    referenceMatch: record.referenceMatch,
    referenceOfId: record.referenceOfId,
    verifyCount: record.verifyCount,
    lastVerifiedAt: record.lastVerifiedAt ? record.lastVerifiedAt.toISOString() : null,
    uploadedBy: record.uploadedBy,
    uploadedRole: record.uploadedRole,
    createdAt: record.createdAt.toISOString(),
    fields,
    note,
    drivers,
    runnerUp,
    needsReview:
      !record.reviewedAt &&
      (!record.hasTextLayer || record.typeConfidence < 0.6 || docType === "OTHER"),
    reviewedBy: record.reviewedBy,
    reviewedAt: record.reviewedAt ? record.reviewedAt.toISOString() : null,
  };
}
