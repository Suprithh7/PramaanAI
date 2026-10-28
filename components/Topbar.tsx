import Link from "next/link";
import { Emblem } from "@/components/Emblem";
import { LiveClock } from "@/components/LiveClock";
import { NavBar } from "@/components/NavBar";
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
      ? session.tenant?.name ?? "Institution login"
      : session.role === "REGIONAL_OFFICER"
        ? session.user.region
          ? `${session.user.region} region`
          : "Regional office"
        : session.role === "EVC_MEMBER"
          ? "Expert Visit Committee"
          : session.role === "BUREAU_OFFICER"
            ? "AICTE headquarters"
            : "All India";

  return (
    <header className="no-print sticky top-0 z-40">
      <div className="grid h-[3px] grid-cols-3">
        <div className="bg-[#e88b2e]" />
        <div className="bg-white" />
        <div className="bg-[#1d7a45]" />
      </div>

      <div className="hidden bg-navy-950 text-navy-200 sm:block">
        <div className="mx-auto flex h-7 max-w-[1400px] items-center justify-between gap-4 px-4 text-[10px] font-medium uppercase tracking-wider2 lg:px-6">
          <span className="truncate">
            <span className="text-brass-300">भारत सरकार</span>
            <span className="mx-2 text-white/20">/</span>
            Government of India · All India Council for Technical Education
          </span>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 ${ledgerValid ? "text-emerald-300" : "text-amber-300"}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
              {ledgerValid ? "Records verified" : "Records alert"}
            </span>
            <span className="h-3 w-px bg-white/15" />
            <LiveClock />
          </div>
        </div>
      </div>

      <div className="border-b border-slate-300 bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2.5 lg:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="PRAMAAN home">
            <Emblem />
            <div className="min-w-0">
              <div className="font-serif text-xl font-semibold leading-none text-navy-950">
                PRAMAAN
              </div>
              <div className="mt-1 truncate text-xs text-slate-500">
                AICTE approvals, start to finish
              </div>
            </div>
          </Link>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            <span className="hidden border border-brass-300 bg-brass-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-label text-brass-800 lg:inline-block">
              Live demo · {ROLE_META[session.role].label}
            </span>
            <RoleSwitcher
              role={session.role}
              userName={session.user.name}
              designation={session.user.designation}
              scope={scope}
            />
          </div>
        </div>
      </div>

      <NavBar />
    </header>
  );
}
