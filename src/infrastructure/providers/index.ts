import { createFootballDataProvider } from "./football-data";
import { createSeedProvider } from "./seed";
import type { FootballProvider } from "./types";

export type {
  FetchMatchesInput,
  FootballProvider,
  ProviderCapabilities,
  ProviderCompetition,
  ProviderMatch,
  ProviderTeam,
} from "./types";

export { slugify } from "./types";

/**
 * Selecciona el adaptador segun FOOTBALL_PROVIDER.
 *
 * Por defecto "seed": el proyecto tiene que poder clonarse, instalarse y
 * ejecutarse sin registrarse en ningun servicio. Con FOOTBALL_PROVIDER=football-data
 * y una FOOTBALL_API_KEY se sincronizan datos reales.
 */
export function getProvider(name?: string): FootballProvider {
  const requested = (name ?? process.env.FOOTBALL_PROVIDER ?? "seed").trim().toLowerCase();

  if (requested === "football-data" || requested === "football_data" || requested === "fd") {
    return createFootballDataProvider();
  }

  return createSeedProvider();
}

export function providerLabel(name: string): string {
  return name === "football-data" ? "football-data.org" : "Dataset de demostración";
}
