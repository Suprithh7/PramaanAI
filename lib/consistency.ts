import { prisma } from "./db";
import { toEvidenceRow } from "./evidence";
import { fmtDate, truncateHash } from "./format";
import {
  EVIDENCE_FIELD_LABELS,
  EVIDENCE_TYPE_LABELS,
  type ConsistencyFinding,
  type ConsistencyReport,
  type EvidenceFieldKey,
  type EvidenceRow,
  type EvidenceType,
  type ExtractedField,
} from "./evidence-types";

const MANDATORY_TYPES: EvidenceType[] = ["LEASE_DEED", "FIRE_SAFETY", "BUILDING_PLAN", "UNDERTAKING"];

const FIELD_PROFILE: Partial<Record<EvidenceFieldKey, "totalLandAcres" | "builtUpAreaSqM" | "facultyCount" | "studentIntake">> = {
  landAcres: "totalLandAcres",
  builtUpAreaSqM: "builtUpAreaSqM",
  facultyCount: "facultyCount",
  intake: "studentIntake",
};

const GENERIC_NAME_TOKENS = new Set([
  "institute", "institution", "college", "university", "academy",
  "technology", "technological", "technical", "engineering", "sciences", "science",
  "management", "studies", "education", "educational", "national", "indian",
]);

function significantTokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 4 && !GENERIC_NAME_TOKENS.has(word)),
  );
}

function namedInstitutionDisagrees(documentName: string, institutionName: string): boolean {
  const doc = significantTokens(documentName);
  const owner = significantTokens(institutionName);
  if (doc.size === 0 || owner.size === 0) return false;
  for (const token of doc) {
    if (owner.has(token)) return false;
  }
  return true;
}

