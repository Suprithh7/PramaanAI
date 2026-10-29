import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { recordAudit } from "../lib/audit";
import { processEvidencePdf, readEvidenceFile, rehashStored, saveEvidenceFile } from "../lib/evidence";
import { EVIDENCE_TYPE_LABELS, type EvidenceType } from "../lib/evidence-types";
import { buildSamplePdf } from "../lib/sample-pdf";

const prisma = new PrismaClient();
const DAY = 86_400_000;

type SeedDoc = {
  institutionId: string;
  applicationId: string;
  docType: EvidenceType;
  fileName: string;
  uploadedBy: string;
  daysAgo: number;
  title: string;
  body: string[];
};

// Ordered oldest → newest so ledger sequence and timestamps stay monotonic.
const DOCS: SeedDoc[] = [
  {
    institutionId: "inst_bit",
    applicationId: "app_bit_mca",
    docType: "LEASE_DEED",
    fileName: "BIT-campus-lease-deed-2011.pdf",
    uploadedBy: "Dr. S. Raghavan",
    daysAgo: 15,
    title: "REGISTERED LEASE DEED",
    body: [
      "This deed of lease is executed between the lessor and the lessee for the campus land.",
      "Name of Institution: Bangalore Institute of Technology",
      "Land area 28.4 acres situated at K R Road, Bengaluru.",
      "The lease period is 45 years commencing from the date of registration.",
      "Monthly rent payable is Rs. 9,20,000. Registration completed at the sub registrar office.",
    ],
  },
  {
    institutionId: "inst_bit",
    applicationId: "app_bit_mca",
    docType: "FIRE_SAFETY",
    fileName: "BIT-fire-safety-certificate-2026.pdf",
    uploadedBy: "Dr. S. Raghavan",
    daysAgo: 12,
    title: "FIRE SAFETY CERTIFICATE",
    body: [
      "Fire safety certificate issued under the National Building Code.",
      "The premises have adequate fire fighting arrangements including sprinklers, hydrants and extinguishers.",
      "Occupancy permitted for 3000 persons across the campus buildings.",
      "Valid up to 30 June 2029.",
    ],
  },
  {
    institutionId: "inst_dti",
    applicationId: "app_dti_cse",
    docType: "LEASE_DEED",
    fileName: "DTI-campus-lease-deed-1998.pdf",
    uploadedBy: "Dr. Meera Krishnan",
    daysAgo: 11,
    title: "REGISTERED LEASE DEED",
    body: [
      "This deed of lease is executed between the lessor and the lessee for the campus land.",
      "Name of Institution: Delhi Technological Institute",
      "Land area 42.5 acres situated at Shahbad Daulatpur, New Delhi.",
      "The lease period is 30 years commencing from the date of registration.",
      "Monthly rent payable is Rs. 6,40,000. Registration completed at the sub registrar office.",
    ],
  },
  {
    institutionId: "inst_dti",
    applicationId: "app_dti_cse",
    docType: "FIRE_SAFETY",
    fileName: "DTI-fire-safety-certificate-2026.pdf",
    uploadedBy: "Dr. Meera Krishnan",
    daysAgo: 9,
    title: "FIRE SAFETY CERTIFICATE",
    body: [
      "Fire safety certificate issued under the National Building Code.",
      "The premises have adequate fire fighting arrangements including sprinklers, hydrants and extinguishers.",
      "Occupancy permitted for 4200 persons across the academic and residential blocks.",
      "Valid up to 31 March 2028.",
    ],
  },
  {
    institutionId: "inst_dti",
    applicationId: "app_dti_cse",
    docType: "BUILDING_PLAN",
    fileName: "DTI-approved-building-plan-rev-2025.pdf",
    uploadedBy: "Dr. Meera Krishnan",
    daysAgo: 7,
    title: "APPROVED BUILDING PLAN",
    body: [
      "Sanctioned building plan for the existing campus.",
      "Built up area of 38,500 sq m across four floors.",
      "Floor plan shows classrooms, laboratories, library and administrative block.",
      "Sanction reference DDA/BP/2025/1142 dated 12 February 2025.",
    ],
  },
  {
    institutionId: "inst_biem",
    applicationId: "app_biem_mech",
    docType: "FIRE_SAFETY",
    fileName: "BIEM-fire-safety-certificate-2026.pdf",
    uploadedBy: "Dr. S. Bhattacharya",
    daysAgo: 6,
    title: "FIRE SAFETY CERTIFICATE",
    body: [
      "Fire safety certificate issued under the National Building Code.",
      "The premises have adequate fire fighting arrangements including sprinklers, hydrants and extinguishers.",
      "Occupancy permitted for 1500 persons across the campus buildings.",
      "Valid up to 15 August 2027.",
    ],
  },
];

