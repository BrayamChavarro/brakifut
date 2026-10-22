/**
 * Esquema de la base SQLite.
 *
 * Se mantiene como SQL explicito (y no con un ORM) por tres razones:
 * 1. Cero dependencias: node:sqlite viene con Node 24.
 * 2. El esquema es el contrato, visible y auditable de un vistazo.
 * 3. Las consultas de busqueda con LIKE y los indices son lo que hay que
 *    poder explicar en la defensa; un ORM los esconde.
 *
 * Nota: la tabla se llama `matches` y no `match` porque MATCH es palabra
 * reservada en SQLite.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS competitions (
  id         TEXT PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  area       TEXT,
  code       TEXT,
  season     TEXT
);

-- El slug de equipos NO es UNIQUE a proposito: dos clubes distintos pueden
-- compartir nombre corto y el slug se derivaria igual. La identidad real es
-- (id) = prefijo del proveedor + id del proveedor.
CREATE TABLE IF NOT EXISTS teams (
  id         TEXT PRIMARY KEY,
  slug       TEXT NOT NULL,
  name       TEXT NOT NULL,
  short_name TEXT,
  tla        TEXT
);

CREATE TABLE IF NOT EXISTS matches (
  id             TEXT PRIMARY KEY,
  provider_id    TEXT,
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  season         TEXT,
  matchday       INTEGER,
  kickoff_utc    TEXT NOT NULL,
  status         TEXT NOT NULL,
  home_team_id   TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  away_team_id   TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  home_score     INTEGER,
  away_score     INTEGER,
  venue          TEXT,
  source         TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_matches_kickoff     ON matches(kickoff_utc);
CREATE INDEX IF NOT EXISTS idx_matches_competition ON matches(competition_id);
CREATE INDEX IF NOT EXISTS idx_matches_home_team   ON matches(home_team_id);
CREATE INDEX IF NOT EXISTS idx_matches_away_team   ON matches(away_team_id);
CREATE INDEX IF NOT EXISTS idx_matches_status      ON matches(status);

CREATE INDEX IF NOT EXISTS idx_teams_name          ON teams(name);
CREATE INDEX IF NOT EXISTS idx_teams_slug          ON teams(slug);
CREATE INDEX IF NOT EXISTS idx_competitions_name   ON competitions(name);

CREATE TABLE IF NOT EXISTS sync_runs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  provider     TEXT NOT NULL,
  started_at   TEXT NOT NULL,
  finished_at  TEXT,
  status       TEXT NOT NULL,
  matches_upserted INTEGER NOT NULL DEFAULT 0,
  message      TEXT
);
`;
