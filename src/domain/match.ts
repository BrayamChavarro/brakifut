/**
 * Modelo de partido. Nucleo del dominio: sin dependencias de framework,
 * de red ni de base de datos. Todo lo de este archivo es testeable de forma pura.
 */

/**
 * Estados normalizados. Cada proveedor trae su propio vocabulario
 * (football-data.org usa SCHEDULED, TIMED, IN_PLAY, PAUSED, FINISHED,
 * POSTPONED, SUSPENDED, CANCELLED) y se traduce a este conjunto.
 */
export type MatchStatus =
  | "scheduled"
  | "live"
  | "paused"
  | "finished"
  | "postponed"
  | "suspended"
  | "cancelled";

export interface TeamRef {
  id: string;
  name: string;
  shortName: string | null;
  tla: string | null;
}

export interface Match {
  id: string;
  competitionId: string;
  competitionName: string;
  competitionSlug: string;
  season: string | null;
  matchday: number | null;
  /** Instante de inicio en ISO 8601 UTC. */
  kickoffUtc: string;
  status: MatchStatus;
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  homeScore: number | null;
  awayScore: number | null;
  venue: string | null;
  /** "seed" o "football-data": de donde salio el registro. */
  source: string;
  /** Ultima vez que la sincronizacion toco este partido. */
  updatedAt: string;
}

export type Outcome = "home" | "draw" | "away";

export const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  scheduled: "Programado",
  live: "En vivo",
  paused: "Entretiempo",
  finished: "Finalizado",
  postponed: "Postergado",
  suspended: "Suspendido",
  cancelled: "Cancelado",
};

/** Un partido esta "jugado" solo si termino y tiene marcador cargado. */
export function isPlayed(
  match: Match,
): match is Match & { homeScore: number; awayScore: number } {
  return match.status === "finished" && hasScore(match);
}

export function hasScore(
  match: Match,
): match is Match & { homeScore: number; awayScore: number } {
  return match.homeScore !== null && match.awayScore !== null;
}

/** Resultado 1-X-2, o null si el partido todavia no puede resolverse. */
export function outcome(match: Match): Outcome | null {
  if (!isPlayed(match)) return null;
  const home = match.homeScore as number;
  const away = match.awayScore as number;
  if (home > away) return "home";
  if (home < away) return "away";
  return "draw";
}

/** Ganador de una llave a doble partido, si el agregado es concluyente. */
export function aggregateWinner(
  firstLeg: Match,
  secondLeg: Match,
): TeamRef | null {
  if (!hasScore(firstLeg) || !hasScore(secondLeg)) return null;
  if (firstLeg.homeTeam.id !== secondLeg.awayTeam.id) {
    throw new Error(
      "aggregateWinner: los partidos no enfrentan a los mismos equipos",
    );
  }
  const firstLegHomeTotal = firstLeg.homeScore + secondLeg.awayScore;
  const firstLegAwayTotal = firstLeg.awayScore + secondLeg.homeScore;
  if (firstLegHomeTotal > firstLegAwayTotal) return firstLeg.homeTeam;
  if (firstLegAwayTotal > firstLegHomeTotal) return firstLeg.awayTeam;
  return null;
}

/** Etiqueta corta para mostrar el estado en la UI. */
export function statusBadge(status: MatchStatus): string {
  return MATCH_STATUS_LABEL[status].toUpperCase();
}
