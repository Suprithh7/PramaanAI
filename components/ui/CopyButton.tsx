"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1 border border-slate-200 bg-white px-1.5 py-1 text-[9px] font-semibold uppercase tracking-label text-slate-600 transition hover:border-navy-300 hover:text-navy-900"
      title="Copy to clipboard"
    >
      {copied ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
      {copied ? "Copied" : label}
    </button>
  );
}
