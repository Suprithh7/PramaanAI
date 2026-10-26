import { createHash } from "node:crypto";

export type AuditHashInput = {
  sequence: number;
  applicationId?: string | null;
  institutionId?: string | null;
  performedBy: string;
  role: string;
  action: string;
  previousState?: string | null;
  newState?: string | null;
  detail?: string | null;
  previousHash?: string | null;
  timestamp: Date | string;
};

/**
 * Canonical SHA-256 checksum for the append-only audit ledger. Every field that
 * describes the event is bound into the digest, plus the previous link, so any
 * in-place modification breaks verification from that entry onward.
 */
export function computeAuditHash(input: AuditHashInput): string {
  const timestamp =
    input.timestamp instanceof Date
      ? input.timestamp.toISOString()
      : new Date(input.timestamp).toISOString();

  const canonical = [
    "PRAMAAN-AUDIT-V1",
    String(input.sequence),
    input.applicationId ?? "—",
    input.institutionId ?? "—",
    input.performedBy,
    input.role,
    input.action,
    input.previousState ?? "—",
    input.newState ?? "—",
    input.detail ?? "—",
    input.previousHash ?? "GENESIS",
    timestamp,
  ].join("‖");

  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export const AUDIT_GENESIS_PREVIOUS_HASH: string | null = null;
