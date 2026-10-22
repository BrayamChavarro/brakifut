import type { Match } from "@/domain/match";
import { computeStandings, type StandingRow } from "@/domain/standings";
import {
  getCompetitionBySlug,
  getLastSync,
  getMatchById,
  listCompetitions,
  listHeadToHead,
  listMatches,
  listMatchesByCompetition,
  listRecentMatchesByTeam,
  searchCompetitions,
  searchTeams,
  type CompetitionRecord,
  type MatchStatusFilter,
  type TeamSearchResult,
} from "@/infrastructure/db/repository";
import { toDateKey } from "@/lib/format";

import { ensureData } from "./sync";

/**
 * Modelo de lectura para la interfaz.
 *
 * La UI no consulta la base directamente: pide "view models" ya resueltos.
 * Asi las pantallas no saben de SQL y las consultas se pueden probar y
 * optimizar por separado.
 */

const PAGE_SIZE = 20;

export interface MatchGroup {
  dateKey: string;
  matches: Match[];
}

/** Agrupa partidos por dia (en la zona horaria de despliegue). */
export function groupByDate(matches: Match[]): MatchGroup[] {
  const groups = new Map<string, Match[]>();

  for (const match of matches) {
    const key = toDateKey(match.kickoffUtc);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(match);
    } else {
      groups.set(key, [match]);
    }
  }

  return [...groups.entries()]
    .map(([dateKey, grouped]) => ({ dateKey, matches: grouped }))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export interface LastSyncInfo {
  finishedAt: string;
  provider: string;
  matchesUpserted: number;
}

export interface HomeViewModel {
  groups: MatchGroup[];
  total: number;
  page: number;
  pageCount: number;
  competitions: CompetitionRecord[];
  lastSync: LastSyncInfo | null;
  /** Competicion destacada en la barra lateral (la de mas partidos). */
  featuredCompetition: CompetitionRecord | null;
  featuredStandings: StandingRow[];
}

export interface HomeFilters {
  competition?: string;
  status?: MatchStatusFilter;
  date?: string;
  query?: string;
  page?: number;
  order?: "asc" | "desc";
}

