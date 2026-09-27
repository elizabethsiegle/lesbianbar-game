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
    startAdventure, visitQuest, rejoinZoom, adventureZoom, startAdventureSaturday, adventurePoints, adventureProgress, questMenu, adventureNotebook,
    state: () => ({ meters, factions, mask, arcade, adventure, score, ending, player, screen, dialog, shown, policy }),
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

function dismiss(game) {
  for (
    let i = 0;
    i < 40 && game.state().dialog && !game.state().dialog.choices;
    i++
  )
    game.input("right");
}

function pick(game, index = 0) {
  const dialog = game.state().dialog;
  expect(dialog?.choices).toBeTruthy();
  if (dialog.chars < dialog.pages[dialog.page].length) game.input("right");
  for (let i = 0; i < index; i++) game.input("down");
  game.input("right");
  dismiss(game);
}

async function adventureGame(base = 0) {
  const game = await model();
  game.startAdventure();
  dismiss(game);
  game.setup({ mask: { base, color: 1, pattern: 0, accessory: 0 } });
  for (let i = 0; i < 4; i++) game.input("down");
  game.input("right");
  pick(game);
  return game;
}

function completeQuest(game, id) {
  for (let i = 0; i < 2; i++) {
    game.visitQuest(id);
    pick(game);
  }
}

test("quests spend finite errands, back is free, and repeat visits cannot farm points", async () => {
  const game = await adventureGame();
  game.visitQuest("access");
  game.input("right");
  game.input("left");
  expect(game.state().screen).toBe("quests");
  expect(game.state().adventure.remaining).toBe(2);
  completeQuest(game, "access");
  const { points } = game.state().adventure;
  expect(game.state().adventure.remaining).toBe(0);
  expect(game.state().adventure.flags.access).toBe(true);
  game.visitQuest("access");
  dismiss(game);
  game.visitQuest("notes");
  dismiss(game);
  expect(game.state().adventure.points).toBe(points);
  expect(game.state().adventure.progress.notes).toBe(0);
  game.adventureNotebook();
  dismiss(game);
  expect(game.state().adventure.remaining).toBe(0);
  game.rejoinZoom();
  pick(game);
  pick(game);
  expect(game.state().adventure.round).toBe(1);
  expect(game.state().adventure.remaining).toBe(2);
});

test("route progress follows story beats and quest previews show available points", async () => {
  const game = await adventureGame();
  expect(game.adventureProgress()).toEqual({
    completed: 1,
    total: 7,
    next: "BRIDGE THE SPLIT",
  });
  expect(game.questMenu()[0].detail).toContain("Best available: +150");
  game.visitQuest("notes");
  pick(game, 1);
  expect(game.questMenu()[2].detail).toContain("Best available: +100");
  game.state().adventure.flags.access = true;
  expect(game.questMenu()[2].detail).toContain("Best available: +450");
});

test("the meme premise connects the mask split, clown class, and reporter to scoring", async () => {
  const intro = await model();
  intro.startAdventure();
  expect(intro.state().dialog.pages[0]).toContain(
    "COVID-conscious lesbian bar in Greenfield",
  );
  expect(intro.state().dialog.pages[1]).toContain("clown-school class");

  const classRoute = await adventureGame();
  classRoute.visitQuest("clowns");
  expect(classRoute.state().dialog.pages[0]).toContain("clown class");
  pick(classRoute);
  expect(classRoute.state().adventure.points).toBe(900);

  const pressRoute = await adventureGame();
  pressRoute.visitQuest("notes");
  expect(pressRoute.state().dialog.pages[0]).toContain(
    "splintering the queer community",
  );
  pick(pressRoute);
  expect(pressRoute.state().adventure.flags.timeline).toBe(true);
  expect(pressRoute.state().adventure.points).toBe(950);
});

test("failed errands lose real points and never grant the successful quest evidence", async () => {
  const game = await adventureGame();
  game.visitQuest("tickets");
  pick(game, 1);
  expect(game.state().adventure.points).toBe(500);
  game.visitQuest("tickets");
  pick(game, 1);
  expect(game.state().adventure.points).toBe(150);
  expect(game.state().adventure.lost).toBe(600);
  expect(game.state().adventure.flags.tickets).toBeUndefined();
  expect(game.questMenu()[4].label).toContain("CLOSED");
  expect(game.questMenu()[4].detail).toContain("without the reward");
});

