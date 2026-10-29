import type { Prisma } from "@prisma/client";
import { computeAuditHash } from "./audit-hash";
import { prisma } from "./db";

type AuditClient = Prisma.TransactionClient | typeof prisma;

export type AuditInput = {
  applicationId?: string | null;
  institutionId?: string | null;
  performedBy: string;
  role: string;
  action: string;
  previousState?: string | null;
  newState?: string | null;
  detail?: string | null;
  timestamp?: Date;
};

/**
 * Appends one event to the global hash chain. Callers pass the active
 * transaction so the state change and its evidence commit atomically.
 */
export async function recordAudit(input: AuditInput, client: AuditClient = prisma) {
  const head = await client.auditLog.findFirst({
    orderBy: { sequence: "desc" },
    select: { sequence: true, hashChecksum: true },
  });

  const sequence = (head?.sequence ?? 0) + 1;
  const previousHash = head?.hashChecksum ?? null;
  const timestamp = input.timestamp ?? new Date();

  const hashChecksum = computeAuditHash({
    sequence,
    applicationId: input.applicationId ?? null,
    institutionId: input.institutionId ?? null,
    performedBy: input.performedBy,
    role: input.role,
    action: input.action,
    previousState: input.previousState ?? null,
    newState: input.newState ?? null,
    detail: input.detail ?? null,
    previousHash,
    timestamp,
  });

  return client.auditLog.create({
    data: {
      sequence,
      applicationId: input.applicationId ?? null,
      institutionId: input.institutionId ?? null,
      performedBy: input.performedBy,
      role: input.role,
      action: input.action,
      previousState: input.previousState ?? null,
      newState: input.newState ?? null,
      detail: input.detail ?? null,
      previousHash,
      hashChecksum,
      timestamp,
    },
  });
}

export type LedgerVerification = {
  valid: boolean;
  entries: number;
  headHash: string | null;
  brokenAtSequence: number | null;
  reason: string | null;
  triggers: string[];
};

export async function verifyAuditLedger(): Promise<LedgerVerification> {
  const logs = await prisma.auditLog.findMany({
    orderBy: { sequence: "asc" },
  });

  const triggers = await prisma
    .$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'AuditLog' ORDER BY name`,
    )
    .catch(() => [] as Array<{ name: string }>);

  let previousHash: string | null = null;
  let expectedSequence = 1;

  for (const log of logs) {
    if (log.sequence !== expectedSequence) {
      return {
        valid: false,
        entries: logs.length,
        headHash: previousHash,
        brokenAtSequence: log.sequence,
        reason: `An entry is missing: expected #${expectedSequence}, found #${log.sequence}.`,
        triggers: triggers.map((trigger) => trigger.name),
      };
    }

    if (log.previousHash !== previousHash) {
      return {
        valid: false,
        entries: logs.length,
        headHash: previousHash,
        brokenAtSequence: log.sequence,
        reason: `Entry #${log.sequence} no longer connects to the entry before it.`,
        triggers: triggers.map((trigger) => trigger.name),
      };
    }

    const recomputed = computeAuditHash({
      sequence: log.sequence,
      applicationId: log.applicationId,
      institutionId: log.institutionId,
      performedBy: log.performedBy,
      role: log.role,
      action: log.action,
      previousState: log.previousState,
      newState: log.newState,
      detail: log.detail,
      previousHash: log.previousHash,
      timestamp: log.timestamp,
    });

    if (recomputed !== log.hashChecksum) {
      return {
        valid: false,
        entries: logs.length,
        headHash: previousHash,
        brokenAtSequence: log.sequence,
        reason: `The text in entry #${log.sequence} no longer matches the security code stored with it.`,
        triggers: triggers.map((trigger) => trigger.name),
      };
    }

    previousHash = log.hashChecksum;
    expectedSequence += 1;
  }

  return {
    valid: true,
    entries: logs.length,
    headHash: previousHash,
    brokenAtSequence: null,
    reason: null,
    triggers: triggers.map((trigger) => trigger.name),
  };
}

export async function getLedgerIntegritySummary() {
  const [verification, latest] = await Promise.all([
    verifyAuditLedger(),
    prisma.auditLog.findFirst({ orderBy: { sequence: "desc" } }),
  ]);
  return { ...verification, latest };
}
