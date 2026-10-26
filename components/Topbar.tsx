import Link from "next/link";
import { CommandPalette } from "@/components/CommandPalette";
import { Emblem } from "@/components/Emblem";
import { LiveClock } from "@/components/LiveClock";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import type { Session } from "@/lib/session";
import { ROLE_META } from "@/lib/types";

export function Topbar({
  session,
  ledgerValid,
}: {
  session: Session;
  ledgerValid: boolean;
}) {
  const scope =
    session.role === "INSTITUTION_ADMIN"
      ? session.tenant?.name ?? "Institution tenant"
      : session.role === "REGIONAL_OFFICER"
        ? session.user.region
          ? `${session.user.region} Region`
          : "AICTE regional operations"
        : session.role === "EVC_MEMBER"
          ? "Expert Visit Committee"
          : "National jurisdiction";

  return (
    <header className="no-print sticky top-0 z-40">
      <div className="grid h-[3px] grid-cols-3">
        <div className="bg-[#e88b2e]" />
        <div className="bg-white" />
        <div className="bg-[#1d7a45]" />
      </div>

      <div className="bg-navy-950 text-navy-300">
        <div className="mx-auto flex h-7 max-w-[1900px] items-center justify-between gap-4 px-4 text-[9px] font-medium uppercase tracking-wider2 lg:px-6">
          <div className="flex items-center gap-2 truncate">
            <span className="text-brass-300">भारत सरकार</span>
            <span className="text-white/20">/</span>
            <span className="truncate">Government of India · Ministry of Education</span>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <span className="hidden lg:inline">All India Council for Technical Education</span>
            <span className="hidden h-3 w-px bg-white/15 lg:inline-block" />
            <LiveClock />
          </div>
        </div>
      </div>

      <div className="border-b border-slate-300/90 bg-white/95 shadow-[0_1px_0_rgba(14,32,51,0.03)] backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1900px] items-center gap-3 px-4 lg:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="PRAMAAN home">
            <Emblem />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-semibold uppercase tracking-wider2 text-brass-700">
                  PRAMAAN
                </span>
                <span className="hidden h-2.5 w-px bg-slate-300 sm:block" />
                <span className="hidden text-[9px] font-medium uppercase tracking-label text-slate-500 sm:block">
                  National APH Regulatory Platform
                </span>
              </div>
              <h1 className="mt-0.5 truncate font-serif text-[14px] font-semibold leading-tight text-navy-950 sm:text-[16px] xl:text-[17px]">
                AICTE Approval Process Handbook (APH) Workflow &amp; Compliance Portal
              </h1>
            </div>
          </Link>

          <div className="ml-auto flex shrink-0 items-center gap-2.5 xl:gap-3.5">
            <CommandPalette role={session.role} />
            <div className="hidden items-center gap-2 border-r border-slate-200 pr-4 xl:flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
              </span>
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-label text-slate-500">
                  Platform status
                </div>
                <div className="font-mono text-3xs text-slate-700">
                  {ledgerValid ? "Operational · ledger verified" : "Degraded · ledger alert"}
                </div>
              </div>
            </div>

            <div className="hidden border border-brass-300 bg-brass-50 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-label text-brass-800 lg:block">
              Demo impersonation
            </div>

            <RoleSwitcher
              role={session.role}
              userName={session.user.name}
              designation={session.user.designation}
              scope={scope}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
