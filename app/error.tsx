"use client";

import { AlertTriangle, ArrowRight, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-xl flex-col justify-center py-16">
      <div className="panel border-t-2 border-t-red-600 p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-red-200 bg-red-50 text-red-700">
            <AlertTriangle size={18} />
          </span>
          <div className="min-w-0">
            <div className="eyebrow text-red-700">Workspace interruption</div>
            <h1 className="mt-1.5 font-serif text-[24px] font-semibold leading-tight text-navy-950">
              This view could not be assembled
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              The case data may have changed while the page was loading. Retry the request; if the
              interruption persists, return to the command centre and reopen the record.
            </p>
            {error.digest && (
              <p className="mt-2 font-mono text-[9px] text-slate-400">Reference {error.digest}</p>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={reset} className="btn btn-primary">
            <RotateCcw size={11} /> Retry request
          </button>
          <Link href="/" className="btn btn-outline">
            Command centre <ArrowRight size={11} />
          </Link>
        </div>
      </div>
    </div>
  );
}
