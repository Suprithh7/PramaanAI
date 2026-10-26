"use client";

import {
  FileCheck2,
  Files,
  FlaskConical,
  LayoutDashboard,
  MapPinned,
  Radar,
  Route,
  ScanSearch,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/types";

const ALL_ROLES: Role[] = [
  "INSTITUTION_ADMIN",
  "REGIONAL_OFFICER",
  "EVC_MEMBER",
  "COMPLIANCE_HEAD",
  "BUREAU_OFFICER",
];

const MOBILE_ITEMS: Array<{
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
}> = [
  { href: "/", label: "Command", icon: LayoutDashboard, roles: ALL_ROLES },
  { href: "/journey", label: "Journey", icon: Route, roles: ALL_ROLES },
  { href: "/wall", label: "Wall", icon: Radar, roles: ALL_ROLES },
  { href: "/simulator", label: "Twin", icon: FlaskConical, roles: ALL_ROLES },
  { href: "/applications", label: "Applications", icon: Files, roles: ALL_ROLES },
  {
    href: "/scrutiny",
    label: "Scrutiny",
    icon: ScanSearch,
    roles: ["REGIONAL_OFFICER", "COMPLIANCE_HEAD", "BUREAU_OFFICER"],
  },
  {
    href: "/evc",
    label: "EVC",
    icon: MapPinned,
    roles: ["REGIONAL_OFFICER", "EVC_MEMBER", "COMPLIANCE_HEAD"],
  },
  {
    href: "/compliance",
    label: "Compliance",
    icon: FileCheck2,
    roles: ["INSTITUTION_ADMIN", "REGIONAL_OFFICER", "COMPLIANCE_HEAD", "BUREAU_OFFICER"],
  },
  {
    href: "/escalations",
    label: "SLA",
    icon: TriangleAlert,
    roles: ["REGIONAL_OFFICER", "COMPLIANCE_HEAD", "BUREAU_OFFICER"],
  },
  { href: "/audit", label: "Ledger", icon: ShieldCheck, roles: ALL_ROLES },
];

export function MobileNav({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="no-print no-scrollbar sticky top-[103px] z-30 flex gap-1 overflow-x-auto border-b border-slate-300 bg-white/95 px-3 py-1.5 shadow-[0_1px_0_rgba(14,32,51,0.03)] backdrop-blur lg:hidden"
    >
      {MOBILE_ITEMS.filter((item) => item.roles.includes(role)).map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 border px-2.5 text-3xs font-semibold uppercase tracking-label transition-colors ${
              active
                ? "border-navy-900 bg-navy-900 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-600 active:bg-slate-50"
            }`}
          >
            <Icon size={11} strokeWidth={1.8} className={active ? "text-brass-300" : "text-slate-400"} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
