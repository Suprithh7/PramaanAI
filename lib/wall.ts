import {
  activeApps,
  deficiencyStats,
  documentStats,
  escalationStats,
  inspectionStats,
  regionStats,
  ruleStats,
  slaCounts,
  stageBuckets,
} from "./analytics";
import { getLedgerIntegritySummary } from "./audit";
import { prisma } from "./db";
import { liveDaysInStage } from "./sla";

/**
 * Read-only national telemetry for the command wall. Aggregates only: the wall
 * never renders institution-level records, so it is safe for every role.
 */
export async function getWallData() {
  const [apps, documents, institutions, integrity, audit] = await Promise.all([
    prisma.application.findMany({
      include: {
        institution: { select: { region: true, state: true } },
        deficiencies: { select: { status: true, complianceDeadline: true } },
        inspections: {
          select: {
            siteReportStatus: true,
            geofenceVerified: true,
            conflictCheckPassed: true,
          },
        },
        escalations: { select: { status: true, penaltyPoints: true } },
        ruleChecks: { select: { status: true } },
      },
    }),
    prisma.complianceDocument.findMany({
      select: { status: true, expiryDate: true, docType: true, institutionId: true },
    }),
    prisma.institution.findMany({ select: { state: true } }),
    getLedgerIntegritySummary(),
    prisma.auditLog.findMany({
      orderBy: { sequence: "desc" },
      take: 18,
      select: {
        sequence: true,
        action: true,
        role: true,
        timestamp: true,
        hashChecksum: true,
      },
    }),
  ]);

  const active = activeApps(apps);
  const regions = regionStats(apps);
  const sla = slaCounts(apps);
  const rules = ruleStats(apps);
  const stages = stageBuckets(apps);
  const deficiencies = deficiencyStats(apps);
  const inspections = inspectionStats(apps);
  const docs = documentStats(documents);
  const escalations = escalationStats(apps);

  const oldestBreach = active.reduce(
    (max, app) => Math.max(max, liveDaysInStage(app.stageEnteredAt)),
    0,
  );
  const seatsUnderReview = active.reduce((sum, app) => sum + (app.intakeRequested ?? 0), 0);
  const decided = apps.filter((app) => app.status === "APPROVED" || app.status === "REJECTED");
  const approved = apps.filter((app) => app.status === "APPROVED").length;

  const paths: Record<string, number> = {
    SCRUTINY_ONLY: 0,
    SCRUTINY_EVC: 0,
    EVC_SAC_SHC: 0,
    EVC_ONLY: 0,
  };
  for (const app of active) {
    if (app.processingPath in paths) paths[app.processingPath] += 1;
  }

  return {
    submissions: apps.length,
    activeCount: active.length,
    regions,
    sla,
    rules,
    stages,
    paths,
    deficiencies,
    inspections,
    docs,
    escalations,
    oldestBreach,
    seatsUnderReview,
    approved,
    decidedCount: decided.length,
    institutionCount: institutions.length,
    stateCount: new Set(institutions.map((institution) => institution.state)).size,
    integrity,
    audit,
  };
}

export type WallData = Awaited<ReturnType<typeof getWallData>>;
