import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { SCHEMA_SQL } from "./schema";

/**
 * Conexion unica a SQLite.
 *
 * Guardamos la instancia en globalThis a proposito: en desarrollo Next
 * re-evalua los modulos con cada cambio (HMR) y sin esto abririamos una
 * conexion nueva por cada recarga hasta agotar los descriptores del proceso.
 */
const globalForDb = globalThis as unknown as {
  __pitchpulseDb?: DatabaseSync;
};

export function resolveDatabaseFile(): string {
  const configured = process.env.DB_FILE?.trim();
  if (configured) return configured;
  return join(process.cwd(), "data", "pitchpulse.db");
}

export function getDb(): DatabaseSync {
  if (globalForDb.__pitchpulseDb) return globalForDb.__pitchpulseDb;

  const file = resolveDatabaseFile();
  mkdirSync(dirname(file), { recursive: true });

  const db = new DatabaseSync(file);

  // WAL permite leer mientras se escribe:importante porque la sincronizacion
  // escribe en lote mientras la UI sigue consultando.
  db.prepare("PRAGMA journal_mode = WAL").get();
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SCHEMA_SQL);

  globalForDb.__pitchpulseDb = db;
  return db;
}

/**
 * Ejecuta `work` dentro de una transaccion. Si algo falla, revierte todo:
 * una sincronizacion a medias dejaria la base en un estado inconsistente.
 */
export function withTransaction<T>(work: () => T): T {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/** Borra todo el contenido. Util para re-sembrar en desarrollo. */
export function resetDatabase(): void {
  const db = getDb();
  db.exec("DELETE FROM matches");
  db.exec("DELETE FROM teams");
  db.exec("DELETE FROM competitions");
  db.exec("DELETE FROM sync_runs");
}
