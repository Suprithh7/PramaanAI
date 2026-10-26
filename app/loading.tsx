export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-5">
      <span className="sr-only">Loading workspace</span>

      <div className="border-b border-slate-300/80 pb-5">
        <div className="skeleton h-2.5 w-32" />
        <div className="skeleton mt-3 h-8 w-72 max-w-full" />
        <div className="skeleton mt-3 h-3 w-full max-w-2xl" />
        <div className="skeleton mt-2 h-3 w-2/3 max-w-xl" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="panel border-t-2 border-t-slate-300 p-3.5">
            <div className="skeleton h-2.5 w-20" />
            <div className="skeleton mt-3 h-7 w-16" />
            <div className="skeleton mt-2.5 h-2.5 w-full" />
          </div>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="panel p-4 xl:col-span-8">
          <div className="skeleton h-3 w-40" />
          <div className="mt-4 space-y-2.5">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="skeleton h-7 w-7 shrink-0" />
                <div className="skeleton h-3 flex-1" />
                <div className="skeleton h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
        <div className="panel p-4 xl:col-span-4">
          <div className="skeleton h-3 w-32" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index}>
                <div className="skeleton h-2.5 w-full" />
                <div className="skeleton mt-1.5 h-1.5 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