test("locked evidence and stamina answers cannot be selected; every mask can proceed", async () => {
  for (let base = 0; base < 4; base++) {
    const game = await adventureGame(base);
    const before = game.state().adventure.points;
    game.rejoinZoom();
    pick(game, 1);
    expect(game.state().adventure.round).toBe(1);
    pick(game);
    expect(game.state().dialog.speaker).toContain("NORA");
    expect(game.state().adventure.points).toBe(before);
    pick(game, 1);
    expect(game.state().adventure.promises.access).toBe(true);
    if (base >= 2) {
      pick(game);
      expect(game.state().dialog.speaker).toContain("PAT");
      pick(game, 1);
    } else pick(game);
    expect(game.state().screen).toBe("quests");
    expect(game.state().adventure.stamina).toBe([4, 2, 1, 0][base]);
  }
});

test("call-out waves drain each mask's hearts, charge for overflow, and recover once per recess", async () => {
  const expected = [
    { afterFirst: 3, afterRecess: 3, points: 300, trust: 66, chaos: 25 },
    { afterFirst: 1, afterRecess: 1, points: 300, trust: 76, chaos: 25 },
    { afterFirst: 0, afterRecess: 1, points: 150, trust: 62, chaos: 29 },
    { afterFirst: 0, afterRecess: 0, points: 75, trust: 60, chaos: 31 },
  ];
  for (let base = 0; base < 4; base++) {
    const game = await adventureGame(base);
    expect(game.state().adventure.stamina).toBe([5, 3, 1, 0][base]);
    game.rejoinZoom();
    pick(game, 1);
    pick(game, 2);
    expect(game.state().adventure.stamina).toBe(expected[base].afterFirst);
    expect(game.state().adventure.callouts).toBe(2);
    pick(game, 2);
    expect(game.state().screen).toBe("quests");
    expect(game.state().adventure.stamina).toBe(expected[base].afterRecess);
    expect(game.state().adventure.recessRecovery).toBe(base === 3 ? 0 : 1);
    expect(game.state().adventure.callouts).toBe(3);
    expect(game.state().adventure.points).toBe(expected[base].points);
    expect(game.state().meters.trust).toBe(expected[base].trust);
    expect(game.state().meters.chaos).toBe(expected[base].chaos);
    expect(
      game
        .state()
        .adventure.ledger.filter((entry) => entry.label === "Call-out pile-on"),
    ).toHaveLength(base < 2 ? 0 : 2);
  }
});

test("Saturday rewards kept promises and deducts points for broken promises only once", async () => {
  for (const kept of [true, false]) {
    const game = await adventureGame();
    const state = game.state();
    state.adventure.points = 1000;
    state.adventure.promises.access = true;
    state.adventure.flags.access = kept;
    game.startAdventureSaturday();
    expect(state.adventure.points).toBe(kept ? 1450 : 550);
    expect(state.adventure.ledger.at(-1).delta).toBe(kept ? 450 : -450);
    game.startAdventureSaturday();
    expect(state.adventure.points).toBe(kept ? 1450 : 550);
    dismiss(game);
    const before = state.adventure.points;
    pick(game, 3);
    expect(state.adventure.points).toBe(before - 150);
    expect(state.adventure.resolved.has("saturday-fundraiser")).toBe(true);
  }
});

test("a full evidence route uses six errands, earns a valid score, and resets cleanly", async () => {
  const game = await adventureGame();
  completeQuest(game, "access");
  game.rejoinZoom();
  pick(game);
  pick(game);
  completeQuest(game, "tickets");
  game.rejoinZoom();
  pick(game);
  pick(game);
  completeQuest(game, "notes");
  game.rejoinZoom();
  pick(game);
  pick(game);
  pick(game, 2);
  pick(game);
  pick(game);
  expect(game.state().screen).toBe("tally");
  expect(game.state().ending).toBe("compromise");
  expect(game.state().score).toBeGreaterThan(6000);
  expect(game.state().score).toBeLessThanOrEqual(game.maxScore);
  expect(game.state().arcade).toBeNull();
  expect(
    Object.values(game.state().adventure.progress).reduce((a, b) => a + b, 0),
  ).toBe(6);
  game.startAdventure();
  expect(game.state().adventure.points).toBe(500);
  expect(game.state().adventure.resolved.size).toBe(0);
  expect(game.state().adventure.promises.access).toBeUndefined();
});

test("clown-school retreat stays reachable without evidence or stamina", async () => {
  const game = await adventureGame(3);
  for (let round = 0; round < 3; round++) {
    game.rejoinZoom();
    pick(game, 1);
    if (round === 0) {
      pick(game, 1);
      pick(game, 1);
    }
    if (round === 1) {
      pick(game, 1);
      pick(game);
    }
  }
  pick(game, 2);
  pick(game, 1);
  pick(game, 3);
  pick(game, 2);
  pick(game, 1);
  expect(game.state().screen).toBe("tally");
  expect(game.state().ending).toBe("clown");
  expect(game.state().score).toBeGreaterThanOrEqual(0);
});
