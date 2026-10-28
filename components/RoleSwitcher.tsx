"use client";

import { ChevronsUpDown, Loader2 } from "lucide-react";
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
      <div className="hidden text-right md:block">
        <div className="text-sm font-semibold leading-tight text-navy-950">{userName}</div>
        <div className="text-xs leading-tight text-slate-500" title={scope}>
          {designation ?? ROLE_META[role].summary}
        </div>
      </div>
      <div className="relative">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-label text-slate-500">
          Demo view as
        </span>
        <select
          aria-label="Switch demo role"
          className="h-9 w-[150px] cursor-pointer appearance-none border border-slate-300 bg-white pl-2.5 pr-8 text-sm font-semibold text-navy-900 outline-none transition hover:border-navy-400 focus:border-brass-500 disabled:opacity-60 sm:w-[168px]"
          value={role}
          onChange={onChange}
          disabled={pending}
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
            size={14}
            className="pointer-events-none absolute bottom-2.5 right-2.5 animate-spin text-brass-600"
          />
        ) : (
          <ChevronsUpDown
            size={14}
            className="pointer-events-none absolute bottom-2.5 right-2.5 text-slate-500"
          />
        )}
      </div>
    </div>
  );
}
