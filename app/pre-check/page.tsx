import Link from "next/link";
import { FilePlus2, Scale, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PreCheckSimulator } from "@/components/pre-check/PreCheckSimulator";

export const dynamic = "force-dynamic";

export default function PreCheckPage() {
  return (
    <>
      <PageHeader
        eyebrow="Pre-check · open to everyone"
        title="See the rules before you file"
        description="Most applications are sent back because of numbers the college could have checked itself. Move the sliders below and watch each AICTE rule pass or fail in real time — before a single document is uploaded."
        meta={
          <>
            <span className="badge border-navy-300 bg-navy-50 text-navy-900">7 rules</span>
            <span className="text-xs text-slate-600">No login needed to understand it</span>
            <span className="text-xs text-slate-600">Same engine as the real review</span>
          </>
        }
        actions={
          <>
            <Link href="/applications/new" className="btn btn-primary">
              <FilePlus2 size={13} /> File an application
            </Link>
            <Link href="/applications" className="btn btn-outline">
              <SlidersHorizontal size={13} /> See the register
            </Link>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <article className="panel p-4">
          <div className="flex items-center gap-2 text-navy-900">
            <Scale size={16} />
            <h2 className="font-serif text-base font-semibold">The rule is the rule</h2>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
            Ratios, land and document validity come from the Approval Process Handbook. No officer discretion is
            needed to decide whether a number is inside the limit.
          </p>
        </article>
        <article className="panel p-4">
          <div className="flex items-center gap-2 text-navy-900">
            <FilePlus2 size={16} />
            <h2 className="font-serif text-base font-semibold">Fix it before you file</h2>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
            If a rule fails here, the officer will flag it too. Adjusting the intake or appointing teachers now saves
            a full deficiency cycle later.
          </p>
        </article>
        <article className="panel p-4">
          <div className="flex items-center gap-2 text-navy-900">
            <SlidersHorizontal size={16} />
            <h2 className="font-serif text-base font-semibold">Nothing is stored</h2>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
            This page is a calculator. Nothing you type is saved, and no application is created until you press
            &ldquo;File an application&rdquo;.
          </p>
        </article>
      </div>

      <PreCheckSimulator />
    </>
  );
}
