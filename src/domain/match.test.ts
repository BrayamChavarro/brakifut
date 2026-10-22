import assert from "node:assert/strict";
import { test } from "node:test";

import type { Match, MatchStatus } from "./match";
import { aggregateWinner, hasScore, isPlayed, outcome, statusBadge } from "./match";

function match(
  home: string,
  away: string,
  homeScore: number | null,
  awayScore: number | null,
  status: MatchStatus = "finished",
): Match {
  return {
    id: `${home}-${away}`,
    competitionId: "c1",
    competitionName: "Test",
    competitionSlug: "test",
    season: null,
    matchday: null,
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

test("outcome distingue local, empate y visitante", () => {
  assert.equal(outcome(match("A", "B", 2, 1)), "home");
  assert.equal(outcome(match("A", "B", 0, 3)), "away");
  assert.equal(outcome(match("A", "B", 1, 1)), "draw");
});

test("outcome es null mientras el partido no termino", () => {
  assert.equal(outcome(match("A", "B", null, null, "scheduled")), null);
  assert.equal(outcome(match("A", "B", 1, 0, "live")), null);
});

test("isPlayed y hasScore solo aceptan partidos finalizados con marcador", () => {
  const finished = match("A", "B", 2, 0);
  assert.equal(isPlayed(finished), true);
  assert.equal(hasScore(finished), true);

  // Un partido finalizado sin marcador cargado no cuenta como jugado.
  assert.equal(isPlayed(match("A", "B", null, null)), false);
  // Un partido en vivo con marcador parcial no cuenta como jugado.
  assert.equal(isPlayed(match("A", "B", 1, 0, "live")), false);
});

test("aggregateWinner resuelve una llave a doble partido", () => {
  // Ida 2-0 en casa de A; vuelta 0-1 en casa de B => agregado 2-1 para A.
  const firstLeg = match("A", "B", 2, 0);
  const secondLeg = match("B", "A", 0, 1);

  assert.equal(aggregateWinner(firstLeg, secondLeg)?.id, "A");
});

test("aggregateWinner devuelve null si el agregado esta igualado", () => {
  const firstLeg = match("A", "B", 1, 1);
  const secondLeg = match("B", "A", 0, 0);

  assert.equal(aggregateWinner(firstLeg, secondLeg), null);
});

test("aggregateWinner rechaza partidos que no son de los mismos equipos", () => {
  assert.throws(
    () => aggregateWinner(match("A", "B", 1, 0), match("C", "D", 0, 0)),
    /mismos equipos/,
  );
});

test("statusBadge traduce el estado a etiqueta de interfaz", () => {
  assert.equal(statusBadge("finished"), "FINALIZADO");
  assert.equal(statusBadge("live"), "EN VIVO");
  assert.equal(statusBadge("scheduled"), "PROGRAMADO");
});
