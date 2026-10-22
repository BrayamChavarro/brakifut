import type { Match, MatchStatus } from "@/domain/match";
import { endOfDayIso, startOfDayIso } from "@/lib/timezone";

import { getDb, withTransaction } from "./db";

/**
 * Acceso a datos. Toda la SQL del producto vive aca.
 *
 * Se usan sentencias preparadas con parametros posicionales (?) y nunca
 * interpolacion de strings: es la defensa contra inyeccion SQL, y ademas
 * SQLite reutiliza el plan de ejecucion.
 */

type Row = Record<string, unknown>;

function asString(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

function asNumber(value: unknown): number {
  return Number(value ?? 0);
}

const MATCH_SELECT = `
  SELECT
    m.id,
    m.competition_id,
    m.season,
    m.matchday,
    m.kickoff_utc,
    m.status,
    m.home_score,
    m.away_score,
    m.venue,
    m.source,
    m.updated_at,
    c.name AS competition_name,
    c.slug AS competition_slug,
    h.id   AS home_id,
    h.name AS home_name,
    h.short_name AS home_short_name,
    h.tla  AS home_tla,
    a.id   AS away_id,
    a.name AS away_name,
    a.short_name AS away_short_name,
    a.tla  AS away_tla
  FROM matches m
  JOIN competitions c ON c.id = m.competition_id
  JOIN teams h        ON h.id = m.home_team_id
  JOIN teams a        ON a.id = m.away_team_id
`;

function rowToMatch(row: Row): Match {
  return {
    id: asString(row.id),
    competitionId: asString(row.competition_id),
    competitionName: asString(row.competition_name),
    competitionSlug: asString(row.competition_slug),
    season: asNullableString(row.season),
    matchday: asNullableNumber(row.matchday),
    kickoffUtc: asString(row.kickoff_utc),
    status: asString(row.status) as MatchStatus,
    homeTeam: {
      id: asString(row.home_id),
      name: asString(row.home_name),
      shortName: asNullableString(row.home_short_name),
      tla: asNullableString(row.home_tla),
    },
    awayTeam: {
      id: asString(row.away_id),
      name: asString(row.away_name),
      shortName: asNullableString(row.away_short_name),
      tla: asNullableString(row.away_tla),
    },
    homeScore: asNullableNumber(row.home_score),
    awayScore: asNullableNumber(row.away_score),
    venue: asNullableString(row.venue),
    source: asString(row.source),
    updatedAt: asString(row.updated_at),
  };
}

/* ------------------------------------------------------------------ lectura */

export interface CompetitionRecord {
  id: string;
  slug: string;
  name: string;
  area: string | null;
  season: string | null;
  matchCount: number;
}

export function listCompetitions(): CompetitionRecord[] {
  const rows = getDb()
    .prepare(
      `SELECT c.id, c.slug, c.name, c.area, c.season,
              (SELECT COUNT(*) FROM matches m WHERE m.competition_id = c.id) AS match_count
       FROM competitions c
       ORDER BY match_count DESC, c.name ASC`,
    )
    .all() as Row[];

  return rows.map((row) => ({
    id: asString(row.id),
    slug: asString(row.slug),
    name: asString(row.name),
    area: asNullableString(row.area),
    season: asNullableString(row.season),
    matchCount: asNumber(row.match_count),
  }));
}

export function getCompetitionBySlug(slug: string): CompetitionRecord | null {
  const row = getDb()
    .prepare(
      `SELECT c.id, c.slug, c.name, c.area, c.season,
              (SELECT COUNT(*) FROM matches m WHERE m.competition_id = c.id) AS match_count
       FROM competitions c
       WHERE c.slug = ?`,
    )
    .get(slug) as Row | undefined;

  if (!row) return null;

  return {
    id: asString(row.id),
    slug: asString(row.slug),
    name: asString(row.name),
    area: asNullableString(row.area),
    season: asNullableString(row.season),
    matchCount: asNumber(row.match_count),
  };
}

export type MatchStatusFilter = "all" | "finished" | "upcoming";

export interface MatchFilters {
  competitionSlug?: string;
  status?: MatchStatusFilter;
  /** Clave de fecha local "AAAA-MM-DD", inclusive. */
  fromDateKey?: string;
  /** Clave de fecha local "AAAA-MM-DD", inclusive. */
  toDateKey?: string;
  teamId?: string;
  /** Busqueda por nombre de equipo o competicion. */
  query?: string;
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

interface BuiltWhere {
  clause: string;
  params: (string | number)[];
}

function buildMatchWhere(filters: MatchFilters): BuiltWhere {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.competitionSlug) {
    conditions.push("c.slug = ?");
    params.push(filters.competitionSlug);
  }

  if (filters.status === "finished") {
    conditions.push("m.status = 'finished'");
  } else if (filters.status === "upcoming") {
    conditions.push("m.status IN ('scheduled', 'live', 'paused')");
  }

  if (filters.fromDateKey) {
    conditions.push("m.kickoff_utc >= ?");
    params.push(startOfDayIso(filters.fromDateKey));
  }

  if (filters.toDateKey) {
    // Limite superior exclusivo: el inicio del dia siguiente.
    conditions.push("m.kickoff_utc < ?");
    params.push(endOfDayIso(filters.toDateKey));
  }

  if (filters.teamId) {
    conditions.push("(m.home_team_id = ? OR m.away_team_id = ?)");
    params.push(filters.teamId, filters.teamId);
  }

  const query = filters.query?.trim();
  if (query) {
    const like = `%${escapeLike(query)}%`;
    conditions.push(
      "(h.name LIKE ? ESCAPE '\\' OR h.short_name LIKE ? ESCAPE '\\' " +
        "OR a.name LIKE ? ESCAPE '\\' OR a.short_name LIKE ? ESCAPE '\\' " +
        "OR c.name LIKE ? ESCAPE '\\' OR m.venue LIKE ? ESCAPE '\\')",
    );
    params.push(like, like, like, like, like, like);
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

/** Escapa los comodines de LIKE para que una busqueda con "%" no traiga todo. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export interface MatchPage {
  matches: Match[];
  total: number;
}

export function listMatches(filters: MatchFilters = {}): MatchPage {
  const db = getDb();
  const where = buildMatchWhere(filters);

  const totalRow = db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM matches m
       JOIN competitions c ON c.id = m.competition_id
       JOIN teams h        ON h.id = m.home_team_id
       JOIN teams a        ON a.id = m.away_team_id
       ${where.clause}`,
    )
    .get(...where.params) as Row | undefined;

  const direction = filters.order === "asc" ? "ASC" : "DESC";
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const rows = db
    .prepare(
      `${MATCH_SELECT}
       ${where.clause}
       ORDER BY m.kickoff_utc ${direction}, c.name ASC
       LIMIT ? OFFSET ?`,
    )
    .all(...where.params, limit, offset) as Row[];

  return {
    matches: rows.map(rowToMatch),
    total: asNumber(totalRow?.total),
  };
}

export function getMatchById(id: string): Match | null {
  const row = getDb()
    .prepare(`${MATCH_SELECT} WHERE m.id = ?`)
    .get(id) as Row | undefined;
  return row ? rowToMatch(row) : null;
}

/** Todos los partidos de una competicion; es la entrada de computeStandings. */
export function listMatchesByCompetition(competitionId: string): Match[] {
  const rows = getDb()
    .prepare(`${MATCH_SELECT} WHERE m.competition_id = ? ORDER BY m.kickoff_utc ASC`)
    .all(competitionId) as Row[];

  return rows.map(rowToMatch);
}

export function countMatches(): number {
  const row = getDb().prepare("SELECT COUNT(*) AS total FROM matches").get() as
    | Row
    | undefined;
  return asNumber(row?.total);
}

/**
 * Elimina los partidos que no provienen del proveedor activo.
 *
 * Por que: si el usuario arranca con el dataset de demostracion y luego
 * sincroniza football-data.org, quedarian DOS fixtures de LaLiga en la base
 * (ids `seed:*` y `fd:*`) y la vista mostraria partidos duplicados. La
 * sincronizacion reemplaza el dataset; no lo fusiona.
 */
export function deleteMatchesNotFromSource(source: string): number {
  const result = getDb()
    .prepare("DELETE FROM matches WHERE source <> ?")
    .run(source);
  return Number(result.changes);
}

/** Borra competiciones y equipos que quedaron sin partidos asociados. */
export function deleteOrphans(): void {
  const db = getDb();
  db.exec(
    "DELETE FROM teams WHERE id NOT IN (SELECT home_team_id FROM matches UNION SELECT away_team_id FROM matches)",
  );
  db.exec(
    "DELETE FROM competitions WHERE id NOT IN (SELECT competition_id FROM matches)",
  );
}

/** Historial entre dos equipos, en cualquier orden de localia. */
export function listHeadToHead(
  teamAId: string,
  teamBId: string,
  excludeMatchId: string,
  limit = 5,
): Match[] {
  const rows = getDb()
    .prepare(
      `${MATCH_SELECT}
       WHERE m.id <> ?
         AND ((m.home_team_id = ? AND m.away_team_id = ?)
           OR (m.home_team_id = ? AND m.away_team_id = ?))
       ORDER BY m.kickoff_utc DESC
       LIMIT ?`,
    )
    .all(excludeMatchId, teamAId, teamBId, teamBId, teamAId, limit) as Row[];

  return rows.map(rowToMatch);
}

/** Ultimos partidos de un equipo, para el contexto en el detalle. */
export function listRecentMatchesByTeam(teamId: string, limit = 5): Match[] {
  const rows = getDb()
    .prepare(
      `${MATCH_SELECT}
       WHERE m.status = 'finished'
         AND (m.home_team_id = ? OR m.away_team_id = ?)
       ORDER BY m.kickoff_utc DESC
       LIMIT ?`,
    )
    .all(teamId, teamId, limit) as Row[];

  return rows.map(rowToMatch);
}

export function getLastSync(): { finishedAt: string; provider: string; matchesUpserted: number } | null {
  const row = getDb()
    .prepare(
      `SELECT finished_at, provider, matches_upserted
       FROM sync_runs
       WHERE status = 'ok' AND finished_at IS NOT NULL
       ORDER BY finished_at DESC
       LIMIT 1`,
    )
    .get() as Row | undefined;

  if (!row) return null;

  return {
    finishedAt: asString(row.finished_at),
    provider: asString(row.provider),
    matchesUpserted: asNumber(row.matches_upserted),
  };
}

export interface TeamSearchResult {
  id: string;
  name: string;
  tla: string | null;
  matchCount: number;
}

export function searchTeams(query: string, limit = 10): TeamSearchResult[] {
  const like = `%${escapeLike(query.trim())}%`;
  const rows = getDb()
    .prepare(
      `SELECT t.id, t.name, t.tla,
              (SELECT COUNT(*) FROM matches m
               WHERE m.home_team_id = t.id OR m.away_team_id = t.id) AS match_count
       FROM teams t
       WHERE t.name LIKE ? ESCAPE '\\' OR t.short_name LIKE ? ESCAPE '\\' OR t.tla LIKE ? ESCAPE '\\'
       ORDER BY match_count DESC, t.name ASC
       LIMIT ?`,
    )
    .all(like, like, like, limit) as Row[];

  return rows.map((row) => ({
    id: asString(row.id),
    name: asString(row.name),
    tla: asNullableString(row.tla),
    matchCount: asNumber(row.match_count),
  }));
}

export function searchCompetitions(query: string, limit = 10): CompetitionRecord[] {
  const like = `%${escapeLike(query.trim())}%`;
  const rows = getDb()
    .prepare(
      `SELECT c.id, c.slug, c.name, c.area, c.season,
              (SELECT COUNT(*) FROM matches m WHERE m.competition_id = c.id) AS match_count
       FROM competitions c
       WHERE c.name LIKE ? ESCAPE '\\' OR c.area LIKE ? ESCAPE '\\'
       ORDER BY match_count DESC, c.name ASC
       LIMIT ?`,
    )
    .all(like, like, limit) as Row[];

  return rows.map((row) => ({
    id: asString(row.id),
    slug: asString(row.slug),
    name: asString(row.name),
    area: asNullableString(row.area),
    season: asNullableString(row.season),
    matchCount: asNumber(row.match_count),
  }));
}

/* --------------------------------------------------------------- escritura */

export interface UpsertCompetition {
  id: string;
  slug: string;
  name: string;
  area: string | null;
  code: string | null;
  season: string | null;
}

export interface UpsertTeam {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  tla: string | null;
}

export interface UpsertMatch {
  id: string;
  providerId: string | null;
  competitionId: string;
  season: string | null;
  matchday: number | null;
  kickoffUtc: string;
  status: MatchStatus;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  venue: string | null;
  source: string;
}

export function upsertCompetitions(competitions: UpsertCompetition[]): void {
  const statement = getDb().prepare(
    `INSERT INTO competitions (id, slug, name, area, code, season)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       slug   = excluded.slug,
       name   = excluded.name,
       area   = excluded.area,
       code   = excluded.code,
       season = excluded.season`,
  );

  for (const competition of competitions) {
    statement.run(
      competition.id,
      competition.slug,
      competition.name,
      competition.area,
      competition.code,
      competition.season,
    );
  }
}

export function upsertTeams(teams: UpsertTeam[]): void {
  const statement = getDb().prepare(
    `INSERT INTO teams (id, slug, name, short_name, tla)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       slug       = excluded.slug,
       name       = excluded.name,
       short_name = excluded.short_name,
       tla        = excluded.tla`,
  );

  for (const team of teams) {
    statement.run(team.id, team.slug, team.name, team.shortName, team.tla);
  }
}

/**
 * Inserta o actualiza partidos.
 *
 * El ON CONFLICT por id hace la sincronizacion idempotente: correrla dos veces
 * no duplica nada. Y solo sobreescribimos los campos que el proveedor puede
 * cambiar; la identidad y la competencia quedan estables.
 */
export function upsertMatches(matches: UpsertMatch[]): number {
  return withTransaction(() => {
    const statement = getDb().prepare(
      `INSERT INTO matches (
         id, provider_id, competition_id, season, matchday, kickoff_utc, status,
         home_team_id, away_team_id, home_score, away_score, venue, source, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         provider_id  = excluded.provider_id,
         matchday     = excluded.matchday,
         kickoff_utc  = excluded.kickoff_utc,
         status       = excluded.status,
         home_score   = excluded.home_score,
         away_score   = excluded.away_score,
         venue        = excluded.venue,
         updated_at   = excluded.updated_at`,
    );

    const now = new Date().toISOString();
    let affected = 0;

    for (const match of matches) {
      statement.run(
        match.id,
        match.providerId,
        match.competitionId,
        match.season,
        match.matchday,
        match.kickoffUtc,
        match.status,
        match.homeTeamId,
        match.awayTeamId,
        match.homeScore,
        match.awayScore,
        match.venue,
        match.source,
        now,
      );
      affected += 1;
    }

    return affected;
  });
}

export function startSyncRun(provider: string): number {
  const result = getDb()
    .prepare(
      `INSERT INTO sync_runs (provider, started_at, status)
       VALUES (?, ?, 'running')`,
    )
    .run(provider, new Date().toISOString());

  return Number(result.lastInsertRowid);
}

export function finishSyncRun(
  runId: number,
  status: "ok" | "error",
  matchesUpserted: number,
  message: string | null,
): void {
  getDb()
    .prepare(
      `UPDATE sync_runs
       SET finished_at = ?, status = ?, matches_upserted = ?, message = ?
       WHERE id = ?`,
    )
    .run(new Date().toISOString(), status, matchesUpserted, message, runId);
}
