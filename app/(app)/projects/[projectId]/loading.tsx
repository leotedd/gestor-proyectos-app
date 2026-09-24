import { Skeleton } from "@/components/ui/skeleton";

// Se muestra al instante al cambiar de módulo (el layout del proyecto y el
// sidebar permanecen); el contenido real llega en streaming.
export default function ProjectModuleLoading() {
  return (
    <div className="px-6 py-6 space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[68px] rounded-xl" />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
