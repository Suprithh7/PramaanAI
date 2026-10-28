"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/applications", label: "Applications" },
  { href: "/pre-check", label: "Pre-check" },
  { href: "/scrutiny", label: "Officer review" },
  { href: "/inspections", label: "Inspections" },
  { href: "/documents", label: "Documents" },
  { href: "/audit", label: "Audit trail" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className="border-b border-slate-300 bg-white">
      <div className="mx-auto flex max-w-[1400px] items-stretch gap-0 overflow-x-auto px-2 sm:px-4">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative whitespace-nowrap px-3 py-3 text-sm font-semibold transition-colors sm:px-4 ${
                active
                  ? "text-navy-950 after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:bg-brass-500"
                  : "text-slate-600 hover:bg-slate-50 hover:text-navy-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
