import type { SlaStatus } from "./types";

export const SLA_POLICY = {
  /** Days in stage at which the case moves to WARNING. */
  warningAtDays: 5,
  /** Days in stage after which the case is a BREACH (strictly greater than). */
  breachAfterDays: 10,
  /** Administrative scrutiny clock, in days. */
  deadlineDays: 10,
  /** Penalty points attached to each auto-generated escalation. */
  penaltyPoints: 5,
  /** Deficiency evidence window, in days. */
  deficiencyWindowDays: 10,
} as const;

export function slaForDays(days: number): SlaStatus {
  if (days > SLA_POLICY.breachAfterDays) return "BREACHED";
  if (days >= SLA_POLICY.warningAtDays) return "WARNING";
  return "ON_TRACK";
}

export function liveDaysInStage(stageEnteredAt: Date | string, now: Date = new Date()): number {
  const entered = stageEnteredAt instanceof Date ? stageEnteredAt : new Date(stageEnteredAt);
  return Math.max(0, Math.floor((now.getTime() - entered.getTime()) / 86_400_000));
}

export function stageDeadline(stageEnteredAt: Date | string): Date {
  const entered = stageEnteredAt instanceof Date ? stageEnteredAt : new Date(stageEnteredAt);
  return new Date(entered.getTime() + SLA_POLICY.deadlineDays * 86_400_000);
}

export function stageElapsedPercent(days: number): number {
  return Math.min(100, Math.round((days / SLA_POLICY.deadlineDays) * 100));
}

export function daysOverdue(stageEnteredAt: Date | string, now: Date = new Date()): number {
  return Math.max(0, liveDaysInStage(stageEnteredAt, now) - SLA_POLICY.deadlineDays);
}
