"use client";

import {
  Building2,
  ChevronsUpDown,
  FileCheck2,
  Files,
  FlaskConical,
  Globe2,
  LayoutDashboard,
  Loader2,
  MapPin,
  MapPinned,
  Radar,
  Route,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { switchTenantAction } from "@/app/actions";
import { initials, truncateHash } from "@/lib/format";
import type { TenantInstitution } from "@/lib/session";
import { REGION_META, ROLE_META, type Region, type Role } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  roles: Role[];
  count?: number;
  countTone?: "danger" | "warning" | "neutral";
  tag?: string;
};

type Props = {
  role: Role;
  userName: string;
  designation: string | null;
  region: string | null;
  tenant: TenantInstitution | null;
  tenants: TenantInstitution[];
  counts: { deficiencies: number; escalations: number; evc: number };
  ledger: { valid: boolean; entries: number; headHash: string | null };
};

const ALL_ROLES: Role[] = [
  "INSTITUTION_ADMIN",
  "REGIONAL_OFFICER",
  "EVC_MEMBER",
  "COMPLIANCE_HEAD",
  "BUREAU_OFFICER",
];

export function Sidebar({
  role,
  userName,
  designation,
  region,
  tenant,
  tenants,
  counts,
  ledger,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const operations: NavItem[] = [
    {
      href: "/",
      label: role === "INSTITUTION_ADMIN" ? "Institution Home" : "Command Centre",
      icon: LayoutDashboard,
      roles: ALL_ROLES,
    },
    {
      href: "/applications",
      label: role === "INSTITUTION_ADMIN" ? "My Applications" : "Application Register",
      icon: Files,
      roles: ALL_ROLES,
      count: role === "INSTITUTION_ADMIN" ? counts.deficiencies : undefined,
      countTone: "danger",
    },
    {
      href: "/scrutiny",
      label: "Scrutiny Desk",
      icon: ScanSearch,
      roles: ["REGIONAL_OFFICER", "COMPLIANCE_HEAD", "BUREAU_OFFICER"],
    },
    {
      href: "/evc",
      label: "EVC Operations",
      icon: MapPinned,
      roles: ["REGIONAL_OFFICER", "EVC_MEMBER", "COMPLIANCE_HEAD"],
      count: counts.evc,
      countTone: "warning",
    },
    {
      href: "/compliance",
      label: role === "INSTITUTION_ADMIN" ? "Compliance & Renewals" : "Compliance Register",
      icon: FileCheck2,
      roles: ["INSTITUTION_ADMIN", "REGIONAL_OFFICER", "COMPLIANCE_HEAD", "BUREAU_OFFICER"],
    },
    {
      href: "/escalations",
      label: "SLA & Escalations",
      icon: TriangleAlert,
      roles: ["REGIONAL_OFFICER", "COMPLIANCE_HEAD", "BUREAU_OFFICER"],
      count: counts.escalations,
      countTone: "danger",
    },
  ];

  const telemetry: NavItem[] = [
    {
      href: "/journey",
      label: "Case Journey",
      icon: Route,
      roles: ALL_ROLES,
      tag: "START",
    },
    {
      href: "/wall",
      label: "National Command Wall",
      icon: Radar,
      roles: ALL_ROLES,
      tag: "LIVE",
    },
    {
      href: "/simulator",
      label: "APH Digital Twin",
      icon: FlaskConical,
      roles: ALL_ROLES,
    },
  ];

  const assurance: NavItem[] = [
    {
      href: "/audit",
      label: "Immutable Audit Ledger",
      icon: ShieldCheck,
      roles: ALL_ROLES,
    },
  ];

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  }

  function changeTenant(value: string) {
    startTransition(async () => {
      await switchTenantAction(value);
      router.refresh();
    });
  }

  return (
    <aside className="no-print sidebar-scroll sticky top-[103px] hidden h-[calc(100vh-103px)] w-[252px] shrink-0 flex-col overflow-y-auto border-r border-navy-900 bg-navy-950 text-white lg:flex">
      <div className="border-b border-white/10 p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[8px] font-semibold uppercase tracking-wider2 text-navy-400">
            Active authority
          </span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-brass-300/40 bg-white/[0.04] font-mono text-2xs font-semibold text-brass-200">
            {initials(userName)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold leading-tight text-white">{userName}</div>
            <div className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-navy-300">
              {designation ?? ROLE_META[role].summary}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="border border-brass-400/30 bg-brass-400/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-label text-brass-200">
            {ROLE_META[role].label}
          </span>
          <span className="border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-label text-navy-300">
            Demo identity
          </span>
        </div>
      </div>

      {role === "INSTITUTION_ADMIN" && (
        <div className="border-b border-white/10 px-4 py-3">
          <label
            htmlFor="tenant-context"
            className="mb-1.5 flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-wider2 text-navy-400"
          >
            <Building2 size={10} />
            Institution context
          </label>
          <div className="relative">
            <select
              id="tenant-context"
              className="h-8 w-full cursor-pointer appearance-none border border-white/15 bg-navy-900 pl-2 pr-7 text-2xs font-medium text-white outline-none hover:border-white/30 focus:border-brass-400 disabled:opacity-60"
              value={tenant?.id ?? ""}
              onChange={(event) => changeTenant(event.target.value)}
              disabled={pending}
            >
              {tenants.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.code} · {institution.name}
                </option>
              ))}
            </select>
            {pending ? (
              <Loader2
                size={11}
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-brass-300"
              />
            ) : (
              <ChevronsUpDown
                size={11}
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-navy-400"
              />
            )}
          </div>
          <p className="mt-1.5 text-[9px] leading-snug text-navy-500">
            Tenant-scoped access. Filing visibility and evidence rights follow this institution.
          </p>
        </div>
      )}

      <nav aria-label="Platform modules" className="flex-1 py-3">
        <div className="flex items-center gap-2 px-4 pb-1.5 text-[8px] font-semibold uppercase tracking-wider2 text-navy-500">
          <span>Operational command</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
        {operations
          .filter((item) => item.roles.includes(role))
          .map((item) => (
            <NavRow key={item.href} item={item} active={isActive(item.href)} />
          ))}

        <div className="flex items-center gap-2 px-4 pb-1.5 pt-4 text-[8px] font-semibold uppercase tracking-wider2 text-navy-500">
          <span>Telemetry &amp; showcase</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
        {telemetry
          .filter((item) => item.roles.includes(role))
          .map((item) => (
            <NavRow key={item.href} item={item} active={isActive(item.href)} />
          ))}

        <div className="flex items-center gap-2 px-4 pb-1.5 pt-4 text-[8px] font-semibold uppercase tracking-wider2 text-navy-500">
          <span>Assurance</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
        {assurance
          .filter((item) => item.roles.includes(role))
          .map((item) => (
            <NavRow key={item.href} item={item} active={isActive(item.href)} />
          ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-wider2 text-navy-400">
          <MapPin size={9} />
          Jurisdiction
        </div>
        <div className="flex items-start gap-2 border border-white/10 bg-white/[0.03] p-2">
          {role === "INSTITUTION_ADMIN" ? (
            <Building2 size={12} className="mt-0.5 shrink-0 text-brass-300" />
          ) : role === "COMPLIANCE_HEAD" || role === "BUREAU_OFFICER" ? (
            <Globe2 size={12} className="mt-0.5 shrink-0 text-brass-300" />
          ) : (
            <MapPin size={12} className="mt-0.5 shrink-0 text-brass-300" />
          )}
          <div className="min-w-0">
            <div className="truncate text-[10px] font-medium text-white">
              {role === "INSTITUTION_ADMIN"
                ? tenant?.name ?? "Institution tenant"
                : role === "REGIONAL_OFFICER"
                  ? region
                    ? REGION_META[region as Region].label
                    : ROLE_META[role].scope
                  : role === "EVC_MEMBER"
                    ? region
                      ? `${REGION_META[region as Region].label} · Committee`
                      : "Committee pool"
                    : ROLE_META[role].scope}
            </div>
            <div className="mt-0.5 text-[9px] text-navy-400">
              {role === "INSTITUTION_ADMIN"
                ? tenant?.code ?? "No tenant selected"
                : role === "COMPLIANCE_HEAD" || role === "BUREAU_OFFICER"
                  ? "All five AICTE regions"
                  : role === "REGIONAL_OFFICER"
                    ? region
                      ? `${REGION_META[region as Region].hq} regional office`
                      : "AICTE field operations"
                    : "Approved EVC roster"}
            </div>
          </div>
        </div>
      </div>

      <Link
        href="/audit"
        className="mx-3 mb-3 block border border-white/10 bg-white/[0.03] p-2.5 transition hover:border-brass-400/40 hover:bg-white/[0.05]"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[8px] font-semibold uppercase tracking-wider2 text-navy-300">
            Audit ledger
          </span>
          {ledger.valid ? (
            <ShieldCheck size={12} className="text-emerald-400" />
          ) : (
            <ShieldAlert size={12} className="text-red-400" />
          )}
        </div>
        <div
          className={`mt-1 text-[9px] font-semibold uppercase tracking-label ${
            ledger.valid ? "text-emerald-300" : "text-red-300"
          }`}
        >
          {ledger.valid ? "Chain verified" : "Integrity alert"}
        </div>
        <div className="mt-0.5 truncate font-mono text-[8px] text-navy-500">
          {ledger.entries} entries · {ledger.headHash ? truncateHash(ledger.headHash, 6, 4) : "genesis"}
        </div>
      </Link>
    </aside>
  );
}

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const showCount = typeof item.count === "number" && item.count > 0;

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-2.5 border-l-2 px-4 py-[7px] text-[11px] font-medium transition-colors duration-150 ${
        active
          ? "border-brass-400 bg-gradient-to-r from-white/[0.11] to-white/[0.03] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
          : "border-transparent text-navy-200 hover:bg-white/[0.05] hover:text-white"
      }`}
    >
      <Icon
        size={14}
        strokeWidth={1.7}
        aria-hidden="true"
        className={active ? "text-brass-300" : "text-navy-400 group-hover:text-navy-200"}
      />
      <span className="flex-1 truncate">{item.label}</span>
      {item.tag && (
        <span className="border border-brass-400/40 bg-brass-400/10 px-1 py-0.5 font-mono text-[7px] font-semibold text-brass-200">
          {item.tag}
        </span>
      )}
      {showCount && (
        <span
          className={`min-w-[16px] px-1 py-0.5 text-center font-mono text-[8px] font-semibold ${
            item.countTone === "danger"
              ? "bg-red-500/90 text-white"
              : item.countTone === "warning"
                ? "bg-amber-400/90 text-navy-950"
                : "bg-white/10 text-white"
          }`}
        >
          {item.count}
        </span>
      )}
    </Link>
  );
}
