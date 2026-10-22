import { z } from "zod";

import {
  slugify,
  type FetchMatchesInput,
  type FootballProvider,
  type ProviderCompetition,
  type ProviderMatch,
  type ProviderTeam,
} from "./types";
import type { MatchStatus } from "@/domain/match";

/**
 * Adaptador de football-data.org (API v4).
 *
 * Documentacion verificada en https://docs.football-data.org/general/v4/
 * Endpoint usado: GET /v4/competitions/{code}/matches
 *
 * Decisiones:
 * - Validamos la respuesta con zod en vez de confiar en el tipo. Una API externa
 *   puede cambiar y queremos un error claro en el borde del sistema, no un
 *   `undefined` propagado hasta la UI.
 * - El mapeo de estado traduce el vocabulario del proveedor al del dominio.
 * - La sincronizacion es SECUENCIAL, no en paralelo: el plan gratuito limita a
 *   10 peticiones por minuto y paralelizar varias competiciones lo agota.
 * - Nunca guardamos resultados "en vivo": si el partido no esta FINISHED, el
 *   marcador queda en null aunque la API ya devuelva un parcial.
 */

const API_BASE = "https://api.football-data.org/v4";

/** Codigos de liga -> slug canonico de la aplicacion. */
export const COMPETITION_SLUGS: Record<string, string> = {
  PD: "laliga",
  PL: "premier-league",
  SA: "serie-a",
  BL1: "bundesliga",
  FL1: "ligue-1",
  DED: "eredivisie",
  PPL: "primeira-liga",
  BSA: "brasileirao",
  ELC: "championship",
  CL: "champions-league",
  CLI: "copa-libertadores",
  EC: "eurocopa",
  WC: "mundial",
};

const COMPETITION_AREAS: Record<string, string> = {
  PD: "España",
  PL: "Inglaterra",
  SA: "Italia",
  BL1: "Alemania",
  FL1: "Francia",
  DED: "Países Bajos",
  PPL: "Portugal",
  BSA: "Brasil",
  ELC: "Inglaterra",
  CL: "Europa",
  CLI: "Sudamérica",
  EC: "Europa",
  WC: "Mundo",
};

const DEFAULT_COMPETITIONS = ["PD", "PL", "SA", "BL1"];

/* ------------------------------------------------------------- validacion */

const teamSchema = z.object({
  id: z.number(),
  name: z.string(),
  shortName: z.string().nullable().optional(),
  tla: z.string().nullable().optional(),
});

const scoreSchema = z
  .object({
    fullTime: z
      .object({
        home: z.number().nullable(),
        away: z.number().nullable(),
      })
      .nullable()
      .optional(),
  })
  .nullable()
  .optional();

const matchSchema = z.object({
  id: z.number(),
  utcDate: z.string(),
  status: z.string(),
  matchday: z.number().nullable().optional(),
  homeTeam: teamSchema,
  awayTeam: teamSchema,
  score: scoreSchema,
  venue: z.string().nullable().optional(),
});

const matchesResponseSchema = z.object({
  competition: z.object({
    id: z.number(),
    name: z.string(),
    code: z.string(),
  }),
  filters: z
    .object({
      season: z.string().nullable().optional(),
    })
    .optional(),
  matches: z.array(matchSchema),
});

/** Traduce los estados de la API al vocabulario del dominio. */
export function mapStatus(providerStatus: string): MatchStatus {
  switch (providerStatus) {
    case "IN_PLAY":
    case "EXTRA_TIME":
    case "PENALTY_SHOOTOUT":
      return "live";
    case "PAUSED":
      return "paused";
    case "FINISHED":
    case "AWARDED":
      return "finished";
    case "POSTPONED":
      return "postponed";
    case "SUSPENDED":
      return "suspended";
    case "CANCELLED":
      return "cancelled";
    case "SCHEDULED":
    case "TIMED":
    default:
      return "scheduled";
  }
}

function competitionSlug(code: string): string {
  return COMPETITION_SLUGS[code] ?? slugify(code);
}

function areaFor(code: string): string | null {
  return COMPETITION_AREAS[code] ?? null;
}

/* ---------------------------------------------------------------- adaptador */

class ProviderRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ProviderRequestError";
  }
}

