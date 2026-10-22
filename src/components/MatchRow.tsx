import Link from "next/link";

import { hasScore, type Match } from "@/domain/match";
import { formatShortDate, formatTime } from "@/lib/format";

import { StatusPill } from "./StatusPill";
import { TeamBadge } from "./TeamBadge";

/**
 * Fila de partido: el componente mas reutilizado del producto.
 *
 * El prototipo original ponia los goleadores y las tarjetas en el centro de la
 * fila. Ese dato no existe en el plan gratuito de football-data.org, asi que el
 * centro queda para lo unico que si es confiable: el marcador si el partido
 * termino, o el horario si todavia no se jugo. Es la decision de diseno que
 * habilita el MVP sin inventar informacion.
 */
export function MatchRow({
  match,
  showDate = false,
}: {
  match: Match;
  showDate?: boolean;
}) {
  const played = hasScore(match);
  const homeWon = played && match.homeScore! > match.awayScore!;
  const awayWon = played && match.awayScore! > match.homeScore!;

  const context = [
    match.competitionName,
    match.matchday !== null ? `J${match.matchday}` : null,
    showDate ? formatShortDate(match.kickoffUtc) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/partido/${match.id}`}
      className="block rounded-xl border border-outline-variant/20 bg-surface-container-low p-3 transition-colors hover:border-primary-container/40 hover:bg-surface-container"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate text-label-sm text-on-surface-variant">
          {context}
        </span>
        <StatusPill status={match.status} />
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center justify-end gap-2">
          <span
            className={`truncate text-body-md ${
              played && !homeWon ? "text-on-surface-variant" : "text-on-surface"
            }`}
          >
            {match.homeTeam.name}
          </span>
          <TeamBadge tla={match.homeTeam.tla} name={match.homeTeam.name} />
        </div>

        <div className="min-w-[76px] px-1 text-center">
          {played ? (
            <span className="font-display text-score-display-sm tabular-nums text-on-surface">
              {match.homeScore} - {match.awayScore}
            </span>
          ) : (
            <span className="font-display text-headline-sm tabular-nums text-on-surface-variant">
              {formatTime(match.kickoffUtc)}
            </span>
          )}
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <TeamBadge tla={match.awayTeam.tla} name={match.awayTeam.name} />
          <span
            className={`truncate text-body-md ${
              played && !awayWon ? "text-on-surface-variant" : "text-on-surface"
            }`}
          >
            {match.awayTeam.name}
          </span>
        </div>
      </div>

      {matchedVenue(match) ? (
        <p className="mt-2 flex items-center gap-1 text-label-sm text-on-surface-variant/70">
          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
            location_on
          </span>
          {match.venue}
        </p>
      ) : null}
    </Link>
  );
}

function matchedVenue(match: Match): boolean {
  return typeof match.venue === "string" && match.venue.trim().length > 0;
}
