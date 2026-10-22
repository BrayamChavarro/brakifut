import { doubleRoundRobin } from "@/domain/schedule";

import {
  slugify,
  type FetchMatchesInput,
  type FootballProvider,
  type ProviderCompetition,
  type ProviderMatch,
  type ProviderTeam,
} from "./types";

/**
 * Proveedor de demostracion.
 *
 * Por que existe: un MVP universitario tiene que poder ejecutarse y mostrarse
 * sin registro previo ni API key. Este adaptador genera un historial completo y
 * determinista en el primer arranque, de modo que la busqueda, las tablas y el
 * detalle de partido son demostrables de inmediato.
 *
 * Por que es determinista: el mismo equipo siempre obtiene los mismos
 * resultados. Sin eso, cada re-siembra cambiaria el historial y no se podria
 * mostrar dos veces la misma pantalla en una defensa.
 *
 * Los datos son SINTETICOS, no reales. La UI lo declara de forma explicita para
 * no presentarlos como resultados historicos verdaderos.
 */

interface SeedCompetition {
  code: string;
  slug: string;
  name: string;
  area: string;
  /** [nombre, tla] ordenados de mayor a menor fuerza percibida. */
  teams: [string, string][];
}

const COMPETITIONS: SeedCompetition[] = [
  {
    code: "PD",
    slug: "laliga",
    name: "LaLiga EA Sports",
    area: "España",
    teams: [
      ["Real Madrid", "RMA"],
      ["FC Barcelona", "BAR"],
      ["Atlético de Madrid", "ATM"],
      ["Athletic Club", "ATH"],
      ["Villarreal CF", "VIL"],
      ["Real Betis", "BET"],
      ["Real Sociedad", "RSO"],
      ["Sevilla FC", "SEV"],
      ["Valencia CF", "VAL"],
      ["Girona FC", "GIR"],
      ["CA Osasuna", "OSA"],
      ["Celta de Vigo", "CEL"],
      ["Rayo Vallecano", "RAY"],
      ["RCD Mallorca", "MLL"],
      ["Getafe CF", "GET"],
      ["Deportivo Alavés", "ALA"],
      ["UD Las Palmas", "LPA"],
      ["RCD Espanyol", "ESP"],
      ["CD Leganés", "LEG"],
      ["Real Valladolid", "VLL"],
    ],
  },
  {
    code: "PL",
    slug: "premier-league",
    name: "Premier League",
    area: "Inglaterra",
    teams: [
      ["Liverpool FC", "LIV"],
      ["Arsenal FC", "ARS"],
      ["Manchester City", "MCI"],
      ["Chelsea FC", "CHE"],
      ["Newcastle United", "NEW"],
      ["Aston Villa", "AVL"],
      ["Nottingham Forest", "NFO"],
      ["Brighton & Hove Albion", "BHA"],
      ["AFC Bournemouth", "BOU"],
      ["Brentford FC", "BRE"],
      ["Fulham FC", "FUL"],
      ["Crystal Palace", "CRY"],
      ["Manchester United", "MUN"],
      ["Tottenham Hotspur", "TOT"],
      ["West Ham United", "WHU"],
      ["Everton FC", "EVE"],
      ["Wolverhampton Wanderers", "WOL"],
      ["Ipswich Town", "IPS"],
      ["Leicester City", "LEI"],
      ["Southampton FC", "SOU"],
    ],
  },
  {
    code: "SA",
    slug: "serie-a",
    name: "Serie A",
    area: "Italia",
    teams: [
      ["Inter de Milán", "INT"],
      ["SSC Napoli", "NAP"],
      ["Atalanta BC", "ATA"],
      ["Juventus FC", "JUV"],
      ["SS Lazio", "LAZ"],
      ["AS Roma", "ROM"],
      ["AC Milan", "MIL"],
      ["ACF Fiorentina", "FIO"],
      ["Bologna FC", "BOL"],
      ["Torino FC", "TOR"],
      ["Udinese Calcio", "UDI"],
      ["Genoa CFC", "GEN"],
      ["Empoli FC", "EMP"],
      ["Cagliari Calcio", "CAG"],
      ["Hellas Verona", "VER"],
      ["US Lecce", "LEC"],
      ["Parma Calcio", "PAR"],
      ["Como 1907", "COM"],
      ["AC Monza", "MON"],
      ["Venezia FC", "VEN"],
    ],
  },
  {
    code: "BL1",
    slug: "bundesliga",
    name: "Bundesliga",
    area: "Alemania",
    teams: [
      ["Bayern Múnich", "FCB"],
      ["Bayer Leverkusen", "B04"],
      ["Eintracht Frankfurt", "SGE"],
      ["RB Leipzig", "RBL"],
      ["Borussia Dortmund", "BVB"],
      ["SC Freiburg", "SCF"],
      ["1. FSV Mainz 05", "M05"],
      ["VfB Stuttgart", "VFB"],
      ["VfL Wolfsburg", "WOB"],
      ["Borussia Mönchengladbach", "BMG"],
      ["SV Werder Bremen", "SVW"],
      ["FC Augsburg", "FCA"],
      ["Union Berlin", "FCU"],
      ["TSG Hoffenheim", "TSG"],
      ["FC St. Pauli", "STP"],
      ["1. FC Heidenheim", "FCH"],
      ["VfL Bochum", "BOC"],
      ["Holstein Kiel", "KIE"],
    ],
  },
];

/* --------------------------------------------------------------- azar estable */

