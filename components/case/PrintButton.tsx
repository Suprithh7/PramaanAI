"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print notice" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-primary">
      <Printer size={11} /> {label}
    </button>
  );
}
