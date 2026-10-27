// Shared evidence types. Client-safe: no Node imports live here.

export const EVIDENCE_TYPES = [
  "LEASE_DEED",
  "FIRE_SAFETY",
  "BUILDING_PLAN",
  "UNDERTAKING",
  "OTHER",
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  LEASE_DEED: "Land Lease Deed",
  FIRE_SAFETY: "Fire Safety Certificate",
  BUILDING_PLAN: "Approved Building Plan",
  UNDERTAKING: "Statutory Undertaking",
  OTHER: "Unclassified evidence",
};

export function isEvidenceType(value: string | undefined | null): value is EvidenceType {
  return !!value && (EVIDENCE_TYPES as readonly string[]).includes(value);
}

export const EVIDENCE_FIELD_KEYS = [
  "institutionName",
  "landAcres",
  "builtUpAreaSqM",
  "facultyCount",
  "intake",
  "leaseYears",
  "expiryDate",
] as const;

export type EvidenceFieldKey = (typeof EVIDENCE_FIELD_KEYS)[number];

export const EVIDENCE_FIELD_LABELS: Record<EvidenceFieldKey, string> = {
  institutionName: "Institution name",
  landAcres: "Land area (acres)",
  builtUpAreaSqM: "Built-up area (sq m)",
  facultyCount: "Faculty count",
  intake: "Sanctioned intake",
  leaseYears: "Lease tenure (years)",
  expiryDate: "Expiry / validity date",
};

export type ExtractedField = {
  key: EvidenceFieldKey;
  label: string;
  value: string;
  confidence: number;
  snippet: string;
};

export type ExtractionResult = {
  fields: ExtractedField[];
  textChars: number;
  hasTextLayer: boolean;
  note: string | null;
};

export type EvidenceIntegrity = "UNVERIFIED" | "VERIFIED" | "TAMPERED";

export const EVIDENCE_INTEGRITY_META: Record<
  EvidenceIntegrity,
  { label: string; tone: string }
> = {
  UNVERIFIED: { label: "Awaiting recheck", tone: "border-slate-300 bg-slate-50 text-slate-700" },
  VERIFIED: { label: "Digest verified", tone: "border-emerald-300 bg-emerald-50 text-emerald-900" },
  TAMPERED: { label: "Digest mismatch", tone: "border-red-300 bg-red-50 text-red-900" },
};

export type EvidenceRow = {
  id: string;
  docType: EvidenceType;
  detectedType: EvidenceType;
  typeConfidence: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  textChars: number;
  hasTextLayer: boolean;
  integrity: EvidenceIntegrity;
  referenceMatch: boolean | null;
  referenceOfId: string | null;
  verifyCount: number;
  lastVerifiedAt: string | null;
  uploadedBy: string;
  uploadedRole: string;
  createdAt: string;
  fields: ExtractedField[];
  note: string | null;
  drivers: ClassifierDriver[];
  runnerUp: { type: string; probability: number } | null;
  needsReview: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
  geminiAudit?: {
    documentTypeDetected: string;
    confidence: number;
    institutionNamed: string | null;
    extractedFields: {
      institutionName?: string;
      landAcres?: number | null;
      builtUpAreaSqM?: number | null;
      facultyCount?: number | null;
      intake?: number | null;
      leaseYears?: number | null;
      expiryDate?: string | null;
      registrationOrRefNo?: string | null;
      issuingAuthority?: string | null;
    };
    forensicAudit: {
      authenticityScore: number;
      integrityRating: "VERIFIED" | "SUSPICIOUS" | "TAMPER_SUSPECTED";
      sealDetected: boolean;
      signatureDetected: boolean;
      dateConsistencyCheck: boolean;
      tamperFlags: string[];
      officialSummary: string;
    };
    aphComplianceRemarks: string;
  } | null;
};

export type TelemetryPayload = {
  serverTime: string;
  activeCases: number;
  breaches: number;
  openDeficiencies: number;
  openEscalations: number;
  evidenceFiles: number;
  evidenceVerified: number;
  evidenceTampered: number;
  ledgerEntries: number;
  ledgerValid: boolean;
  ledgerHead: string | null;
  recent: Array<{
    id: string;
    sequence: number;
    action: string;
    performedBy: string;
    detail: string | null;
    timestamp: string;
  }>;
};

export type ConsistencySeverity = "HIGH" | "MEDIUM" | "INFO";

export type ConsistencyFinding = {
  id: string;
  kind:
    | "DIGEST_REUSE"
    | "NAME_MISMATCH"
    | "PROFILE_CONFLICT"
    | "EXPIRY_CONFLICT"
    | "LAPSED_EVIDENCE"
    | "REGISTER_EXPIRED"
    | "MISSING_ANNEXURE";
  severity: ConsistencySeverity;
  title: string;
  detail: string;
  evidenceId: string | null;
  relatedInstitution: string | null;
};

export type ConsistencyReport = {
  annexures: number;
  checksRun: number;
  findings: ConsistencyFinding[];
  high: number;
  medium: number;
  info: number;
  generatedAt: string;
};

export type ClassifierDriver = {
  token: string;
  weight: number;
};

export type ClassifierExplanation = {
  type: EvidenceType;
  confidence: number;
  drivers: ClassifierDriver[];
  runnerUp: { type: string; probability: number } | null;
  needsReview: boolean;
};
