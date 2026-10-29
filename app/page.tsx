import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Clock,
  FileSearch,
  Fingerprint,
  MapPin,
  Play,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { getLedgerIntegritySummary } from "@/lib/audit";
import { activeApps, ruleStats, slaRows } from "@/lib/analytics";
import { prisma } from "@/lib/db";
import { getPortfolio } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge, SlaBadge } from "@/components/ui/Badges";
import { shortRef } from "@/lib/format";

export const dynamic = "force-dynamic";

const PROBLEMS = [
  {
    title: "Colleges wait months for an answer",
    body: "Files move between desks by hand. Nobody can tell a college where its application is or what is holding it up.",
  },
  {
    title: "The same rulebook is checked by eye",
    body: "Officers manually check faculty ratios, land area and certificate dates across thousands of pages. Mistakes and delays follow.",
  },
  {
    title: "Fake or reused documents get through",
    body: "A scanned certificate can be edited, or copied from another college, and still look valid on paper.",
  },
];

const SOLUTIONS = [
  {
    icon: ScrollText,
    title: "Rule checks in seconds",
    body: "Every application is tested against the AICTE rulebook automatically. Officers see the exact rule, the declared figure and the shortfall.",
    href: "/scrutiny",
    link: "See an officer review",
  },
  {
    icon: FileSearch,
    title: "Pre-check before you apply",
    body: "Colleges can enter their numbers and dates and see which rules will fail — before spending weeks on a rejected file.",
    href: "/pre-check",
    link: "Try the pre-check",
  },
  {
    icon: Fingerprint,
    title: "Documents that can be trusted",
    body: "Each PDF is fingerprinted. If a certificate is edited or copied from another college, the system flags it immediately.",
    href: "/documents",
    link: "Open document checks",
  },
  {
    icon: MapPin,
    title: "Inspections that really happened",
    body: "Inspectors must be inside a 750 m radius of the campus to file a report. Location, time and findings are locked together.",
    href: "/inspections",
    link: "See an inspection",
  },
  {
    icon: ShieldCheck,
    title: "An audit trail nobody can rewrite",
    body: "Every action is sealed to the one before it. Change a record and every later record stops matching — instantly visible to auditors.",
    href: "/audit",
    link: "Test the audit trail",
  },
  {
    icon: Clock,
    title: "Deadlines that escalate themselves",
    body: "Cases that cross a statutory deadline are escalated and penalised automatically, without waiting for a reminder.",
    href: "/applications",
    link: "See live deadlines",
  },
];

const STEPS = [
  {
    title: "College files online",
    body: "One form declares intake, faculty, land and the four mandatory certificates.",
  },
  {
    title: "Rules are checked instantly",
    body: "The system passes or flags each AICTE rule with the exact number that failed.",
  },
  {
    title: "Documents are verified",
    body: "Each document is fingerprinted, compared with the declared figures and cross-checked for reuse.",
  },
  {
    title: "Inspector visits campus",
    body: "An inspector files a location-stamped report; conflicts of interest are blocked before the visit.",
  },
  {
    title: "Decision is recorded",
    body: "Approval or rejection is written to a tamper-evident ledger with a printable order.",
  },
];

