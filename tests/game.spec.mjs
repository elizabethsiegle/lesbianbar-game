import { test, expect } from "@playwright/test";

async function press(page, key = "ArrowRight", count = 1) {
  for (let i = 0; i < count; i++) await page.keyboard.press(key);
}
async function start(page) {
  await page.clock.install({ time: new Date("2026-09-26T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-09-26T12:00:01Z"));
  await page.goto("/");
  await press(page, "ArrowRight", 2);
  await press(page, "ArrowRight", 6);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "world");
}
async function postAnnouncement(page) {
  await press(page, "ArrowUp", 4);
  await press(page, "ArrowRight", 4);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "feed");
  await page.clock.runFor(32);
  await page.screenshot({ path: "test-results/feed.png" });
  await press(page, "ArrowRight", 10);
  await press(page, "ArrowRight", 2);
  await press(page, "ArrowUp", 4);
  await press(page);
}
async function enterMaskEditor(page) {
  await press(page, "ArrowUp", 2);
  await press(page, "ArrowRight", 8);
  await press(page, "ArrowUp", 2);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "mask");
}
async function advanceShift(page) {
  for (let i = 0; i < 15; i++) {
    await page.clock.runFor(10_000);
    if ((await page.locator("#game").getAttribute("data-screen")) === "boss")
      return;
    if ((await page.locator("#mobile-readout").textContent()).startsWith("THE GLOBE"))
      await press(page, "ArrowRight", 2);
  }
  throw new Error("The shift did not reach the final boss.");
}

test("plays from title through town hall, mask editor, timed shift, boss, scores, and credits with arrows", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await start(page);
  await postAnnouncement(page);
  await press(page, "ArrowDown");
  await press(page);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "zoom");
  await page.clock.runFor(32);
  await page.screenshot({ path: "test-results/zoom.png" });
  await press(page, "ArrowRight", 12);
  await enterMaskEditor(page);
  await page.clock.runFor(32);
  await page.screenshot({ path: "test-results/mask.png" });
  await press(page, "ArrowDown", 4);
  await press(page, "ArrowRight", 2);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "arcade");
  await page.clock.runFor(2000);
  await page.screenshot({ path: "test-results/arcade.png" });
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.clock.runFor(1000);
  await press(page);
  await advanceShift(page);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "boss");
  await press(page, "ArrowRight", 8);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "tally");
  await press(page, "ArrowRight", 2);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "ending");
  await press(page);
  await expect(page.locator("#game")).toHaveAttribute(
    "data-screen",
    "initials",
  );
  await page.route(
    "**/api/score",
    (route) =>
      route.fulfill({ status: 503, json: { error: "HIGH SCORES OFFLINE" } }),
    { times: 1 },
  );
  await press(page, "ArrowUp");
  await press(page, "ArrowRight", 3);
  await expect(page.locator("#game-status")).toContainText(
    "HIGH SCORES OFFLINE",
  );
  await press(page);
  await expect(page.locator("#game")).toHaveAttribute(
    "data-screen",
    "leaderboard",
  );
  await press(page);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "credits");
  await press(page);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "title");
  expect(errors).toEqual([]);
});

test("NO plays the slow decline and returns to the decision", async ({
  page,
}) => {
  await start(page);
  await press(page, "ArrowUp", 4);
  await press(page);
  await press(page, "ArrowDown");
  await press(page);
  await expect(page.locator("#game-status")).toContainText("jukebox breaks");
  await press(page, "ArrowRight", 4);
  await expect(page.locator("#game-status")).toContainText("raccoon");
  await press(page, "ArrowRight", 4);
  await expect(page.locator("#game-status")).toContainText("Profits are down");
});

