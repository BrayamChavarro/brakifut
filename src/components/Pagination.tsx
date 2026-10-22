import Link from "next/link";

import { buildQuery, type QueryValue } from "@/lib/url";

/** Paginacion por enlaces: cada pagina tiene URL propia y es compartible. */
export function Pagination({
  page,
  pageCount,
  action,
  base,
}: {
  page: number;
  pageCount: number;
  action: string;
  base: Record<string, QueryValue>;
}) {
  if (pageCount <= 1) return null;

  const hasPrev = page > 1;
  const hasNext = page < pageCount;

  return (
    <nav
      aria-label="Paginación"
      className="flex items-center justify-between gap-2 pt-2"
    >
      {hasPrev ? (
        <Link
          href={`${action}${buildQuery({ ...base, pagina: page - 1 })}`}
          className="rounded-lg bg-surface-container-low px-3 py-1.5 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
        >
          Anterior
        </Link>
      ) : (
        <span className="rounded-lg px-3 py-1.5 text-label-md text-on-surface-variant/40">
          Anterior
        </span>
      )}

      <span className="text-label-sm text-on-surface-variant">
        Página {page} de {pageCount}
      </span>

      {hasNext ? (
        <Link
          href={`${action}${buildQuery({ ...base, pagina: page + 1 })}`}
          className="rounded-lg bg-surface-container-low px-3 py-1.5 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
        >
          Siguiente
        </Link>
      ) : (
        <span className="rounded-lg px-3 py-1.5 text-label-md text-on-surface-variant/40">
          Siguiente
        </span>
      )}
    </nav>
  );
}
