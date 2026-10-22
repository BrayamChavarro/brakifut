import assert from "node:assert/strict";
import { test } from "node:test";

import { doubleRoundRobin, roundRobin } from "./schedule";

test("el fixture de una rueda tiene n-1 jornadas y n/2 partidos por jornada", () => {
  const teams = ["A", "B", "C", "D"];
  const rounds = roundRobin(teams);

  assert.equal(rounds.length, 3);

  for (const round of rounds) {
    assert.equal(round.length, 2);
  }
});

test("cada equipo juega exactamente una vez por jornada", () => {
  const teams = ["A", "B", "C", "D", "E", "F"];

  for (const round of roundRobin(teams)) {
    const playing = round.flatMap((fixture) => [
      fixture.homeTeamId,
      fixture.awayTeamId,
    ]);

    assert.equal(new Set(playing).size, teams.length, "hay equipos repetidos en la jornada");
  }
});

test("cada par de equipos se enfrenta exactamente una vez en una rueda", () => {
  const teams = ["A", "B", "C", "D", "E", "F"];
  const pairs = new Set<string>();

  for (const round of roundRobin(teams)) {
    for (const fixture of round) {
      const key = [fixture.homeTeamId, fixture.awayTeamId].sort().join("-");
      assert.equal(pairs.has(key), false, `par repetido: ${key}`);
      pairs.add(key);
    }
  }

  // Combinaciones de 6 equipos tomados de a 2 = 15.
  assert.equal(pairs.size, 15);
});

test("ningun equipo es local en todas sus presentaciones", () => {
  const teams = ["A", "B", "C", "D"];
  const homeCount = new Map<string, number>();

  for (const round of roundRobin(teams)) {
    for (const fixture of round) {
      homeCount.set(fixture.homeTeamId, (homeCount.get(fixture.homeTeamId) ?? 0) + 1);
    }
  }

  for (const [, count] of homeCount) {
    assert.ok(count < teams.length - 1, "un equipo fue local en todos sus partidos");
  }
});

test("la ida y vuelta duplica las jornadas e invierte la localia", () => {
  const teams = ["A", "B", "C", "D"];
  const rounds = doubleRoundRobin(teams);

  assert.equal(rounds.length, 6, "4 equipos: 3 jornadas de ida y 3 de vuelta");

  const firstLeg = rounds.slice(0, 3);

  for (let index = 0; index < firstLeg.length; index += 1) {
    const secondLegRound = rounds[index + 3];
    const firstLegRound = firstLeg[index];

    for (let matchIndex = 0; matchIndex < firstLegRound.length; matchIndex += 1) {
      const home = firstLegRound[matchIndex];
      const away = secondLegRound[matchIndex];

      assert.equal(home.homeTeamId, away.awayTeamId);
      assert.equal(home.awayTeamId, away.homeTeamId);
    }
  }
});

test("rechaza una cantidad impar de equipos", () => {
  assert.throws(() => roundRobin(["A", "B", "C"]), /cantidad par/);
});
