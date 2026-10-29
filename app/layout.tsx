import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import type { ReactNode } from "react";
import { Topbar } from "@/components/Topbar";
import { getLedgerIntegritySummary } from "@/lib/audit";
import { getSession } from "@/lib/session";
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
    default: "PRAMAAN · AICTE approvals, start to finish",
    template: "%s · PRAMAAN",
  },
  description:
    "One place for AICTE college approvals: automatic rule checks, verifiable documents, campus inspections and a tamper-evident audit trail.",
  applicationName: "PRAMAAN",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0e2033",
  colorScheme: "light",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  const integrity = await getLedgerIntegritySummary();

  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body className="flex min-h-screen flex-col font-sans">
        <a href="#main-content" className="skip-link btn btn-primary">
          Skip to content
        </a>
        <Topbar session={session} ledgerValid={integrity.valid} />
        <main id="main-content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">
          <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 lg:px-6 lg:py-8">
            {children}
          </div>
          <footer className="no-print mt-auto border-t border-slate-300 bg-white/70">
            <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-1.5 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-6">
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 bg-emerald-600" aria-hidden="true" />
                PRAMAAN · built for AICTE · every action is recorded
              </span>
              <span className="flex flex-wrap items-center gap-2 font-mono">
                <span>Audit record</span>
                <span className="text-slate-300">|</span>
                <span>{integrity.entries} entries</span>
                <span className="text-slate-300">|</span>
                <span>latest code {integrity.headHash ? truncateHash(integrity.headHash, 8, 6) : "genesis"}</span>
              </span>
            </div>
          </footer>
        </main>
      </body>
    </html>
  );
}