async function requestMatches(
  code: string,
  apiKey: string,
  season: string | undefined,
): Promise<z.infer<typeof matchesResponseSchema>> {
  const url = new URL(`${API_BASE}/competitions/${code}/matches`);
  if (season) url.searchParams.set("season", season);

  const response = await fetch(url, {
    headers: { "X-Auth-Token": apiKey },
    // La sincronizacion es una accion explicita del usuario: nunca cachear.
    cache: "no-store",
  });

  if (response.status === 429) {
    throw new ProviderRequestError(
      "Se agotó el límite de peticiones del plan gratuito (10 por minuto). Probá de nuevo en un minuto.",
      429,
    );
  }

  if (response.status === 403) {
    throw new ProviderRequestError(
      `Tu plan de football-data.org no da acceso a la competición ${code}.`,
      403,
    );
  }

  if (response.status === 400) {
    throw new ProviderRequestError(
      `La API rechazó la petición para ${code} (¿temporada inexistente?).`,
      400,
    );
  }

  if (!response.ok) {
    throw new ProviderRequestError(
      `football-data.org respondió ${response.status} para ${code}.`,
      response.status,
    );
  }

  const json: unknown = await response.json();
  const parsed = matchesResponseSchema.safeParse(json);

  if (!parsed.success) {
    throw new ProviderRequestError(
      `La respuesta de la API para ${code} no tiene el formato esperado: ${parsed.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join(".")} ${issue.message}`)
        .join("; ")}`,
      502,
    );
  }

  return parsed.data;
}

export function createFootballDataProvider(): FootballProvider {
  const apiKey = process.env.FOOTBALL_API_KEY?.trim();
  const configured = process.env.SYNC_COMPETITIONS?.split(",")
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);

  return {
    name: "football-data",
    label: "football-data.org (datos reales)",
    capabilities: {
      // El plan gratuito entrega resultados diferidos, no en vivo.
      liveScores: false,
      scorers: false,
      lineups: false,
      cards: false,
      advancedStats: false,
    },

    async fetchMatches(input: FetchMatchesInput = {}): Promise<ProviderMatch[]> {
      if (!apiKey) {
        throw new ProviderRequestError(
          "Falta la variable de entorno FOOTBALL_API_KEY. Registrate en football-data.org para obtener una clave gratuita.",
          401,
        );
      }

      // El slug es el vocabulario de la aplicacion; la API habla en codigos.
      const requestedSlugs = input.competitionSlugs?.length
        ? input.competitionSlugs
        : undefined;

      const entries = Object.entries(COMPETITION_SLUGS);
      const selectedCodes = requestedSlugs
        ? entries
            .filter(([, slug]) => requestedSlugs.includes(slug))
            .map(([code]) => code)
        : (configured ?? DEFAULT_COMPETITIONS);

      const collected: ProviderMatch[] = [];

      for (const code of selectedCodes) {
        const payload = await requestMatches(code, apiKey, input.season);

        const competition: ProviderCompetition = {
          providerId: `fd:${payload.competition.id}`,
          code: payload.competition.code,
          slug: competitionSlug(payload.competition.code),
          name: payload.competition.name,
          area: areaFor(payload.competition.code),
        };

        const seasonStart = payload.filters?.season;
        const seasonLabel =
          seasonStart && /^\d{4}$/.test(seasonStart)
            ? `${seasonStart}/${String(Number(seasonStart) + 1).slice(2)}`
            : (seasonStart ?? null);

        for (const match of payload.matches) {
          const status = mapStatus(match.status);

          // Regla del MVP: sin resultados en vivo. Un partido no finalizado se
          // guarda sin marcador aunque la API ya publique un parcial.
          const fullTime = match.score?.fullTime;
          const finished = status === "finished";
          const hasFullTime =
            finished &&
            fullTime?.home !== null &&
            fullTime?.home !== undefined &&
            fullTime?.away !== null &&
            fullTime?.away !== undefined;

          const home: ProviderTeam = {
            providerId: `fd:${match.homeTeam.id}`,
            name: match.homeTeam.name,
            shortName: match.homeTeam.shortName ?? null,
            tla: match.homeTeam.tla ?? null,
          };

          const away: ProviderTeam = {
            providerId: `fd:${match.awayTeam.id}`,
            name: match.awayTeam.name,
            shortName: match.awayTeam.shortName ?? null,
            tla: match.awayTeam.tla ?? null,
          };

          collected.push({
            providerId: `fd:${match.id}`,
            competition,
            season: seasonLabel,
            matchday: match.matchday ?? null,
            kickoffUtc: new Date(match.utcDate).toISOString(),
            status,
            home,
            away,
            homeScore: hasFullTime ? (fullTime?.home ?? null) : null,
            awayScore: hasFullTime ? (fullTime?.away ?? null) : null,
            venue: match.venue ?? null,
          });
        }
      }

      return collected;
    },
  };
}

export { ProviderRequestError };
