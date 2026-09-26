import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { randomUUID } from "node:crypto";

async function model() {
  const html = await readFile(
    new URL("../public/index.html", import.meta.url),
    "utf8",
  );
  const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const element = {
    dataset: {},
    getContext: () => ({}),
    setAttribute() {},
    addEventListener() {},
  };
  const sandbox = {
    document: {
      getElementById: () => element,
      querySelectorAll: () => [],
      addEventListener() {},
    },
    window: { addEventListener() {} },
    matchMedia: () => ({ matches: false }),
    localStorage: { getItem: () => null },
    requestAnimationFrame() {},
    performance: { now: () => 0 },
    crypto: { randomUUID },
  };
  const insertion = `globalThis.game = {
    resetGame, startArcade, updateArcade, useStation, spawnWave, spawnPatron, spawnIncident, resolveIncident, incidentPoints, confrontIncident, startChallenge, challengeInput, jostle, serve, pickEnding, finishArcade, input,
    state: () => ({ meters, factions, mask, arcade, score, ending, player, screen, dialog, shown, policy }),
    setup: (values) => {
      if (values.meters) meters = values.meters;
      if (values.factions) factions = values.factions;
      if (values.mask) mask = values.mask;
      if (values.player) player = values.player;
      if (values.screen) screen = values.screen;
      if (values.policy) policy = values.policy;
      if (values.clearDialog) dialog = null;
    },
    stations: STATIONS, masks: MASKS, incidents: INCIDENTS, maxScore: 10500
  };`;
  const closing = source.lastIndexOf("})();");
  runInNewContext(
    source.slice(0, closing) + insertion + source.slice(closing),
    sandbox,
  );
  return sandbox.game;
}

test("all four warm endings are reachable from final meters and choices", async () => {
  const game = await model();
  const cases = [
    [
      { profit: 60, trust: 80, chaos: 20 },
      { care: 3, clown: 0, petition: 0 },
      "compromise",
    ],
    [
      { profit: 45, trust: 50, chaos: 55 },
      { care: 0, clown: 3, petition: 0 },
      "clown",
    ],
    [
      { profit: 50, trust: 40, chaos: 80 },
      { care: 0, clown: 0, petition: 0 },
      "viral",
    ],
    [
      { profit: 30, trust: 55, chaos: 45 },
      { care: 0, clown: 0, petition: 0 },
      "committee",
    ],
  ];
  for (const [meters, factions, expected] of cases) {
    game.setup({ meters, factions });
    expect(game.pickEnding()).toBe(expected);
  }
  game.setup({ policy: "retreat" });
  expect(game.pickEnding()).toBe("clown");
});

test("masks have distinct stamina, trust, vibe, and sick-day effects", async () => {
  const snapshots = [];
  for (let base = 0; base < 4; base++) {
    const game = await model();
    game.resetGame();
    game.setup({
      mask: { base, color: 0, pattern: 0, accessory: 3 },
      clearDialog: true,
    });
    game.startArcade();
    const state = game.state();
    snapshots.push({
      stamina: state.arcade.stamina,
      trust: state.meters.trust,
      vibe: state.arcade.vibe,
    });
    state.arcade.elapsed = 27.99;
    state.arcade.spawned = 30;
    state.arcade.waves = 6;
    state.arcade.patrons = [];
    game.updateArcade(0.02);
    snapshots[base].profit = state.meters.profit;
  }
  expect(snapshots.map((value) => value.stamina)).toEqual([5, 3, 1, 0]);
  expect(snapshots[1].trust).toBeGreaterThan(snapshots[3].trust);
  expect(snapshots[2].vibe - snapshots[3].vibe).toBe(30);
  expect(snapshots[0].profit).toBeGreaterThan(snapshots[3].profit);
});

test("story allies change waves; relevant stations resolve visitors once and respect cooldowns", async () => {
  const game = await model();
  game.resetGame();
  game.setup({ clearDialog: true });
  game.startArcade();
  game.spawnWave();
  expect(game.state().arcade.visitors).toHaveLength(1);
  const snacks = game.stations.find((station) => station.id === "snacks");
  game.useStation(snacks);
  expect(game.state().arcade.visitors).toHaveLength(0);
  expect(game.state().arcade.points).toBe(150);
  expect(game.state().arcade.resolved).toBe(0);
  game.useStation(snacks);
  expect(game.state().arcade.points).toBe(150);
  game.useStation(game.stations.find((station) => station.id === "chalk"));
  expect(game.state().arcade.points).toBe(650);
  expect(game.state().arcade.resolved).toBe(1);
  game.setup({ factions: { care: 3, clown: 3, petition: 3 } });
  game.spawnWave();
  expect(game.state().arcade.visitors).toHaveLength(0);
  expect(game.state().arcade.points).toBe(800);
});

