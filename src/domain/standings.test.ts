import assert from "node:assert/strict";
import { test } from "node:test";

import type { Match, MatchStatus } from "./match";
import { computeStandings } from "./standings";

function match(
  id: string,
  home: string,
  away: string,
  homeScore: number | null,
  awayScore: number | null,
  status: MatchStatus = "finished",
): Match {
  return {
    id,
    competitionId: "c1",
    competitionName: "Liga de prueba",
    competitionSlug: "liga-de-prueba",
    season: "2025/26",
    matchday: 1,
    kickoffUtc: "2025-01-01T12:00:00.000Z",
    status,
    homeTeam: { id: home, name: home, shortName: null, tla: null },
    awayTeam: { id: away, name: away, shortName: null, tla: null },
    homeScore,
    awayScore,
    venue: null,
    source: "test",
    updatedAt: "2025-01-01T12:00:00.000Z",
  };
}

test("una victoria da 3 puntos al ganador y 0 al perdedor", () => {
  const table = computeStandings([match("m1", "A", "B", 2, 0)]);

  const a = table.find((row) => row.teamId === "A");
  const b = table.find((row) => row.teamId === "B");

  assert.equal(a?.points, 3);
  assert.equal(a?.won, 1);
  assert.equal(b?.points, 0);
  assert.equal(b?.lost, 1);
});

test("un empate da 1 punto a cada equipo", () => {
  const table = computeStandings([match("m1", "A", "B", 1, 1)]);

  assert.equal(table.find((row) => row.teamId === "A")?.points, 1);
  assert.equal(table.find((row) => row.teamId === "B")?.points, 1);
});

test("los partidos no finalizados no se cuentan", () => {
  const table = computeStandings([
    match("m1", "A", "B", null, null, "scheduled"),
    match("m2", "A", "C", 3, 1, "finished"),
  ]);

  // B solo aparece si participo de un partido, y con 0 jugados.
  const b = table.find((row) => row.teamId === "B");
  assert.equal(b, undefined, "un partido programado no debe crear fila con partidos jugados");

  assert.equal(table.find((row) => row.teamId === "A")?.played, 1);
});

test("acumula goles a favor, en contra y diferencia", () => {
  const table = computeStandings([
    match("m1", "A", "B", 3, 1),
    match("m2", "A", "C", 2, 2),
  ]);

  const a = table.find((row) => row.teamId === "A");
  assert.equal(a?.played, 2);
  assert.equal(a?.goalsFor, 5);
  assert.equal(a?.goalsAgainst, 3);
  assert.equal(a?.goalDifference, 2);
  assert.equal(a?.points, 4); // 3 por la victoria + 1 por el empate
});

test("ordena por puntos y desempata por diferencia de gol", () => {
  // Ambos ganan: 3 puntos cada uno. A gana por mas goles de diferencia.
  const table = computeStandings([
    match("m1", "A", "C", 3, 0),
    match("m2", "B", "D", 1, 0),
  ]);

  assert.equal(table[0].points, table[1].points, "el test necesita un empate en puntos");
  assert.equal(table[0].teamId, "A", "mejor diferencia de gol debe ir primero");
  assert.equal(table[1].teamId, "B");
});

test("una victoria y un empate superan a una sola victoria", () => {
  const table = computeStandings([
    match("m1", "A", "C", 3, 0),
    match("m2", "B", "D", 1, 0),
    match("m3", "B", "A", 1, 1),
  ]);

  // B: 3 + 1 = 4 puntos. A: 3 + 1 = 4 puntos.
  // El desempate queda en la diferencia de gol: A +3 - 1 = +2; B +1 +0 = +1.
  assert.equal(table[0].teamId, "A");
  assert.equal(table.find((row) => row.teamId === "B")?.points, 4);
});

test("el orden es determinista y no depende del orden de entrada", () => {
  const matches = [
    match("m1", "A", "B", 1, 0),
    match("m2", "C", "D", 2, 2),
    match("m3", "A", "C", 0, 1),
  ];

  const forward = computeStandings(matches);
  const backward = computeStandings([...matches].reverse());

  assert.deepEqual(
    forward.map((row) => row.teamId),
    backward.map((row) => row.teamId),
  );
});
