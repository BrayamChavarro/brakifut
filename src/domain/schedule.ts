/**
 * Generador de calendario por el metodo del circulo (round-robin).
 *
 * Es el algoritmo clasico: se fija un equipo y se rotan los demas, de modo que
 * en n-1 rondas cada equipo enfrenta a todos los demas exactamente una vez.
 * Con n par se juegan n/2 partidos por ronda.
 *
 * Lo usamos para construir el dataset de demostracion: permite tener un
 * historial realista y coherente (sin equipos que se enfrenten dos veces en la
 * misma jornada) sin depender de la red.
 */

export interface ScheduledFixture {
  matchday: number;
  homeTeamId: string;
  awayTeamId: string;
}

/**
 * Devuelve las rondas del fixture de una sola rueda.
 * Requiere una cantidad par de equipos.
 */
export function roundRobin(teamIds: string[]): ScheduledFixture[][] {
  if (teamIds.length % 2 !== 0) {
    throw new Error("roundRobin: se necesita una cantidad par de equipos");
  }

  const rotation = [...teamIds];
  const half = rotation.length / 2;
  const rounds: ScheduledFixture[][] = [];

  for (let round = 0; round < rotation.length - 1; round += 1) {
    const fixtures: ScheduledFixture[] = [];

    for (let i = 0; i < half; i += 1) {
      const first = rotation[i];
      const second = rotation[rotation.length - 1 - i];

      // Alternamos la localia para que ningun equipo sea local siempre.
      const home = round % 2 === 0 ? first : second;
      const away = round % 2 === 0 ? second : first;

      fixtures.push({ matchday: round + 1, homeTeamId: home, awayTeamId: away });
    }

    rounds.push(fixtures);

    // Rotacion: el primero queda fijo, el resto rota en sentido horario.
    const last = rotation.pop();
    if (last === undefined) break;
    rotation.splice(1, 0, last);
  }

  return rounds;
}

/** Fixture de ida y vuelta (n-1 rondas de ida + n-1 de vuelta). */
export function doubleRoundRobin(teamIds: string[]): ScheduledFixture[][] {
  const firstLeg = roundRobin(teamIds);
  const totalRounds = firstLeg.length;

  const secondLeg = firstLeg.map((round) =>
    round.map((fixture) => ({
      matchday: fixture.matchday + totalRounds,
      homeTeamId: fixture.awayTeamId,
      awayTeamId: fixture.homeTeamId,
    })),
  );

  return [...firstLeg, ...secondLeg];
}