async function seedReuseCase(): Promise<boolean> {
  const source = await prisma.evidenceFile.findFirst({
    where: { institutionId: "inst_dti", docType: "LEASE_DEED" },
    orderBy: { createdAt: "asc" },
  });
  if (!source) {
    console.log("skip  JITS shared lease (no DTI lease on record)");
    return false;
  }
  const existing = await prisma.evidenceFile.findFirst({
    where: { institutionId: "inst_jits", docType: "LEASE_DEED" },
    select: { id: true },
  });
  if (existing) {
    console.log("skip  JITS shared lease (already stored)");
    return false;
  }

  const app = await prisma.application.findUnique({
    where: { id: "app_jits_civil" },
    select: { referenceNo: true },
  });
  if (!app) throw new Error("Application app_jits_civil not found.");

  const bytes = await readEvidenceFile(source.storagePath);
  const id = randomUUID();
  const storagePath = await saveEvidenceFile(id, bytes);
  const rehash = await rehashStored(storagePath);
  const integrity = rehash === source.sha256 ? "VERIFIED" : "TAMPERED";
  const createdAt = new Date(Date.now() - 5 * DAY);
  const fieldCount = (() => {
    try {
      const parsed = JSON.parse(source.extracted) as { fields?: unknown[] };
      return Array.isArray(parsed.fields) ? parsed.fields.length : 0;
    } catch {
      return 0;
    }
  })();

  await prisma.$transaction(async (tx) => {
    await tx.evidenceFile.create({
      data: {
        id,
        applicationId: "app_jits_civil",
        institutionId: "inst_jits",
        docType: source.docType,
        detectedType: source.detectedType,
        fileName: "JITS-campus-lease-deed-2026.pdf",
        mimeType: "application/pdf",
        sizeBytes: bytes.length,
        sha256: source.sha256,
        storagePath,
        textChars: source.textChars,
        hasTextLayer: source.hasTextLayer,
        extracted: source.extracted,
        integrity,
        referenceMatch: null,
        referenceOfId: null,
        verifyCount: 1,
        lastVerifiedAt: createdAt,
        uploadedBy: "Dr. V. K. Saxena",
        uploadedRole: "INSTITUTION_ADMIN",
        createdAt,
      },
    });
    await recordAudit(
      {
        applicationId: "app_jits_civil",
        institutionId: "inst_jits",
        performedBy: "Dr. V. K. Saxena",
        role: "INSTITUTION_ADMIN",
        action: "EVIDENCE_UPLOADED",
        previousState: null,
        newState: `${source.sha256.slice(0, 12)}…`,
        detail: `${EVIDENCE_TYPE_LABELS[source.detectedType as EvidenceType] ?? "Lease deed"} uploaded for ${app.referenceNo}. ${fieldCount} detail(s) read from the text · the same file is already on the national register for another college.`,
        timestamp: new Date(createdAt.getTime() + 5 * 60_000),
      },
      tx,
    );
  });

  console.log(
    `seed  JITS-campus-lease-deed-2026.pdf → reused digest of ${source.fileName} · ${integrity.toLowerCase()}`,
  );
  return true;
}

async function main() {
  let created = 0;

  for (const doc of DOCS) {
    const existing = await prisma.evidenceFile.findFirst({
      where: {
        institutionId: doc.institutionId,
        docType: doc.docType,
        fileName: doc.fileName,
      },
      select: { id: true },
    });
    if (existing) {
      console.log(`skip  ${doc.fileName} (already stored)`);
      continue;
    }

    const app = await prisma.application.findUnique({
      where: { id: doc.applicationId },
      select: { referenceNo: true },
    });
    if (!app) throw new Error(`Application ${doc.applicationId} not found.`);

    const bytes = buildSamplePdf(doc.title, doc.body);
    const processed = await processEvidencePdf(bytes);
    const id = randomUUID();
    const storagePath = await saveEvidenceFile(id, bytes);
    const rehash = await rehashStored(storagePath);
    const integrity = rehash === processed.sha256 ? "VERIFIED" : "TAMPERED";
    const createdAt = new Date(Date.now() - doc.daysAgo * DAY);

    await prisma.$transaction(async (tx) => {
      await tx.evidenceFile.create({
        data: {
          id,
          applicationId: doc.applicationId,
          institutionId: doc.institutionId,
          docType: processed.detectedType,
          detectedType: processed.detectedType,
          fileName: doc.fileName,
          mimeType: "application/pdf",
          sizeBytes: bytes.length,
          sha256: processed.sha256,
          storagePath,
          textChars: processed.textChars,
          hasTextLayer: processed.hasTextLayer,
          extracted: processed.extractedJson,
          integrity,
          referenceMatch: null,
          referenceOfId: null,
          verifyCount: 2,
          lastVerifiedAt: createdAt,
          uploadedBy: doc.uploadedBy,
          uploadedRole: "INSTITUTION_ADMIN",
          createdAt,
        },
      });
      await recordAudit(
        {
          applicationId: doc.applicationId,
          institutionId: doc.institutionId,
          performedBy: doc.uploadedBy,
          role: "INSTITUTION_ADMIN",
          action: "EVIDENCE_UPLOADED",
          previousState: null,
          newState: `${processed.sha256.slice(0, 12)}…`,
          detail: `${EVIDENCE_TYPE_LABELS[processed.detectedType]} uploaded for ${app.referenceNo}. ${processed.fields.length} detail(s) read from the text.`,
          timestamp: new Date(createdAt.getTime() + 5 * 60_000),
        },
        tx,
      );
    });

    created += 1;
    console.log(
      `seed  ${doc.fileName} → ${processed.detectedType} · ${processed.fields.length} detail(s) · ${integrity.toLowerCase()}`,
    );
  }

  if (await seedReuseCase()) created += 1;

  console.log(`\nEvidence seeding complete: ${created} new file(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