export default async function DashboardPage() {
  const session = await getSession();
  const [apps, institutions, documents, evidence, integrity] = await Promise.all([
    getPortfolio(session),
    prisma.institution.count(),
    prisma.complianceDocument.count(),
    prisma.evidenceFile.count(),
    getLedgerIntegritySummary(),
  ]);

  const active = activeApps(apps);
  const rules = ruleStats(apps);
  const deadlines = slaRows(apps);
  const breached = deadlines.filter((row) => row.sla === "BREACHED").length;
  const warning = deadlines.filter((row) => row.sla === "WARNING").length;
  const priority = deadlines.slice(0, 5);
  const demoCase = apps.find((app) => app.id === "app_biem_mech") ?? apps[0] ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Smart India Hackathon · AICTE problem statement"
        title="College approvals take months. PRAMAAN makes them take days."
        description="AICTE receives thousands of college approval applications every year. Each one is checked by hand against the Approval Process Handbook — a long list of rules on faculty, land, buildings and safety certificates. PRAMAAN turns that paper chase into one transparent, auditable workflow."
        actions={
          <>
            {demoCase && (
              <Link href={`/applications/${demoCase.id}`} className="btn btn-primary">
                <Play size={13} /> Run the demo
              </Link>
            )}
            <Link href="/pre-check" className="btn btn-outline">
              <BadgeCheck size={13} /> Try pre-check
            </Link>
          </>
        }
        meta={
          <>
            <span className="badge border-navy-300 bg-navy-50 text-navy-900">
              {institutions} colleges
            </span>
            <span className="badge border-slate-300 bg-white text-slate-700">
              {documents.toLocaleString("en-IN")} statutory documents
            </span>
            <span className="badge border-slate-300 bg-white text-slate-700">
              {evidence} PDFs on file
            </span>
            <span className="badge border-emerald-300 bg-emerald-50 text-emerald-900">
              {integrity.valid ? "Audit trail intact" : "Audit alert"}
            </span>
          </>
        }
      />

      <section className="mb-6 overflow-hidden bg-navy-950 text-white">
        <div className="grid gap-px bg-white/10 lg:grid-cols-3">
          {PROBLEMS.map((problem, index) => (
            <div key={problem.title} className="bg-navy-950 px-5 py-5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center bg-brass-500 font-mono text-xs font-bold text-navy-950">
                  {index + 1}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-label text-brass-200">
                  The problem
                </span>
              </div>
              <h2 className="mt-2.5 font-serif text-lg font-semibold leading-snug">{problem.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-navy-200">{problem.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="eyebrow">What PRAMAAN does</div>
            <h2 className="mt-1 font-serif text-2xl font-semibold text-navy-950">
              One system, from application to approval
            </h2>
          </div>
          <p className="max-w-md text-sm text-slate-600">
            Every claim in this prototype is live and clickable. Open any card to see it working.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SOLUTIONS.map((solution) => {
            const Icon = solution.icon;
            return (
              <Link
                key={solution.title}
                href={solution.href}
                className="panel group flex flex-col p-4 transition hover:-translate-y-0.5 hover:border-navy-400 hover:shadow-panel-lift"
              >
                <span className="flex h-9 w-9 items-center justify-center bg-navy-50 text-navy-800">
                  <Icon size={17} />
                </span>
                <h3 className="mt-3 font-serif text-lg font-semibold leading-snug text-navy-950">
                  {solution.title}
                </h3>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-600">{solution.body}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-navy-800 group-hover:text-brass-700">
                  {solution.link} <ArrowRight size={12} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mb-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div className="panel flex flex-col">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Live now</div>
              <h2 className="panel-title mt-0.5">The national queue</h2>
            </div>
            <Link href="/applications" className="btn btn-outline btn-xs">
              All applications
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-4">
            {[
              { label: "Open cases", value: active.length, tone: "text-navy-950" },
              { label: "Rules passed", value: `${rules.rate}%`, tone: "text-emerald-700" },
              { label: "Past deadline", value: breached, tone: "text-red-700" },
              { label: "Due soon", value: warning, tone: "text-amber-700" },
            ].map((stat) => (
              <div key={stat.label} className="bg-white px-4 py-4">
                <div className={`font-serif text-3xl font-semibold leading-none ${stat.tone}`}>
                  {stat.value}
                </div>
                <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-label text-slate-500">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-3 text-sm leading-relaxed text-slate-600">
            {breached > 0
              ? `${breached} case${breached === 1 ? " is" : "s are"} past the statutory deadline. The system escalates automatically and applies penalty points.`
              : "Every open case is inside its statutory deadline."}{" "}
            The average file still passes {rules.passed} of {rules.total} rule checks on the declared record.
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Watch here first</div>
              <h2 className="panel-title mt-0.5">Cases that need attention</h2>
            </div>
            <Link href="/scrutiny" className="btn btn-outline btn-xs">
              Officer view
            </Link>
          </div>
          {priority.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">No open cases in this view.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table min-w-[520px]">
                <thead>
                  <tr>
                    <th>Case</th>
                    <th>Status</th>
                    <th>Deadline</th>
                  </tr>
                </thead>
                <tbody>
                  {priority.map(({ app, days, sla }) => (
                    <tr key={app.id}>
                      <td>
                        <Link href={`/applications/${app.id}`} className="block group">
                          <div className="text-sm font-semibold text-navy-950 group-hover:text-brass-700">
                            {app.institution.name}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            {shortRef(app.referenceNo)} · {app.programName}
                          </div>
                        </Link>
                      </td>
                      <td>
                        <StatusBadge status={app.status} />
                      </td>
                      <td>
                        <SlaBadge status={sla} days={days} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-3">
          <div className="eyebrow">How it works</div>
          <h2 className="mt-1 font-serif text-2xl font-semibold text-navy-950">
            Five steps, all visible to the college
          </h2>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((step, index) => (
            <li key={step.title} className="panel p-4">
              <div className="font-mono text-xs font-semibold text-brass-700">
                STEP {index + 1}
              </div>
              <div className="mt-2 font-serif text-base font-semibold text-navy-950">{step.title}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel overflow-hidden border-t-4 border-t-brass-500">
        <div className="grid gap-px bg-slate-200 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="bg-white p-5">
            <div className="flex items-center gap-2">
              <Play size={16} className="text-brass-600" />
              <h2 className="font-serif text-xl font-semibold text-navy-950">
                The five-minute demo route
              </h2>
            </div>
            <p className="mt-1.5 text-sm text-slate-600">
              Follow these five clicks and you will see every core claim in this prototype.
            </p>
            <ol className="mt-4 space-y-2.5">
              {[
                {
                  label: "A rule catches a real shortfall",
                  detail: "Open the BIEM Mechanical case and read the failing rule with exact numbers.",
                  href: "/applications/app_biem_mech?tab=rules",
                },
                {
                  label: "A certificate copied from another college is caught",
                  detail: "The document check compares fingerprints across all colleges.",
                  href: "/documents",
                },
                {
                  label: "An inspection that happened off-campus is blocked",
                  detail: "Try to file a report from outside the 750 m campus radius.",
                  href: "/inspections",
                },
                {
                  label: "The audit trail detects tampering",
                  detail: "Edit a record in the database and watch the chain break.",
                  href: "/audit",
                },
                {
                  label: "A college fixes its numbers before applying",
                  detail: "Move the sliders and see rules turn from red to green.",
                  href: "/pre-check",
                },
              ].map((item, index) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="group flex items-start gap-3 border border-slate-200 px-3 py-2.5 transition hover:border-navy-400 hover:bg-navy-50/40"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center bg-navy-900 font-mono text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-navy-950 group-hover:text-brass-700">
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                        {item.detail}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
          <div className="bg-navy-950 p-5 text-white">
            <div className="flex items-center gap-2 text-brass-300">
              <Building2 size={15} />
              <span className="text-[11px] font-semibold uppercase tracking-label">
                Why this holds up
              </span>
            </div>
            <h3 className="mt-2 font-serif text-xl font-semibold">
              Four guarantees, every single time
            </h3>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-navy-200">
              {[
                {
                  title: "The rule check cannot be argued with",
                  body: "The same declared numbers always produce the same verdict, with the failing rule and the exact shortfall printed for both sides.",
                },
                {
                  title: "A copied document cannot pass twice",
                  body: "Every upload is fingerprinted. If the same file appears under two colleges, both cases are flagged with the names of both.",
                },
                {
                  title: "An inspection cannot be faked",
                  body: "The inspector must be inside a 750 m campus radius, declare any conflict of interest, and file a time-stamped report.",
                },
                {
                  title: "No record can be quietly edited",
                  body: "Each action is sealed to the one before it. Any change to history is caught the moment the ledger is read.",
                },
              ].map((item) => (
                <li key={item.title} className="flex gap-2.5">
                  <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-400" />
                  <span>
                    <span className="block font-semibold text-white">{item.title}</span>
                    <span className="mt-0.5 block text-[13px] text-navy-300">{item.body}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-5 border-t border-white/10 pt-3 text-xs leading-relaxed text-navy-300">
              Everything here runs offline on this machine — no API key, no external service.{" "}
              <span className="text-navy-200">{integrity.entries} sealed audit entries.</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
