"use client";

import { Loader2 } from "lucide-react";
import { useActionState } from "react";
import { ActionFeedback } from "@/components/ui/ActionFeedback";
import type { ActionResult } from "@/lib/types";

export type CaseField = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "textarea" | "select" | "hidden";
  placeholder?: string;
  defaultValue?: string | number;
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  hint?: string;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  span?: 1 | 2;
};

const VARIANTS: Record<string, string> = {
  primary: "btn-primary",
  outline: "btn-outline",
  emerald: "btn-emerald",
  danger: "btn-danger",
  brass: "btn-brass",
};

export function CaseActionForm({
  action,
  fields,
  hidden = {},
  submitLabel,
  pendingLabel = "Working…",
  variant = "primary",
  description,
  confirm,
  submitIcon,
}: {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  fields: CaseField[];
  hidden?: Record<string, string | number>;
  submitLabel: string;
  pendingLabel?: string;
  variant?: keyof typeof VARIANTS;
  description?: string;
  confirm?: string;
  submitIcon?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form
      action={formAction}
      className="space-y-2.5"
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {description && <p className="text-[10px] leading-relaxed text-slate-600">{description}</p>}
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={String(value)} />
      ))}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {fields.map((field) => {
          const wide = field.span === 2 || field.type === "textarea";
          if (field.type === "hidden") {
            return (
              <input
                key={field.name}
                type="hidden"
                name={field.name}
                value={String(field.defaultValue ?? "")}
              />
            );
          }
          return (
            <div key={field.name} className={wide ? "sm:col-span-2" : ""}>
              <label htmlFor={`${field.name}-${field.label}`} className="field-label">
                {field.label}
                {field.required && <span className="ml-0.5 text-red-600">*</span>}
              </label>
              {field.type === "textarea" ? (
                <textarea
                  id={`${field.name}-${field.label}`}
                  name={field.name}
                  rows={3}
                  required={field.required}
                  placeholder={field.placeholder}
                  defaultValue={field.defaultValue}
                  className="textarea"
                />
              ) : field.type === "select" ? (
                <select
                  id={`${field.name}-${field.label}`}
                  name={field.name}
                  required={field.required}
                  defaultValue={field.defaultValue}
                  className="select"
                >
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={`${field.name}-${field.label}`}
                  name={field.name}
                  type={field.type ?? "text"}
                  required={field.required}
                  placeholder={field.placeholder}
                  defaultValue={field.defaultValue}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  className="input"
                />
              )}
              {field.hint && <p className="mt-1 text-[9px] leading-snug text-slate-500">{field.hint}</p>}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-start gap-2">
        <button type="submit" disabled={pending} className={`btn ${VARIANTS[variant] ?? "btn-primary"}`}>
          {pending ? <Loader2 size={11} className="animate-spin" /> : submitIcon}
          {pending ? pendingLabel : submitLabel}
        </button>
        <ActionFeedback state={state} />
      </div>
    </form>
  );
}
