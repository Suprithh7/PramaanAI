import { prisma } from "./db";
import { liveDaysInStage, slaForDays } from "./sla";
import type { Session } from "./session";

export function portfolioScope(session: Session): { institutionId?: string } {
  if (session.role === "INSTITUTION_ADMIN") {
    return { institutionId: session.tenant?.id ?? "__no_tenant__" };
  }
  return {};
}

export async function getPortfolio(session: Session) {
  return prisma.application.findMany({
    where: portfolioScope(session),
    include: {
      institution: true,
      deficiencies: { orderBy: { createdAt: "desc" } },
      inspections: { orderBy: { createdAt: "desc" } },
      escalations: { orderBy: { createdAt: "desc" } },
      ruleChecks: { orderBy: { ruleCode: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getCase(id: string) {
  return prisma.application.findUnique({
    where: { id },
    include: {
      institution: { include: { documents: { orderBy: { docType: "asc" } } } },
      deficiencies: { orderBy: { createdAt: "desc" } },
      inspections: { orderBy: { createdAt: "desc" } },
      escalations: { orderBy: { createdAt: "desc" } },
      ruleChecks: { orderBy: { ruleCode: "asc" } },
      evidenceFiles: { orderBy: { createdAt: "desc" } },
      filingDeclaration: true,
      filingBrief: true,
      auditLogs: { orderBy: { sequence: "desc" }, take: 40 },
    },
  });
}

export async function getDocuments(session: Session) {
  return prisma.complianceDocument.findMany({
    where:
      session.role === "INSTITUTION_ADMIN"
        ? { institutionId: session.tenant?.id ?? "__no_tenant__" }
        : {},
    include: { institution: true },
    orderBy: [{ status: "asc" }, { expiryDate: "asc" }],
  });
}

export type PortfolioApp = Awaited<ReturnType<typeof getPortfolio>>[number];
export type CaseApp = NonNullable<Awaited<ReturnType<typeof getCase>>>;

export function liveRow(app: PortfolioApp) {
  const days = liveDaysInStage(app.stageEnteredAt);
  return { days, sla: slaForDays(days) };
}
