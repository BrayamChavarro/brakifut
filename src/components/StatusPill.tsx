import { statusBadge, type MatchStatus } from "@/domain/match";

const STYLES: Record<MatchStatus, string> = {
  finished: "bg-surface-container-high text-on-surface-variant",
  live: "bg-primary-container/15 text-primary-container",
  paused: "bg-primary-container/15 text-primary-container",
  scheduled: "bg-surface-container text-on-surface-variant/80",
  postponed: "bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim",
  suspended: "bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim",
  cancelled: "bg-error-container/40 text-on-error-container",
};

/**
 * Etiqueta de estado del partido.
 *
 * El prototipo mostraba un marcador "EN VIVO 68'" que parpadeaba sin control.
 * Como la v1 no trae datos en vivo, el estado real es "Finalizado" o
 * "Programado" casi siempre. Se agrega `aria-live` porque este texto es la
 * informacion que un lector de pantalla necesita anunciar cuando cambia.
 */
export function StatusPill({ status }: { status: MatchStatus }) {
  return (
    <span
      aria-live="polite"
      className={`rounded px-1.5 py-0.5 text-label-sm font-bold uppercase tracking-wide ${STYLES[status]}`}
    >
      {statusBadge(status)}
    </span>
  );
}