function parseNumeric(value: string): number | null {
  const numeric = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function latestBy(
  rows: EvidenceRow[],
  key: (row: EvidenceRow) => string | null,
): Map<string, EvidenceRow> {
  const map = new Map<string, EvidenceRow>();
  for (const row of rows) {
    const value = key(row);
    if (!value || map.has(value)) continue;
    map.set(value, row);
  }
  return map;
}

function expiryTimestamp(field: ExtractedField | undefined): number | null {
  if (!field) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(field.value) ? field.value : null;
  if (!iso) return null;
  const stamp = Date.parse(`${iso}T00:00:00Z`);
  return Number.isFinite(stamp) ? stamp : null;
}

function daysBetween(fromMs: number, toMs: number): number {
  return Math.floor(Math.abs(toMs - fromMs) / 86_400_000);
}

const severityRank: Record<ConsistencyFinding["severity"], number> = { HIGH: 0, MEDIUM: 1, INFO: 2 };

export async function getConsistencyReport(institutionId: string): Promise<ConsistencyReport> {
  const [institution, evidence, documents] = await Promise.all([
    prisma.institution.findUnique({ where: { id: institutionId } }),
    prisma.evidenceFile.findMany({
      where: { institutionId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.complianceDocument.findMany({ where: { institutionId } }),
  ]);

  const rows = evidence.map(toEvidenceRow);
  const findings: ConsistencyFinding[] = [];
  const now = Date.now();

  if (!institution) {
    return {
      annexures: 0,
      checksRun: 0,
      findings,
      high: 0,
      medium: 0,
      info: 0,
      generatedAt: new Date(now).toISOString(),
    };
  }

  const digests = [...new Set(rows.map((row) => row.sha256))];
  const reuse = digests.length
    ? await prisma.evidenceFile.findMany({
        where: { sha256: { in: digests }, institutionId: { not: institutionId } },
        select: {
          sha256: true,
          fileName: true,
          institution: { select: { name: true } },
        },
      })
    : [];

  for (const digest of digests) {
    const matches = reuse.filter((entry) => entry.sha256 === digest);
    if (matches.length === 0) continue;
    const own = rows.find((row) => row.sha256 === digest);
    const references = [
      ...new Set(matches.map((entry) => `${entry.fileName} · ${entry.institution.name}`)),
    ];
    findings.push({
      id: `DIGEST_REUSE:${own?.id ?? digest}`,
      kind: "DIGEST_REUSE",
      severity: "HIGH",
      title: "Annexure reused across institutions",
      detail: `SHA-256 ${truncateHash(digest, 10, 6)} is byte-identical to ${references.join("; ")}.`,
      evidenceId: own?.id ?? null,
      relatedInstitution: [...new Set(matches.map((entry) => entry.institution.name))].join(", "),
    });
  }

  const latestPerDocType = latestBy(rows, (row) => row.docType);
  const seenFields = new Set<EvidenceFieldKey>();

  for (const row of rows) {
    const nameField = row.fields.find((field) => field.key === "institutionName");
    if (nameField && namedInstitutionDisagrees(nameField.value, institution.name)) {
      findings.push({
        id: `NAME_MISMATCH:${row.id}`,
        kind: "NAME_MISMATCH",
        severity: "HIGH",
        title: "Annexure names a different institution",
        detail: `${row.fileName} names “${nameField.value}” but is filed under ${institution.name}.`,
        evidenceId: row.id,
        relatedInstitution: null,
      });
    }

    for (const field of row.fields) {
      const profileKey = FIELD_PROFILE[field.key];
      if (!profileKey || seenFields.has(field.key)) continue;
      const extracted = parseNumeric(field.value);
      const profileValue = institution[profileKey];
      if (extracted === null) continue;
      seenFields.add(field.key);
      const delta = Math.abs(extracted - profileValue);
      const tolerance = field.key === "landAcres" ? 0.05 : Math.max(1, profileValue * 0.01);
      if (delta <= tolerance) continue;
      const formattedProfile =
        field.key === "landAcres"
          ? profileValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : profileValue.toLocaleString("en-IN");
      findings.push({
        id: `PROFILE_CONFLICT:${row.id}:${field.key}`,
        kind: "PROFILE_CONFLICT",
        severity: "MEDIUM",
        title: `${EVIDENCE_FIELD_LABELS[field.key]} conflicts with the statutory profile`,
        detail: `${row.fileName} states ${field.value} · institution profile holds ${formattedProfile}.`,
        evidenceId: row.id,
        relatedInstitution: null,
      });
    }
  }

  for (const document of documents) {
    const docType = document.docType as EvidenceType;
    const registerExpiry = Date.parse(`${document.expiryDate.toISOString().slice(0, 10)}T00:00:00Z`);

    if (document.status === "VALID" && registerExpiry < now) {
      const days = Math.floor((now - registerExpiry) / 86_400_000);
      findings.push({
        id: `REGISTER_EXPIRED:${document.id}`,
        kind: "REGISTER_EXPIRED",
        severity: "HIGH",
        title: "Document marked valid after expiry",
        detail: `${EVIDENCE_TYPE_LABELS[docType] ?? document.docType} is recorded VALID but lapsed ${fmtDate(document.expiryDate)} (${days} day${days === 1 ? "" : "s"} ago).`,
        evidenceId: null,
        relatedInstitution: null,
      });
    }

    const annexure = latestPerDocType.get(docType);
    const annexureExpiryField = annexure?.fields.find((field) => field.key === "expiryDate");
    const annexureExpiry = expiryTimestamp(annexureExpiryField);
    if (annexure && annexureExpiry !== null) {
      if (annexureExpiry < now) {
        const days = Math.floor((now - annexureExpiry) / 86_400_000);
        findings.push({
          id: `LAPSED_EVIDENCE:${annexure.id}`,
          kind: "LAPSED_EVIDENCE",
          severity: "HIGH",
          title: "Annexure validity lapsed",
          detail: `${annexure.fileName} expired ${fmtDate(new Date(annexureExpiry))} (${days} day${days === 1 ? "" : "s"} ago).`,
          evidenceId: annexure.id,
          relatedInstitution: null,
        });
      } else if (Number.isFinite(registerExpiry) && daysBetween(annexureExpiry, registerExpiry) > 1) {
        findings.push({
          id: `EXPIRY_CONFLICT:${annexure.id}`,
          kind: "EXPIRY_CONFLICT",
          severity: "MEDIUM",
          title: "Validity dates disagree",
          detail: `${EVIDENCE_TYPE_LABELS[docType] ?? docType} annexure states ${fmtDate(new Date(annexureExpiry))} · statutory register records ${fmtDate(document.expiryDate)}.`,
          evidenceId: annexure.id,
          relatedInstitution: null,
        });
      }
    }
  }

  for (const type of MANDATORY_TYPES) {
    if (latestPerDocType.has(type)) continue;
    findings.push({
      id: `MISSING_ANNEXURE:${type}`,
      kind: "MISSING_ANNEXURE",
      severity: "INFO",
      title: `No ${EVIDENCE_TYPE_LABELS[type].toLowerCase()} annexure`,
      detail: `No ${EVIDENCE_TYPE_LABELS[type].toLowerCase()} PDF is bound to this case.`,
      evidenceId: null,
      relatedInstitution: null,
    });
  }

  findings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  const checksRun =
    rows.length * 2 + digests.length + documents.length + MANDATORY_TYPES.length + Object.keys(FIELD_PROFILE).length;

  return {
    annexures: rows.length,
    checksRun,
    findings,
    high: findings.filter((finding) => finding.severity === "HIGH").length,
    medium: findings.filter((finding) => finding.severity === "MEDIUM").length,
    info: findings.filter((finding) => finding.severity === "INFO").length,
    generatedAt: new Date(now).toISOString(),
  };
}