test("optional drinks serve once; incidents and waves are bounded; score matches the server ceiling", async () => {
  const game = await model();
  game.resetGame();
  game.setup({ clearDialog: true });
  game.startArcade();
  game.spawnPatron();
  const patron = game.state().arcade.patrons[0];
  game.setup({ player: { x: patron.x, y: patron.y + 1, dir: "up" } });
  game.input("up");
  expect(game.state().arcade.served).toBe(1);
  expect(game.state().arcade.patrons).toHaveLength(0);
  const points = game.state().arcade.points;
  game.input("up");
  expect(game.state().arcade.points).toBe(points);
  for (let i = 0; i < 900; i++) {
    game.updateArcade(0.1);
    if (game.state().dialog?.speaker.includes("GLOBE")) {
      game.input("right");
      game.input("right");
    }
  }
  expect(game.state().arcade.spawned).toBe(6);
  expect(game.state().arcade.incidentCount).toBe(9);
  expect(Number.isInteger(game.state().player.x)).toBe(true);
  expect(Number.isInteger(game.state().player.y)).toBe(true);
  expect(game.state().arcade.hazards.length).toBeLessThanOrEqual(36);
  expect(game.state().arcade.waves).toBe(6);
  game.setup({ meters: { profit: 100, trust: 100, chaos: 0 } });
  game.state().arcade.points = 7500;
  game.finishArcade();
  expect(game.state().score).toBe(game.maxScore);
  const validation = await readFile(
    new URL("../src/validation.ts", import.meta.url),
    "utf8",
  );
  expect(validation).toContain("MAX_SCORE = 10_500");
});

test("Mask Lab encounter pauses the room, offers a quotable choice, and cannot award twice", async () => {
  const game = await model();
  game.resetGame();
  game.setup({ clearDialog: true });
  game.startArcade();
  const incident = game.state().arcade.incidents[0];
  game.input("right");
  game.input("right");
  expect(game.state().dialog.speaker).toContain("SIGN-UP SHEET");
  game.updateArcade(5);
  expect(game.state().arcade.elapsed).toBe(0);
  game.input("right");
  game.input("down");
  game.input("right");
  expect(game.state().arcade.resolved).toBe(1);
  expect(game.state().arcade.points).toBe(500);
  expect(game.state().factions.clown).toBe(1);
  expect(game.resolveIncident(incident)).toBe(false);
  expect(game.state().arcade.points).toBe(500);
});

test("the Globe reporter returns with questions and quick answers score more", async () => {
  const game = await model();
  expect(
    game.incidents
      .filter((incident) => incident.type === "reporter")
      .map((incident) => incident.at),
  ).toEqual([8, 37, 69]);
  game.resetGame();
  game.setup({ clearDialog: true });
  game.startArcade();
  game.spawnIncident();
  const reporter = game.state().arcade.incidents[1];
  expect(game.incidentPoints(reporter, "clear")).toBe(450);
  expect(game.incidentPoints(reporter, "headline")).toBe(500);
  game.state().arcade.elapsed = reporter.born + 15;
  expect(game.incidentPoints(reporter, "clear")).toBe(300);
  game.setup({ player: { x: reporter.x + 1, y: reporter.y, dir: "left" } });
  reporter.nextMove = 0;
  game.updateArcade(0.1);
  expect(game.state().dialog.speaker).toContain("GLOBE");
});

test("dance sequences pause the shift, accept all arrows, and remain retryable after timeout", async () => {
  const game = await model();
  game.resetGame();
  game.setup({ clearDialog: true });
  game.startArcade();
  game.spawnIncident();
  game.spawnIncident();
  const conga = game
    .state()
    .arcade.incidents.find((item) => item.type === "conga");
  game.startChallenge(conga);
  game.updateArcade(2);
  expect(game.state().arcade.elapsed).toBe(0);
  expect(game.state().arcade.challenge.remaining).toBe(6);
  const pattern = [...game.state().arcade.challenge.pattern];
  const position = { ...game.state().player };
  for (const dir of pattern) game.input(dir);
  expect(game.state().arcade.challenge).toBe(null);
  expect(game.state().arcade.resolved).toBe(1);
  expect({ ...game.state().player }).toEqual(position);
  game.spawnIncident();
  game.spawnIncident();
  game.spawnIncident();
  game.spawnIncident();
  const exes = game
    .state()
    .arcade.incidents.find((item) => item.type === "exes");
  game.startChallenge(exes);
  game.updateArcade(8.1);
  expect(game.state().arcade.challenge).toBe(null);
  expect(game.state().arcade.incidents.includes(exes)).toBe(true);
  game.startChallenge(exes);
  for (const dir of [...game.state().arcade.challenge.pattern]) game.input(dir);
  expect(game.state().arcade.resolved).toBe(2);
});

test("three saves clear hazards and recharge tools; chains expire", async () => {
  const game = await model();
  game.resetGame();
  game.setup({ clearDialog: true });
  game.startArcade();
  game.spawnIncident();
  game.spawnIncident();
  for (const incident of [...game.state().arcade.incidents])
    game.resolveIncident(incident);
  expect(game.state().arcade.points).toBe(1425);
  expect(game.state().arcade.combo).toBe(3);
  expect(game.state().arcade.invincibleUntil).toBe(3);
  expect(Object.keys(game.state().arcade.cooldowns)).toHaveLength(0);
  game.state().arcade.elapsed = 15;
  game.spawnIncident();
  game.resolveIncident(game.state().arcade.incidents[0]);
  expect(game.state().arcade.combo).toBe(1);
});

test("stamina cushions collisions and ignoring a drink causes no meter penalty", async () => {
  const game = await model();
  game.resetGame();
  game.setup({ clearDialog: true });
  game.startArcade();
  const before = { ...game.state().meters };
  game.jostle(1, 0);
  expect(game.state().arcade.stamina).toBe(4);
  game.jostle(1, 0);
  expect(game.state().arcade.stamina).toBe(4);
  expect({ ...game.state().meters }).toEqual(before);
  game.spawnPatron();
  game.state().arcade.patrons[0].patience = 0.01;
  game.updateArcade(0.02);
  expect(game.state().arcade.patrons).toHaveLength(0);
  expect({ ...game.state().meters }).toEqual(before);
});
