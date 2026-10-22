import type { MatchStatus } from "@/domain/match";

/**
 * Puerto (interfaz) del proveedor de datos de futbol.
 *
 * La regla de dependencia es hacia adentro: el dominio y la aplicacion no
 * conocen a football-data.org. Solo conocen esta interfaz, y la infraestructura
 * provee la implementacion. Cambiar de proveedor = escribir otro adaptador,
 * sin tocar la UI ni el dominio.
 */

export interface ProviderTeam {
  providerId: string;
  name: string;
  shortName: string | null;
  tla: string | null;
}

export interface ProviderCompetition {
  providerId: string;
  code: string;
  slug: string;
  name: string;
  area: string | null;
}

export interface ProviderMatch {
  providerId: string;
  competition: ProviderCompetition;
  season: string | null;
  matchday: number | null;
  kickoffUtc: string;
  status: MatchStatus;
  home: ProviderTeam;
  away: ProviderTeam;
  homeScore: number | null;
  awayScore: number | null;
  venue: string | null;
}

/**
 * Declara que puede entregar cada proveedor. La UI lo consulta para no ofrecer
 * lo que no existe: si `scorers` es false, no se muestra la columna de
 * goleadores en vez de mostrar un panel vacio.
 */
export interface ProviderCapabilities {
  liveScores: boolean;
  scorers: boolean;
  lineups: boolean;
  cards: boolean;
  advancedStats: boolean;
}

export interface FetchMatchesInput {
  /** Limita la sincronizacion a estas competiciones (por slug). */
  competitionSlugs?: string[];
  season?: string;
}

export interface FootballProvider {
  readonly name: string;
  readonly label: string;
  readonly capabilities: ProviderCapabilities;
  fetchMatches(input?: FetchMatchesInput): Promise<ProviderMatch[]>;
}

/** Genera un slug estable y seguro para usar en rutas. */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