export async function getHomeViewModel(
  filters: HomeFilters,
): Promise<HomeViewModel> {
  await ensureData();

  const page = Math.max(1, filters.page ?? 1);
  const competitions = listCompetitions();

  const { matches, total } = listMatches({
    competitionSlug: filters.competition,
    status: filters.status ?? "all",
    fromDateKey: filters.date,
    toDateKey: filters.date,
    query: filters.query,
    order: filters.order ?? "desc",
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const featuredCompetition = filters.competition
    ? (getCompetitionBySlug(filters.competition) ?? null)
    : (competitions[0] ?? null);

  const featuredStandings = featuredCompetition
    ? computeStandings(listMatchesByCompetition(featuredCompetition.id)).slice(0, 8)
    : [];

  return {
    groups: groupByDate(matches),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    competitions,
    lastSync: getLastSync(),
    featuredCompetition,
    featuredStandings,
  };
}

export interface MatchDetailViewModel {
  match: Match;
  standings: StandingRow[];
  homePosition: number | null;
  awayPosition: number | null;
  headToHead: Match[];
  recentHome: Match[];
  recentAway: Match[];
}

export async function getMatchDetailViewModel(
  matchId: string,
): Promise<MatchDetailViewModel | null> {
  await ensureData();

  const match = getMatchById(matchId);
  if (!match) return null;

  const standings = computeStandings(listMatchesByCompetition(match.competitionId));
  const indexOf = (teamId: string): number | null => {
    const index = standings.findIndex((row) => row.teamId === teamId);
    return index === -1 ? null : index + 1;
  };

  return {
    match,
    standings,
    homePosition: indexOf(match.homeTeam.id),
    awayPosition: indexOf(match.awayTeam.id),
    headToHead: listHeadToHead(match.homeTeam.id, match.awayTeam.id, match.id, 5),
    recentHome: listRecentMatchesByTeam(match.homeTeam.id, 5),
    recentAway: listRecentMatchesByTeam(match.awayTeam.id, 5),
  };
}

export interface SearchViewModel {
  query: string;
  teams: TeamSearchResult[];
  competitions: CompetitionRecord[];
  matches: Match[];
  totalMatches: number;
}

export async function getSearchViewModel(rawQuery: string): Promise<SearchViewModel> {
  await ensureData();

  const query = rawQuery.trim();
  if (query.length === 0) {
    return { query, teams: [], competitions: [], matches: [], totalMatches: 0 };
  }

  const { matches, total } = listMatches({ query, limit: 30, order: "desc" });

  return {
    query,
    teams: searchTeams(query, 10),
    competitions: searchCompetitions(query, 6),
    matches,
    totalMatches: total,
  };
}

export interface CompetitionViewModel {
  competition: CompetitionRecord;
  standings: StandingRow[];
  groups: MatchGroup[];
  matchdays: number[];
  /** Jornada visible, o "all" si el usuario pidió el fixture completo. */
  selectedMatchday: number | "all";
  totalMatches: number;
}

export async function getCompetitionViewModel(
  slug: string,
  matchday: number | "all" | null,
): Promise<CompetitionViewModel | null> {
  await ensureData();

  const competition = getCompetitionBySlug(slug);
  if (!competition) return null;

  const allMatches = listMatchesByCompetition(competition.id);

  const matchdays = [
    ...new Set(
      allMatches
        .map((match) => match.matchday)
        .filter((value): value is number => value !== null),
    ),
  ].sort((a, b) => a - b);

  // Por defecto NO se muestran las 38 jornadas: una liga completa son cientos de
  // partidos y eso infla el HTML a mas de 1 MB. Se elige la ultima jornada que
  // tenga al menos un resultado, que es lo que el usuario espera ver al entrar.
  const lastPlayedMatchday = [...matchdays]
    .reverse()
    .find((candidate) =>
      allMatches.some(
        (match) => match.matchday === candidate && match.status === "finished",
      ),
    );

  const selected: number | "all" =
    matchday === "all"
      ? "all"
      : typeof matchday === "number" && matchdays.includes(matchday)
        ? matchday
        : (lastPlayedMatchday ?? matchdays.at(-1) ?? "all");

  const visible =
    selected === "all"
      ? allMatches
      : allMatches.filter((match) => match.matchday === selected);

  return {
    competition,
    standings: computeStandings(allMatches),
    groups: groupByDate(visible),
    matchdays,
    selectedMatchday: selected,
    totalMatches: allMatches.length,
  };
}

export interface TeamViewModel {
  team: TeamSearchResult;
  matches: Match[];
}

export interface ShellViewModel {
  competitions: CompetitionRecord[];
  lastSync: LastSyncInfo | null;
  provider: string;
  isDemoData: boolean;
}

/** Datos del marco de la aplicacion (header + barra lateral de competiciones). */
export async function getShellViewModel(): Promise<ShellViewModel> {
  await ensureData();

  const lastSync = getLastSync();
  const provider = lastSync?.provider ?? "seed";

  return {
    competitions: listCompetitions(),
    lastSync,
    provider,
    isDemoData: provider === "seed",
  };
}

/** Historial completo de un equipo, mas reciente primero. */
export async function getTeamViewModel(teamId: string): Promise<TeamViewModel | null> {
  await ensureData();

  const { matches } = listMatches({ teamId, limit: 100, order: "desc" });
  if (matches.length === 0) return null;

  const team = searchTeams(matches[0].homeTeam.id === teamId
    ? matches[0].homeTeam.name
    : matches[0].awayTeam.name, 1)[0];

  return {
    team: team ?? {
      id: teamId,
      name: matches[0].homeTeam.id === teamId ? matches[0].homeTeam.name : matches[0].awayTeam.name,
      tla: null,
      matchCount: matches.length,
    },
    matches,
  };
}