/**
 * mulberry32: generador pseudoaleatorio de 32 bits, deterministico y de una
 * sola linea de estado. No sirve para criptografia (y no lo necesitamos):
 * sirve para que la misma semilla produzca siempre el mismo historial.
 */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash simple y estable de string a entero sin signo. */
function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Muestreo de Poisson por el algoritmo de Knuth. Modela goles por partido. */
function poisson(lambda: number, random: () => number): number {
  const limit = Math.exp(-lambda);
  let k = 0;
  let product = random();
  while (product > limit && k < 12) {
    k += 1;
    product *= random();
  }
  return k;
}

/* ------------------------------------------------------------------ generacion */

function currentSeasonLabel(reference: Date): string {
  const year = reference.getUTCFullYear();
  const month = reference.getUTCMonth() + 1;
  // Las ligas europeas arrancan en agosto: julio ya pertenece a la temporada nueva.
  return month >= 7 ? `${year}/${String(year + 1).slice(2)}` : `${year - 1}/${String(year).slice(2)}`;
}

/** Fuerza normalizada 1 (el mas fuerte) a 0.45, segun el orden de la lista. */
function strengthFor(index: number, total: number): number {
  if (total <= 1) return 1;
  return 1 - (index / (total - 1)) * 0.55;
}

function buildCompetitionMatches(
  competition: SeedCompetition,
  reference: Date,
): ProviderMatch[] {
  const season = currentSeasonLabel(reference);

  const competitionIdentity: ProviderCompetition = {
    providerId: `seed:${competition.code}`,
    code: competition.code,
    slug: competition.slug,
    name: competition.name,
    area: competition.area,
  };

  const teams: ProviderTeam[] = competition.teams.map(([name, tla]) => ({
    providerId: `seed:${competition.code}:${slugify(name)}`,
    name,
    shortName: shortNameOf(name),
    tla,
  }));

  const strengths = new Map<string, number>();
  teams.forEach((team, index) => {
    strengths.set(team.providerId, strengthFor(index, teams.length));
  });

  const rounds = doubleRoundRobin(teams.map((team) => team.providerId));

  // Anclamos la temporada de modo que dos tercios de las jornadas ya se hayan
  // jugado: asi la vista por defecto muestra "proximos" y el resto es historial.
  const roundsPlayed = Math.max(1, Math.round((rounds.length * 2) / 3));
  const firstRoundDate = new Date(reference);
  firstRoundDate.setUTCDate(firstRoundDate.getUTCDate() - roundsPlayed * 7);

  const matches: ProviderMatch[] = [];

  rounds.forEach((round, roundIndex) => {
    for (const fixture of round) {
      const home = teams.find((team) => team.providerId === fixture.homeTeamId);
      const away = teams.find((team) => team.providerId === fixture.awayTeamId);
      if (!home || !away) continue;

      const providerId = `${competition.code}-${roundIndex + 1}-${home.providerId.split(":").pop()}-${away.providerId.split(":").pop()}`;

      const kickoff = new Date(firstRoundDate);
      kickoff.setUTCDate(kickoff.getUTCDate() + roundIndex * 7);
      // Repartimos los partidos de la jornada en cuatro franjas horarias.
      kickoff.setUTCHours(12 + (matches.length % 4) * 3, 0, 0, 0);

      const isPlayed = roundIndex < roundsPlayed;
      const random = createRandom(hashString(providerId));

      let homeScore: number | null = null;
      let awayScore: number | null = null;
      let status = "scheduled";

      if (isPlayed) {
        const homeStrength = strengths.get(home.providerId) ?? 0.7;
        const awayStrength = strengths.get(away.providerId) ?? 0.7;

        // La ventaja de localia es real en el futbol: ~0.35 goles de diferencia.
        const homeLambda = Math.max(0.3, 0.55 + homeStrength * 1.05 + 0.35 - awayStrength * 0.45);
        const awayLambda = Math.max(0.25, 0.45 + awayStrength * 1.0 - homeStrength * 0.4);

        homeScore = Math.min(6, poisson(homeLambda, random));
        awayScore = Math.min(6, poisson(awayLambda, random));
        status = "finished";
      }

      matches.push({
        providerId,
        competition: competitionIdentity,
        season,
        matchday: fixture.matchday,
        kickoffUtc: kickoff.toISOString(),
        status: status === "finished" ? "finished" : "scheduled",
        home,
        away,
        homeScore,
        awayScore,
        venue: null,
      });
    }
  });

  return matches;
}

function shortNameOf(name: string): string {
  return name
    .replace(/\b(FC|CF|CD|CA|SS|AC|BC|SV|SC|VfL|VfB|TSG|RB|UD|RCD|AFC)\b\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------------------------------------------ adaptador */

export function createSeedProvider(): FootballProvider {
  return {
    name: "seed",
    label: "Dataset de demostración (sintético)",
    capabilities: {
      liveScores: false,
      scorers: false,
      lineups: false,
      cards: false,
      advancedStats: false,
    },
    async fetchMatches(input: FetchMatchesInput = {}): Promise<ProviderMatch[]> {
      const reference = new Date();
      const wanted = input.competitionSlugs;

      const selected = wanted?.length
        ? COMPETITIONS.filter((competition) => wanted.includes(competition.slug))
        : COMPETITIONS;

      return selected.flatMap((competition) =>
        buildCompetitionMatches(competition, reference),
      );
    },
  };
}

export { COMPETITIONS as SEED_COMPETITIONS };
