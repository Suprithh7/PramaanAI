import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import type { ReactNode } from "react";
import { MobileNav } from "@/components/MobileNav";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { getLedgerIntegritySummary } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { getSession, getTenantOptions } from "@/lib/session";
import { truncateHash } from "@/lib/format";
import "./globals.css";

export const dynamic = "force-dynamic";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "PRAMAAN · AICTE APH Workflow & Compliance Portal",
    template: "%s · PRAMAAN",
  },
  description:
    "National AICTE Approval Process Handbook workflow automation, APH rule validation, deficiency resolution, EVC oversight and immutable audit ledger.",
  applicationName: "PRAMAAN",
  authors: [{ name: "AICTE · National Informatics Centre" }],
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0e2033",
  colorScheme: "light",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  const tenantId = session.role === "INSTITUTION_ADMIN" ? session.tenant?.id : undefined;

  const [tenants, integrity, openDeficiencies, activeEscalations, pendingEvc] = await Promise.all([
    getTenantOptions(),
    getLedgerIntegritySummary(),
    prisma.deficiencyTicket.count({
      where: {
        status: "OPEN",
        ...(tenantId ? { application: { institutionId: tenantId } } : {}),
      },
    }),
    prisma.escalationTicket.count({
      where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
    }),
    prisma.eVCInspection.count({
      where: {
        siteReportStatus: { in: ["PENDING", "OVERDUE"] },
        application: { status: "EVC_SCHEDULED" },
      },
    }),
  ]);

  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body className="flex min-h-screen flex-col font-sans">
        <a href="#main-content" className="skip-link btn btn-primary">
          Skip to main content
        </a>
        <Topbar session={session} ledgerValid={integrity.valid} />
        <MobileNav role={session.role} />
        <div className="mx-auto flex w-full max-w-[1900px] flex-1 items-stretch">
          <Sidebar
            role={session.role}
            userName={session.user.name}
            designation={session.user.designation}
            region={session.user.region}
            tenant={session.tenant}
            tenants={tenants}
            counts={{
              deficiencies: openDeficiencies,
              escalations: activeEscalations,
              evc: pendingEvc,
            }}
            ledger={{
              valid: integrity.valid,
              entries: integrity.entries,
              headHash: integrity.headHash,
            }}
          />
          <main id="main-content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">
            <div className="flex-1 px-4 py-5 lg:px-6 xl:px-8">{children}</div>
            <footer className="no-print mt-auto border-t border-slate-300/90 bg-white/60">
              <div className="flex flex-col gap-1.5 px-4 py-4 text-[9px] uppercase tracking-label text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-6 xl:px-8">
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 bg-emerald-600" aria-hidden="true" />
                  PRAMAAN · AICTE Approval Process Handbook workflow engine
                </span>
                <span className="flex flex-wrap items-center gap-2 font-mono normal-case tracking-normal">
                  <span>SHA-256 audit chain</span>
                  <span className="text-slate-300">|</span>
                  <span>{integrity.entries} entries</span>
                  <span className="text-slate-300">|</span>
                  <span>head {integrity.headHash ? truncateHash(integrity.headHash, 8, 6) : "genesis"}</span>
                </span>
              </div>
            </footer>
          </main>
        </div>
      </body>
    </html>
  );
}
