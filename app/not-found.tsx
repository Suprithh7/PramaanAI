import { ArrowLeft, Compass, Search } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col justify-center py-16">
      <div className="panel border-t-2 border-t-brass-500 p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-brass-200 bg-brass-50 text-brass-700">
            <Compass size={18} />
          </span>
          <div className="min-w-0">
            <div className="eyebrow text-brass-700">404 · Route unresolved</div>
            <h1 className="mt-1.5 font-serif text-[24px] font-semibold leading-tight text-navy-950">
              This workspace does not exist
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              The link may be outdated, or the filing may have moved outside your jurisdiction.
              Return to the command centre to reopen the register.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <Link href="/" className="btn btn-primary">
            <ArrowLeft size={11} /> Command centre
          </Link>
          <Link href="/applications" className="btn btn-outline">
            <Search size={11} /> Application register
          </Link>
        </div>
      </div>
    </div>
  );
}