for (const branch of [
  { name: "reinstate masks", down: 0 },
  { name: "say nothing", down: 2 },
  { name: "retreat to clown school", down: 3 },
]) {
  test(`${branch.name} reaches customization and supports all four mask types`, async ({
    page,
  }) => {
    await start(page);
    await postAnnouncement(page);
    await press(page, "ArrowDown", branch.down);
    await press(page, "ArrowRight", 5);
    await enterMaskEditor(page);
    for (const label of ["CLOTH MASK", "NOVELTY MASK", "NO MASK", "N95"]) {
      await press(page);
      await expect(page.locator("#game-status")).toContainText(label);
    }
    await press(page, "ArrowDown");
    await press(page, "ArrowLeft");
    await press(page, "ArrowDown", 3);
    await press(page);
    await expect(page.locator("#game")).toHaveAttribute("data-screen", "ready");
    if (branch.down === 3) {
      await page.clock.runFor(32);
      await expect(page.locator("#mobile-readout")).toContainText(
        "CLASSROOM TWO POP-UP",
      );
      await press(page);
      await page.clock.runFor(32);
      await expect(page.locator("#game")).toHaveAttribute("data-screen", "arcade");
      await expect(page.locator("#mobile-readout")).toContainText(
        "CLOWN SCHOOL ROOM TWO",
      );
      await page.screenshot({ path: "test-results/clown-school.png" });
      return;
    }
    await press(page, "ArrowLeft");
    await expect(page.locator("#game")).toHaveAttribute("data-screen", "mask");
  });
}

test("failed leaderboard fetch is recoverable from the title", async ({
  page,
}) => {
  await page.route("**/api/leaderboard", (route) =>
    route.fulfill({ status: 503, json: { error: "HIGH SCORES OFFLINE" } }),
  );
  await page.goto("/");
  await press(page);
  await press(page, "ArrowDown", 2);
  await press(page);
  await expect(page.locator("#game-status")).toContainText(
    "HIGH SCORES OFFLINE",
  );
  await press(page, "ArrowLeft");
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "title");
  await press(page);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "world");
});

test("touch D-pad controls the same title menu and arrows do not scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("navigation", { name: "Touch game controls" }),
  ).toBeVisible();
  const down = page.getByRole("button", { name: "Down", exact: true });
  const right = page.getByRole("button", { name: "Right", exact: true });
  await right.click();
  await down.click();
  await down.click();
  await down.click();
  await right.click();
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "help");
  await expect(page.locator("#mobile-readout")).toContainText("FOUR KEYS");
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  const before = await page.evaluate(() => window.scrollY);
  await press(page, "ArrowDown", 10);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});

test("CHAOS MODE skips story, fixes Mask Lab, and wins a dance battle with only arrows", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.install({ time: new Date("2026-09-26T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-09-26T12:00:01Z"));
  await page.goto("/");
  await press(page);
  await press(page, "ArrowDown");
  await press(page);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "mask");
  await press(page, "ArrowDown", 4);
  await press(page, "ArrowRight", 2);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "arcade");
  await press(page, "ArrowRight", 2);
  await expect(page.locator("#game-status")).toContainText("SIGN-UP SHEET");
  await press(page);
  await press(page, "ArrowDown");
  await press(page);
  await expect(page.locator("#game-status")).toContainText("+500");
  await page.clock.runFor(17_050);
  if ((await page.locator("#mobile-readout").textContent()).startsWith("THE GLOBE")) {
    await press(page, "ArrowRight", 2);
    await page.clock.runFor(4_000);
  }
  await page.screenshot({ path: "test-results/chaos.png" });
  await press(page, "ArrowRight", 22);
  await press(page, "ArrowDown", 9);
  await press(page, "ArrowLeft");
  await press(page, "ArrowUp");
  await expect(page.locator("#game-status")).toContainText("Copy the arrows");
  await page.clock.runFor(32);
  await page.screenshot({ path: "test-results/dance.png" });
  await press(page, "ArrowLeft", 2);
  await press(page);
  await expect(page.locator("#game-status")).toContainText("+500");
  await page.clock.runFor(44_000);
  await page.screenshot({ path: "test-results/full-chaos.png" });
  expect(errors).toEqual([]);
});
