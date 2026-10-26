"use client";

import {
  ArrowUpRight,
  CornerDownLeft,
  FileCheck2,
  Files,
  FlaskConical,
  LayoutDashboard,
  Loader2,
  MapPinned,
  Radar,
  Route,
  ScanSearch,
  Search,
  ShieldCheck,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { shortRef } from "@/lib/format";
import { statusMeta, type Role } from "@/lib/types";

const ALL_ROLES: Role[] = [
  "INSTITUTION_ADMIN",
  "REGIONAL_OFFICER",
  "EVC_MEMBER",
  "COMPLIANCE_HEAD",
  "BUREAU_OFFICER",
];

type NavEntry = {
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  roles: Role[];
};

const NAV: NavEntry[] = [
  {
    href: "/journey",
    label: "Case journey",
    hint: "One filing from scrutiny to council order, step by step",
    icon: Route,
    roles: ALL_ROLES,
  },
  {
    href: "/",
    label: "Command centre",
    hint: "National compliance overview",
    icon: LayoutDashboard,
    roles: ALL_ROLES,
  },
  {
    href: "/wall",
    label: "National Command Wall",
    hint: "Live regional telemetry and SLA pressure",
    icon: Radar,
    roles: ALL_ROLES,
  },
  {
    href: "/simulator",
    label: "APH Digital Twin",
    hint: "Simulate scrutiny before filing",
    icon: FlaskConical,
    roles: ALL_ROLES,
  },
  {
    href: "/applications",
    label: "Application register",
    hint: "Filings, stages and statutory clocks",
    icon: Files,
    roles: ALL_ROLES,
  },
  {
    href: "/scrutiny",
    label: "Scrutiny desk",
    hint: "APH rule validation queue",
    icon: ScanSearch,
    roles: ["REGIONAL_OFFICER", "COMPLIANCE_HEAD", "BUREAU_OFFICER"],
  },
  {
    href: "/evc",
    label: "EVC operations",
    hint: "Inspection scheduling and site reports",
    icon: MapPinned,
    roles: ["REGIONAL_OFFICER", "EVC_MEMBER", "COMPLIANCE_HEAD"],
  },
  {
    href: "/compliance",
    label: "Compliance register",
    hint: "Document exposure and renewals",
    icon: FileCheck2,
    roles: ["INSTITUTION_ADMIN", "REGIONAL_OFFICER", "COMPLIANCE_HEAD", "BUREAU_OFFICER"],
  },
  {
    href: "/escalations",
    label: "SLA & escalations",
    hint: "Breach matrix, penalties and escalation",
    icon: TriangleAlert,
    roles: ["REGIONAL_OFFICER", "COMPLIANCE_HEAD", "BUREAU_OFFICER"],
  },
  {
    href: "/audit",
    label: "Immutable audit ledger",
    hint: "Verify the SHA-256 event chain",
    icon: ShieldCheck,
    roles: ALL_ROLES,
  },
];

type SearchHit = {
  id: string;
  referenceNo: string;
  institution: string;
  institutionCode: string;
  state: string;
  status: string;
  statusLabel: string;
  pathLabel: string;
};

type PaletteRow = {
  key: string;
  group: "nav" | "app";
  label: string;
  hint: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  tone?: string;
};

function navLabel(entry: NavEntry, role: Role) {
  if (role !== "INSTITUTION_ADMIN") return entry.label;
  if (entry.href === "/") return "Institution home";
  if (entry.href === "/applications") return "My applications";
  if (entry.href === "/compliance") return "Compliance & renewals";
  return entry.label;
}

export function CommandPalette({ role }: { role: Role }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setQuery("");
    setHits([]);
    setActive(0);
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      document.body.style.overflow = previous;
      cancelAnimationFrame(frame);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const needle = query.trim();
    if (needle.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(needle)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Search failed");
        const payload = (await response.json()) as { applications: SearchHit[] };
        if (!cancelled) setHits(payload.applications);
      } catch (error) {
        if (!cancelled && !(error instanceof DOMException && error.name === "AbortError")) {
          setHits([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, query]);

  useEffect(() => {
    setActive(0);
  }, [query, hits.length]);

  const needle = query.trim().toLowerCase();
  const rows = useMemo<PaletteRow[]>(() => {
    const navRows = NAV.filter((entry) => entry.roles.includes(role))
      .filter((entry) => {
        if (!needle) return true;
        return `${navLabel(entry, role)} ${entry.hint}`.toLowerCase().includes(needle);
      })
      .map((entry) => ({
        key: `nav-${entry.href}`,
        group: "nav" as const,
        label: navLabel(entry, role),
        hint: entry.hint,
        href: entry.href,
        icon: entry.icon,
      }));

    const appRows = hits.map((hit) => ({
      key: `app-${hit.id}`,
      group: "app" as const,
      label: `${shortRef(hit.referenceNo)} · ${hit.institution}`,
      hint: `${hit.institutionCode} · ${hit.state} · ${hit.pathLabel}`,
      href: `/applications/${hit.id}`,
      icon: Files,
      badge: hit.statusLabel,
      tone: statusMeta(hit.status).tone,
    }));

    return [...navRows, ...appRows];
  }, [hits, needle, role]);

  const activeIndex = rows.length === 0 ? 0 : Math.min(active, rows.length - 1);
  const navRows = rows.filter((row) => row.group === "nav");
  const appRows = rows.filter((row) => row.group === "app");

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((current) =>
          rows.length === 0 ? 0 : (Math.min(current, rows.length - 1) + 1) % rows.length,
        );
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((current) =>
          rows.length === 0 ? 0 : (Math.max(current, 0) - 1 + rows.length) % rows.length,
        );
      } else if (event.key === "Enter") {
        const row = rows[activeIndex];
        if (row) {
          event.preventDefault();
          go(row.href);
        }
      } else if (event.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusable = [
          ...dialog.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ].filter((element) => element.offsetParent !== null);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, close, go, open, rows]);

  function renderRow(row: PaletteRow) {
    const index = rows.indexOf(row);
    const selected = index === activeIndex;
    const Icon = row.icon;
    const tone = row.tone ?? "border-slate-300 bg-slate-50 text-slate-700";

    return (
      <button
        key={row.key}
        id={`command-row-${index}`}
        type="button"
        role="option"
        aria-selected={selected}
        onMouseEnter={() => setActive(index)}
        onClick={() => go(row.href)}
        className={`flex w-full items-center gap-2.5 border-l-2 px-3 py-2 text-left transition-colors ${
          selected
            ? "border-brass-500 bg-navy-50/80"
            : "border-transparent hover:bg-slate-50"
        }`}
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center border ${
            selected
              ? "border-navy-200 bg-white text-navy-800"
              : "border-slate-200 bg-slate-50 text-slate-500"
          }`}
        >
          <Icon size={13} strokeWidth={1.8} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] font-semibold text-navy-950">{row.label}</span>
          <span className="mt-0.5 block truncate text-[9px] text-slate-500">{row.hint}</span>
        </span>
        {row.badge ? (
          <span className={`badge shrink-0 text-[8px] ${tone}`}>{row.badge}</span>
        ) : selected ? (
          <CornerDownLeft size={11} className="shrink-0 text-brass-600" />
        ) : (
          <ArrowUpRight size={11} className="shrink-0 text-slate-300" />
        )}
      </button>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
        className="hidden h-8 items-center gap-2 border border-slate-300 bg-white px-2.5 text-3xs font-medium text-slate-500 transition-colors hover:border-navy-400 hover:text-navy-800 md:inline-flex"
      >
        <Search size={12} className="text-slate-400" />
        <span className="hidden lg:inline">Search</span>
        <span className="kbd ml-0.5 hidden lg:inline-flex">Ctrl K</span>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search PRAMAAN"
        aria-haspopup="dialog"
        className="icon-btn md:hidden"
      >
        <Search size={15} />
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] flex animate-fade-in items-start justify-center bg-navy-950/45 px-3 pt-[10vh] backdrop-blur-[2px] sm:px-4 sm:pt-[12vh]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Search PRAMAAN"
            className="w-full max-w-[640px] animate-command-in border border-slate-300 bg-white shadow-command"
          >
            <div className="h-[2px] bg-gradient-to-r from-brass-500 via-brass-300 to-transparent" />
            <div className="flex items-center gap-2 border-b border-slate-200 px-3 transition-colors focus-within:border-brass-400">
              <Search size={15} className="shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls="command-results"
                aria-autocomplete="list"
                aria-activedescendant={rows.length > 0 ? `command-row-${activeIndex}` : undefined}
                aria-label="Search filings, institutions or modules"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search filings, institutions, or jump to a module…"
                className="h-12 min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-ink outline-none placeholder:text-slate-400 focus:ring-0"
                autoComplete="off"
                spellCheck={false}
              />
              {loading && <Loader2 size={13} className="shrink-0 animate-spin text-brass-600" />}
              <button
                type="button"
                onClick={() => close()}
                className="icon-btn h-7 w-7 border-slate-200 text-slate-400"
                aria-label="Close search"
              >
                <X size={12} />
              </button>
            </div>

            <div
              id="command-results"
              role="listbox"
              aria-label="Search results"
              className="max-h-[52vh] overflow-y-auto py-1.5"
            >
              {navRows.length > 0 && (
                <div>
                  <div className="flex items-center justify-between px-4 pb-1 pt-1.5 text-[8px] font-semibold uppercase tracking-wider2 text-slate-400">
                    <span>Jump to</span>
                    <span className="font-mono normal-case tracking-normal text-slate-400">
                      {navRows.length}
                    </span>
                  </div>
                  {navRows.map(renderRow)}
                </div>
              )}

              {appRows.length > 0 && (
                <div className="mt-1 border-t border-slate-100 pt-1">
                  <div className="flex items-center justify-between px-4 pb-1 pt-1.5 text-[8px] font-semibold uppercase tracking-wider2 text-slate-400">
                    <span>Filings</span>
                    <span className="font-mono normal-case tracking-normal text-slate-400">
                      {appRows.length}
                    </span>
                  </div>
                  {appRows.map(renderRow)}
                </div>
              )}

              {query.trim().length >= 2 && !loading && rows.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <Search size={18} className="mx-auto text-slate-300" />
                  <div className="mt-2 text-[11px] font-semibold text-navy-900">
                    No filings match “{query.trim()}”
                  </div>
                  <p className="mx-auto mt-1 max-w-xs text-[10px] leading-relaxed text-slate-500">
                    Try an application reference, institution name, city, state, or programme.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/80 px-3 py-2 text-[9px] uppercase tracking-label text-slate-500">
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="kbd">↑</span>
                  <span className="kbd">↓</span>
                  <span className="ml-0.5">Navigate</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="kbd">↵</span>
                  <span className="ml-0.5">Open</span>
                </span>
                <span className="hidden items-center gap-1 sm:flex">
                  <span className="kbd">Esc</span>
                  <span className="ml-0.5">Close</span>
                </span>
              </span>
              <span className="flex items-center gap-1 font-mono normal-case tracking-normal text-slate-400">
                <ShieldCheck size={9} className="text-emerald-600" />
                Role-scoped
              </span>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
