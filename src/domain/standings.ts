import { isPlayed, type Match } from "./match";

export interface StandingRow {
  teamId: string;
  teamName: string;
  tla: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

/**
 * Calcula la tabla de posiciones a partir de los partidos jugados.
 *
 * Por que calcularla en vez de pedirla a la API: football-data.org la expone en
 * /standings, pero calcularla en el dominio hace que el MVP tenga tablas
 * coherentes con los partidos que ya guardamos, sin depender de otra llamada
 * (el plan gratuito esta limitado a 10 req/min). Ademas es una funcion pura,
 * trivial de testear, que es exactamente el punto que queremos defender.
 *
 * Criterios de desempate (iguales a FIFA/UEFA): puntos, diferencia de gol,
 * goles a favor, nombre.
 */
export function computeStandings(matches: Match[]): StandingRow[] {
  const table = new Map<string, StandingRow>();

  function rowFor(teamId: string, name: string, tla: string | null): StandingRow {
    let row = table.get(teamId);
    if (!row) {
      row = {
        teamId,
        teamName: name,
        tla,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      };
      table.set(teamId, row);
    }
    return row;
  }

  for (const match of matches) {
    if (!isPlayed(match)) continue;

    const home = rowFor(match.homeTeam.id, match.homeTeam.name, match.homeTeam.tla);
    const away = rowFor(match.awayTeam.id, match.awayTeam.name, match.awayTeam.tla);

    home.played += 1;
    away.played += 1;

    home.goalsFor += match.homeScore;
    home.goalsAgainst += match.awayScore;
    away.goalsFor += match.awayScore;
    away.goalsAgainst += match.homeScore;

    if (match.homeScore > match.awayScore) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
    } else if (match.homeScore < match.awayScore) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  const rows = [...table.values()];
  for (const row of rows) {
    row.goalDifference = row.goalsFor - row.goalsAgainst;
  }

  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor ||
      a.teamName.localeCompare(b.teamName, "es"),
  );

  return rows;
}
