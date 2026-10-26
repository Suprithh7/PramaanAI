import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1.5 text-3xs text-slate-500">
      <Link href="/" className="inline-flex items-center gap-1 transition hover:text-navy-800">
        <Home size={10} />
        <span className="sr-only">Home</span>
      </Link>
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
          <ChevronRight size={10} className="text-slate-300" />
          {item.href ? (
            <Link href={item.href} className="transition hover:text-navy-800">
              {item.label}
            </Link>
          ) : (
            <span className={index === items.length - 1 ? "text-slate-700" : ""}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  breadcrumbs,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  breadcrumbs?: Crumb[];
}) {
  return (
    <div className="mb-6">
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-col gap-4 border-b border-slate-300/90 pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-px w-5 shrink-0 bg-brass-500" />
            <span className="eyebrow text-slate-600">{eyebrow}</span>
          </div>
          <h1 className="mt-2 font-serif text-[26px] font-semibold leading-[1.08] tracking-[-0.015em] text-navy-950 sm:text-[30px]">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-3xl text-[12.5px] leading-6 text-slate-600">{description}</p>
          )}
          {meta && <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
