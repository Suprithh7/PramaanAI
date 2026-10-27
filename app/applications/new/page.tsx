import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { fileApplicationAction } from "@/app/actions";
import { FileApplicationForm } from "@/components/applications/FileApplicationForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/db";
import { istYear } from "@/lib/format";
import { getSession } from "@/lib/session";
import { REGION_META, ROLE_META, type Region } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewApplicationPage() {
  const session = await getSession();

  if (session.role !== "INSTITUTION_ADMIN") {
    return (
      <>
        <PageHeader eyebrow="Institutional filings" title="File a new application" />
        <EmptyState
          title="Filing is restricted to institution administrators"
          description={`The active identity is ${ROLE_META[session.role].label}. Switch the active role to Institution Admin to file on behalf of an institution.`}
          icon={<ShieldAlert size={16} />}
        >
          <Link href="/applications" className="btn btn-outline">
            <ArrowLeft size={11} /> Back to the register
          </Link>
        </EmptyState>
      </>
    );
  }

  const institution = session.tenant
    ? await prisma.institution.findUnique({
        where: { id: session.tenant.id },
        select: { id: true, name: true, code: true, region: true, city: true, state: true },
      })
    : null;

  if (!institution) {
    return (
      <>
        <PageHeader eyebrow="Institutional filings" title="File a new application" />
        <EmptyState
          title="No institution context selected"
          description="Select the institution context in the sidebar before filing an application."
          icon={<ShieldAlert size={16} />}
        >
          <Link href="/applications" className="btn btn-outline">
            <ArrowLeft size={11} /> Back to the register
          </Link>
        </EmptyState>
      </>
    );
  }

  const region = REGION_META[institution.region as Region];
  const series = `AICTE/APH/${istYear()}/${region?.code ?? "NR"}/`;

  return (
    <>
      <PageHeader
        eyebrow="Institutional filings"
        title="File a new application"
        breadcrumbs={[
          { label: "Application register", href: "/applications" },
          { label: "New filing" },
        ]}
        description={`Filing on behalf of ${institution.name}. Every figure below is declared by the institution; the APH matrix and scrutiny brief are produced from those figures the moment the case is filed.`}
        meta={
          <>
            <span className="badge border-navy-300 bg-navy-50 text-navy-900">{institution.code}</span>
            <span className="text-[10px] text-slate-600">{region?.label ?? institution.region}</span>
            <span className="text-[10px] text-slate-600">
              {institution.city}, {institution.state}
            </span>
            <span className="font-mono text-[10px] text-slate-500">{series}####</span>
          </>
        }
        actions={
          <Link href="/applications" className="btn btn-outline">
            <ArrowLeft size={11} /> Back to the register
          </Link>
        }
      />

      <FileApplicationForm
        action={fileApplicationAction}
        institutionName={institution.name}
        series={series}
        regionLabel={region?.label ?? institution.region}
      />
    </>
  );
}
