import { verifyAuditLedger } from "./audit";
import { prisma } from "./db";
import type { TelemetryPayload } from "./evidence-types";
import type { Session } from "./session";
import { liveDaysInStage, slaForDays } from "./sla";
import { TERMINAL_STATUSES } from "./types";

export async function getTelemetry(session: Session): Promise<TelemetryPayload> {
  const institutionId =
    session.role === "INSTITUTION_ADMIN" ? session.tenant?.id ?? "__no_tenant__" : null;

  const appScope = institutionId ? { institutionId } : {};
  const ticketScope = institutionId ? { application: { institutionId } } : {};
  const evidenceScope = institutionId ? { institutionId } : {};

  const [
    activeApps,
    openDeficiencies,
    openEscalations,
    evidenceFiles,
    evidenceVerified,
    evidenceTampered,
    ledgerEntries,
    recent,
    verification,
  ] = await Promise.all([
    prisma.application.findMany({
      where: { ...appScope, status: { notIn: TERMINAL_STATUSES } },
      select: { stageEnteredAt: true },
    }),
    prisma.deficiencyTicket.count({ where: { status: "OPEN", ...ticketScope } }),
    prisma.escalationTicket.count({
      where: { status: { in: ["OPEN", "ACKNOWLEDGED"] }, ...ticketScope },
    }),
    prisma.evidenceFile.count({ where: evidenceScope }),
    prisma.evidenceFile.count({ where: { integrity: "VERIFIED", ...evidenceScope } }),
    prisma.evidenceFile.count({ where: { integrity: "TAMPERED", ...evidenceScope } }),
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      where: institutionId ? { institutionId } : {},
      orderBy: { sequence: "desc" },
      take: 4,
      select: {
        id: true,
        sequence: true,
        action: true,
        performedBy: true,
        detail: true,
        timestamp: true,
      },
    }),
    verifyAuditLedger(),
  ]);

  const breaches = activeApps.filter(
    (app) => slaForDays(liveDaysInStage(app.stageEnteredAt)) === "BREACHED",
  ).length;

  return {
    serverTime: new Date().toISOString(),
    activeCases: activeApps.length,
    breaches,
    openDeficiencies,
    openEscalations,
    evidenceFiles,
    evidenceVerified,
    evidenceTampered,
    ledgerEntries,
    ledgerValid: verification.valid,
    ledgerHead: verification.headHash,
    recent: recent.map((entry) => ({
      id: entry.id,
      sequence: entry.sequence,
      action: entry.action,
      performedBy: entry.performedBy,
      detail: entry.detail,
      timestamp: entry.timestamp.toISOString(),
    })),
  };
}
