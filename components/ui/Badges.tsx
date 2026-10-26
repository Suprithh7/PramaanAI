import { CheckCircle2, Clock, ShieldAlert, XCircle } from "lucide-react";
import {
  DEFICIENCY_STATUS_META,
  DOC_STATUS_META,
  ESCALATION_STATUS_META,
  EVC_REPORT_STATUS_META,
  SLA_META,
  STATUS_META,
  docMeta,
  slaMeta,
  statusMeta,
  type DocStatus,
  type DeficiencyStatus,
} from "@/lib/types";

type BadgeProps = { status: string; className?: string };

export function StatusBadge({ status, className = "" }: BadgeProps) {
  const meta = statusMeta(status);
  return (
    <span className={`badge ${meta.tone} ${className}`}>
      <span className={`h-1.5 w-1.5 shrink-0 ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export function SlaBadge({
  status,
  days,
  className = "",
}: {
  status: string;
  days?: number;
  className?: string;
}) {
  const meta = slaMeta(status);
  return (
    <span className={`badge ${meta.tone} ${className}`}>
      <Clock size={9} strokeWidth={2} />
      {meta.label}
      {typeof days === "number" && (
        <span className="border-l border-current/25 pl-1 font-mono tabular-nums">{days}d</span>
      )}
    </span>
  );
}

export function DocStatusBadge({ status, className = "" }: BadgeProps) {
  const meta = docMeta(status);
  return <span className={`badge ${meta.tone} ${className}`}>{meta.label}</span>;
}

export function DeficiencyStatusBadge({ status, className = "" }: BadgeProps) {
  const meta =
    DEFICIENCY_STATUS_META[status as DeficiencyStatus] ??
    DEFICIENCY_STATUS_META.RESUBMITTED;
  return <span className={`badge ${meta.tone} ${className}`}>{meta.label}</span>;
}

export function EvcReportBadge({ status, className = "" }: BadgeProps) {
  const meta =
    EVC_REPORT_STATUS_META[status] ?? {
      label: status.replaceAll("_", " "),
      tone: "border-slate-300 bg-slate-50 text-slate-700",
    };
  return <span className={`badge ${meta.tone} ${className}`}>{meta.label}</span>;
}

export function EscalationStatusBadge({ status, className = "" }: BadgeProps) {
  const meta =
    ESCALATION_STATUS_META[status] ?? {
      label: status,
      tone: "border-slate-300 bg-slate-50 text-slate-700",
    };
  return <span className={`badge ${meta.tone} ${className}`}>{meta.label}</span>;
}

export function RuleStatusBadge({ status, className = "" }: BadgeProps) {
  if (status === "PASSED") {
    return (
      <span className={`badge border-emerald-300 bg-emerald-50 text-emerald-900 ${className}`}>
        <CheckCircle2 size={9} /> Passed
      </span>
    );
  }
  return (
    <span className={`badge border-red-300 bg-red-50 text-red-900 ${className}`}>
      <ShieldAlert size={9} /> Deficiency detected
    </span>
  );
}

export function ConflictBadge({ passed, className = "" }: { passed: boolean; className?: string }) {
  return passed ? (
    <span className={`badge border-emerald-300 bg-emerald-50 text-emerald-900 ${className}`}>
      <CheckCircle2 size={9} /> Conflict cleared
    </span>
  ) : (
    <span className={`badge border-red-300 bg-red-50 text-red-900 ${className}`}>
      <XCircle size={9} /> Conflict detected
    </span>
  );
}

export function RawStatusBadge({
  label,
  tone = "border-slate-300 bg-slate-50 text-slate-700",
  className = "",
}: {
  label: string;
  tone?: string;
  className?: string;
}) {
  return <span className={`badge ${tone} ${className}`}>{label}</span>;
}

export const TONE_CLASSES = {
  ...Object.fromEntries(
    Object.entries(STATUS_META).map(([key, value]) => [key, value.tone]),
  ),
  ...Object.fromEntries(
    Object.entries(SLA_META).map(([key, value]) => [key, value.tone]),
  ),
  ...Object.fromEntries(
    Object.entries(DOC_STATUS_META).map(([key, value]) => [key, value.tone]),
  ),
} as Record<string, string>;
