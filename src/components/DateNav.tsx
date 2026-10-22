import Link from "next/link";

import { formatShortDate, shiftDateKey, todayKey } from "@/lib/format";
import { buildQuery, type QueryValue } from "@/lib/url";

import { MaterialIcon } from "./MaterialIcon";

/** Selector de fecha: dia anterior, hoy, dia siguiente y calendario nativo. */
export function DateNav({
  dateKey,
  action,
  base,
}: {
  dateKey: string | null;
  action: string;
  base: Record<string, QueryValue>;
}) {
  const today = todayKey();
  const current = dateKey ?? today;

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Link
        href={`${action}${buildQuery({ ...base, fecha: shiftDateKey(current, -1), pagina: null })}`}
        aria-label="Día anterior"
        className="flex items-center rounded-lg bg-surface-container-low px-2 py-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
      >
        <MaterialIcon name="chevron_left" className="text-[18px]" />
      </Link>

      <Link
        href={`${action}${buildQuery({ ...base, fecha: today, pagina: null })}`}
        className={`rounded-lg px-3 py-1.5 text-label-md transition-colors ${
          dateKey === today
            ? "bg-primary-container text-on-primary-container"
            : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
        }`}
      >
        Hoy
      </Link>

      <Link
        href={`${action}${buildQuery({ ...base, fecha: shiftDateKey(current, 1), pagina: null })}`}
        aria-label="Día siguiente"
        className="flex items-center rounded-lg bg-surface-container-low px-2 py-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
      >
        <MaterialIcon name="chevron_right" className="text-[18px]" />
      </Link>

      {dateKey ? (
        <>
          <span className="px-1 text-label-md text-on-surface">
            {formatShortDate(`${dateKey}T12:00:00Z`)}
          </span>
          <Link
            href={`${action}${buildQuery({ ...base, fecha: null, pagina: null })}`}
            className="rounded-lg px-2 py-1.5 text-label-sm text-on-surface-variant underline-offset-2 hover:text-on-surface hover:underline"
          >
            Ver todo el historial
          </Link>
        </>
      ) : null}

      <form action={action} method="get" className="ml-1 flex items-center">
        {Object.entries(base).map(([key, value]) =>
          value === null || value === undefined || value === "" ? null : (
            <input key={key} type="hidden" name={key} value={String(value)} />
          ),
        )}
        <label htmlFor="fecha" className="sr-only">
          Elegir fecha
        </label>
        <input
          id="fecha"
          type="date"
          name="fecha"
          defaultValue={dateKey ?? ""}
          className="rounded-lg bg-surface-container-low px-2 py-1.5 text-label-md text-on-surface outline-none focus:ring-1 focus:ring-primary-container/50"
        />
        <button
          type="submit"
          className="ml-1 rounded-lg bg-surface-container-low p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
          aria-label="Aplicar fecha"
        >
          <MaterialIcon name="calendar_month" className="text-[18px]" />
        </button>
      </form>
    </div>
  );
}
