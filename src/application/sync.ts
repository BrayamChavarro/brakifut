import {
  countMatches,
  deleteMatchesNotFromSource,
  deleteOrphans,
  finishSyncRun,
  startSyncRun,
  upsertCompetitions,
  upsertMatches,
  upsertTeams,
  type UpsertCompetition,
  type UpsertMatch,
  type UpsertTeam,
} from "@/infrastructure/db/repository";
import { getProvider } from "@/infrastructure/providers";
import { slugify } from "@/infrastructure/providers/types";

/**
 * Caso de uso: sincronizar el historial desde el proveedor.
 *
 * Orquesta, en este orden:
 *   1. Traer los partidos del proveedor.
 *   2. Normalizar la identidad (ids con prefijo del proveedor) y aplanar el
 *      grafo de equipos y competiciones.
 *   3. Persistir competiciones y equipos ANTES que los partidos: las claves
 *      foraneas lo exigen.
 *   4. Reemplazar los datos de otros proveedores.
 *   5. Registrar la corrida para poder mostrar "ultima sincronizacion".
 */

export interface SyncResult {
  provider: string;
  matchesUpserted: number;
  removedFromOtherSources: number;
  durationMs: number;
}

export interface SyncOptions {
  /** Limita la sincronizacion a estas competiciones (por slug). */
  competitionSlugs?: string[];
  /** Inyectable para tests: por defecto usa FOOTBALL_PROVIDER. */
  providerName?: string;
}

export async function runSync(options: SyncOptions = {}): Promise<SyncResult> {
  const provider = getProvider(options.providerName);
  const startedAt = Date.now();
  const runId = startSyncRun(provider.name);

  try {
    const providerMatches = await provider.fetchMatches({
      competitionSlugs: options.competitionSlugs,
    });

    // Un mismo equipo y una misma competicion aparecen en muchos partidos:
    // deduplicamos con Maps antes de escribir, para no emitir N veces el mismo
    // UPSERT.
    const competitions = new Map<string, UpsertCompetition>();
    const teams = new Map<string, UpsertTeam>();
    const matches: UpsertMatch[] = [];

    for (const providerMatch of providerMatches) {
      const { competition } = providerMatch;

      competitions.set(competition.providerId, {
        id: competition.providerId,
        slug: competition.slug,
        name: competition.name,
        area: competition.area,
        code: competition.code,
        season: providerMatch.season,
      });

      teams.set(providerMatch.home.providerId, {
        id: providerMatch.home.providerId,
        slug: slugify(providerMatch.home.name),
        name: providerMatch.home.name,
        shortName: providerMatch.home.shortName,
        tla: providerMatch.home.tla,
      });

      teams.set(providerMatch.away.providerId, {
        id: providerMatch.away.providerId,
        slug: slugify(providerMatch.away.name),
        name: providerMatch.away.name,
        shortName: providerMatch.away.shortName,
        tla: providerMatch.away.tla,
      });

      matches.push({
        id: providerMatch.providerId,
        providerId: providerMatch.providerId,
        competitionId: competition.providerId,
        season: providerMatch.season,
        matchday: providerMatch.matchday,
        kickoffUtc: providerMatch.kickoffUtc,
        status: providerMatch.status,
        homeTeamId: providerMatch.home.providerId,
        awayTeamId: providerMatch.away.providerId,
        homeScore: providerMatch.homeScore,
        awayScore: providerMatch.awayScore,
        venue: providerMatch.venue,
        source: provider.name,
      });
    }

    upsertCompetitions([...competitions.values()]);
    upsertTeams([...teams.values()]);

    const matchesUpserted = upsertMatches(matches);
    const removedFromOtherSources = deleteMatchesNotFromSource(provider.name);
    deleteOrphans();

    finishSyncRun(runId, "ok", matchesUpserted, null);

    return {
      provider: provider.name,
      matchesUpserted,
      removedFromOtherSources,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    finishSyncRun(runId, "error", 0, message);
    throw error;
  }
}

/**
 * Garantiza que la base tenga datos antes de renderizar.
 *
 * Sin esto, un clon reciente del repositorio mostraria pantallas vacias y habria
 * que ejecutar un comando manual antes de poder ver nada. El guard de promesa
 * evita que dos peticiones simultaneas siembren a la vez en el primer arranque.
 */
let bootstrapPromise: Promise<void> | null = null;

export function ensureData(): Promise<void> {
  if (countMatches() > 0) return Promise.resolve();

  if (!bootstrapPromise) {
    bootstrapPromise = runSync()
      .then(() => undefined)
      .catch((error: unknown) => {
        // No dejamos el guard envenenado: si falla, el proximo pedido reintenta.
        bootstrapPromise = null;
        throw error;
      });
  }

  return bootstrapPromise;
}
