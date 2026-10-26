import { ArrowRight, Building2, FlaskConical, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { SimulatorConsole, type SimSeed } from "@/components/simulator/SimulatorConsole";
import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { can, REGION_META, type Region } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "APH Digital Twin",
};

export default async function SimulatorPage() {
  const session = await getSession();

  const institutions = await prisma.institution.findMany({
    where:
      session.role === "INSTITUTION_ADMIN"
        ? { id: session.tenant?.id ?? "__no_tenant__" }
        : {},
    include: {
      documents: { orderBy: { docType: "asc" } },
      applications: {
        orderBy: { submittedAt: "desc" },
        take: 1,
        include: { ruleChecks: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const seeds: SimSeed[] = institutions.map((institution) => {
    const latest = institution.applications[0];
    const checks = latest?.ruleChecks ?? [];
    return {
      id: institution.id,
      name: institution.name,
      code: institution.code,
      state: institution.state,
      region: REGION_META[institution.region as Region]?.label ?? institution.region,
      applicationType: latest?.applicationType ?? "NEW_INSTITUTE",
      totalLandAcres: institution.totalLandAcres,
      builtUpAreaSqM: institution.builtUpAreaSqM,
      facultyCount: institution.facultyCount,
      studentIntake: institution.studentIntake,
      documents: institution.documents.map((doc) => ({
        docType: doc.docType,
        status: doc.status,
        expiryDate: doc.expiryDate.toISOString(),
      })),
      baseline:
        checks.length > 0
          ? {
              passed: checks.filter((check) => check.status === "PASSED").length,
              flagged: checks.filter((check) => check.status === "DEFICIENCY_FLAGGED").length,
              status: latest?.status ?? "UNDER_SCRUTINY",
            }
          : null,
    };
  });

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Command centre", href: "/" },
          { label: "APH digital twin" },
        ]}
        eyebrow="Deterministic what-if engine"
        title="Simulate the scrutiny before you file"
        description="Move the levers that decide an AICTE approval — intake, faculty, built-up area, land and lease tenure — and watch every APH control re-evaluate instantly. This is the same deterministic engine that runs at the scrutiny desk, pointed at a digital twin instead of a live file."
        meta={
          <>
            <span className="badge border-emerald-300 bg-emerald-50 text-emerald-900">
              <ShieldCheck size={9} /> Zero side effects
            </span>
            <span className="flex items-center gap-1 text-[10px] text-slate-600">
              <FlaskConical size={10} className="text-slate-400" />
              Replays the production APH engine
            </span>
            <span className="flex items-center gap-1 text-[10px] text-slate-600">
              <Building2 size={10} className="text-slate-400" />
              {seeds.length} live institution profile{seeds.length === 1 ? "" : "s"} available
            </span>
          </>
        }
        actions={
          <>
            <Link href="/wall" className="btn btn-outline">
              National wall <ArrowRight size={11} />
            </Link>
            {can(session.role, "RUN_APH") && (
              <Link href="/scrutiny" className="btn btn-primary">
                Scrutiny desk <ArrowRight size={11} />
              </Link>
            )}
          </>
        }
      />

      <SimulatorConsole seeds={seeds} nowIso={new Date().toISOString()} />
    </>
  );
}
