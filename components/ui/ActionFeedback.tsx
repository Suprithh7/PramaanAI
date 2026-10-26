"use client";

import { AlertTriangle, CheckCircle2, Info, Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useActionState } from "react";
import type { ActionResult } from "@/lib/types";

export function ActionFeedback({
  state,
  className = "",
}: {
  state: ActionResult | null;
  className?: string;
}) {
  if (!state || !state.message) return null;
  const success = state.ok;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-1.5 border px-2 py-1.5 text-[10px] leading-snug ${
        success
          ? "border-emerald-300 bg-emerald-50 text-emerald-900"
          : "border-red-300 bg-red-50 text-red-900"
      } ${className}`}
    >
      {success ? (
        <CheckCircle2 size={12} className="mt-px shrink-0" />
      ) : (
        <AlertTriangle size={12} className="mt-px shrink-0" />
      )}
      <span>{state.message}</span>
    </div>
  );
}

const ICONS = {
  play: <Loader2 size={12} />,
  check: <CheckCircle2 size={12} />,
  alert: <AlertTriangle size={12} />,
  info: <Info size={12} />,
};

export function ActionButton({
  action,
  fields,
  label,
  pendingLabel,
  variant = "outline",
  size = "sm",
  icon,
  className = "",
  confirm,
  disabled = false,
  disabledReason,
  feedbackClassName = "",
}: {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  fields: Record<string, string | number>;
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "outline" | "emerald" | "danger" | "ghost" | "brass";
  size?: "sm" | "xs";
  icon?: React.ReactNode;
  className?: string;
  confirm?: string;
  disabled?: boolean;
  disabledReason?: string;
  feedbackClassName?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [refreshing] = useTransition();

  return (
    <div className={`inline-flex flex-col items-start gap-1.5 ${className}`}>
      <form
        action={formAction}
        className="inline-flex"
        onSubmit={(event) => {
          if (confirm && !window.confirm(confirm)) event.preventDefault();
        }}
      >
        {Object.entries(fields).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={String(value)} />
        ))}
        <button
          type="submit"
          disabled={pending || disabled || refreshing}
          title={disabled ? disabledReason : undefined}
          className={`btn ${size === "xs" ? "btn-xs" : ""} ${
            variant === "primary"
              ? "btn-primary"
              : variant === "emerald"
                ? "btn-emerald"
                : variant === "danger"
                  ? "btn-danger"
                  : variant === "brass"
                    ? "btn-brass"
                    : variant === "ghost"
                      ? "btn-ghost"
                      : "btn-outline"
          }`}
        >
          {pending ? <Loader2 size={11} className="animate-spin" /> : icon}
          {pending ? pendingLabel ?? "Working…" : label}
        </button>
      </form>
      <ActionFeedback state={state} className={feedbackClassName} />
    </div>
  );
}

export function useMountedNow(intervalMs = 60_000) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
