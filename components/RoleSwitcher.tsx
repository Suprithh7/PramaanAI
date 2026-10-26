"use client";

import { ChevronsUpDown, Loader2, SwitchCamera } from "lucide-react";
import { useTransition } from "react";
import { switchRoleAction } from "@/app/actions";
import { ROLE_META, ROLE_ORDER, type Role } from "@/lib/types";

export function RoleSwitcher({
  role,
  userName,
  designation,
  scope,
}: {
  role: Role;
  userName: string;
  designation: string | null;
  scope: string;
}) {
  const [pending, startTransition] = useTransition();

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as Role;
    startTransition(async () => {
      await switchRoleAction(next);
    });
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden min-w-0 text-right 2xl:block">
        <div className="text-2xs font-semibold leading-tight text-navy-950">{userName}</div>
        <div className="max-w-[220px] truncate text-3xs leading-tight text-slate-500">
          {designation ?? ROLE_META[role].summary}
        </div>
      </div>
      <div className="hidden h-9 w-px bg-slate-200 xl:block" />
      <div>
        <div className="mb-0.5 flex items-center gap-1.5">
          <SwitchCamera size={10} className="text-brass-600" />
          <span className="text-[9px] font-semibold uppercase tracking-label text-slate-500">
            Active role · impersonation
          </span>
        </div>
        <div>
          <div className="relative">
            <select
              aria-label="Switch active role"
              className="h-9 w-[168px] cursor-pointer appearance-none border border-navy-300 bg-white pl-2.5 pr-8 text-2xs font-semibold uppercase tracking-wide text-navy-900 shadow-sm outline-none transition hover:border-navy-600 focus:border-brass-500 focus:ring-2 focus:ring-brass-100 disabled:opacity-60 sm:w-[190px]"
              value={role}
              onChange={onChange}
              disabled={pending}
              title={`Scope: ${scope}`}
              aria-busy={pending}
            >
              {ROLE_ORDER.map((option) => (
                <option key={option} value={option}>
                  {ROLE_META[option].label}
                </option>
              ))}
            </select>
            {pending ? (
              <Loader2
                size={12}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-brass-600"
              />
            ) : (
              <ChevronsUpDown
                size={12}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-navy-500"
              />
            )}
          </div>
          <span className="mt-0.5 hidden max-w-[190px] truncate text-[8px] uppercase tracking-label text-slate-400 2xl:block">
            {scope}
          </span>
        </div>
      </div>
    </div>
  );
}
