import { test, expect } from "@playwright/test";

async function press(page, key = "ArrowRight", count = 1) {
  for (let i = 0; i < count; i++) await page.keyboard.press(key);
}

test("footer keeps the requested copy and drops the Wi-Fi joke", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".tagline")).toContainText(
    "ONE VERY LONG MEETING.",
  );
  await expect(page.locator(".tagline")).not.toContainText(
    "QUESTIONABLE WI-FI",
  );
  await expect(page.locator(".details")).toContainText("EVERYONE BELONGS");
  await expect(page.locator(".details")).toContainText(
    "VERY REAL COMMITTEE ENERGY",
  );
  await expect(page.locator(".details")).not.toContainText("Fictional town");
  await expect(page.locator(".credit-footer")).toContainText(
    "made w/ <3 in ATL 🍑 · prompts stored with Entire.io",
  );
  await expect(page.locator(".credit-footer a")).toHaveAttribute(
    "href",
    "https://entire.io/et/lesbianbar-game/lesbianbar-game/trails/7",
  );
});

test("sticky credit stays visible without covering mobile controls", async ({
  page,
}) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const credit = await page.locator(".credit-footer").boundingBox();
    const dpad = await page.locator(".dpad").boundingBox();
    expect(credit).not.toBeNull();
    expect(dpad).not.toBeNull();
    expect(Math.round(credit.y + credit.height)).toBe(844);
    expect(dpad.y + dpad.height).toBeLessThanOrEqual(credit.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
      width,
    );
  }
});

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
  await expect(page.locator("#leaderboard-dashboard")).toBeVisible();
  await expect(page.locator("#dashboard-status")).toContainText(
    "HIGH SCORES OFFLINE",
  );
  await press(page, "ArrowLeft");
  await expect(page.locator("#leaderboard-dashboard")).not.toBeVisible();
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "title");
  await press(page, "ArrowUp", 2);
  await press(page);
  await expect(page.locator("#game")).toHaveAttribute(
    "data-screen",
    "adventure",
  );
});

test("homepage button opens a live top-ten dashboard with score details", async ({
  page,
}) => {
  const scores = [
    {
      initials: "LIZ",
      score: 9200,
      ending: "compromise",
      mask: "n95",
      timestamp: "2026-09-27T12:00:00.000Z",
    },
    {
      initials: "JOY",
      score: 7400,
      ending: "clown",
      mask: "cloth",
      timestamp: "2026-09-26T12:00:00.000Z",
    },
  ];
  let loads = 0;
  await page.route("**/api/leaderboard", (route) => {
    loads++;
    return route.fulfill({ json: { scores } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "GLOBAL LEADERBOARD" }).click();
  const dashboard = page.getByRole("dialog", { name: "HALL OF FAME" });
  await expect(dashboard).toBeVisible();
  await page.screenshot({ path: "test-results/dashboard-desktop.png" });
  await expect(page.locator("#dashboard-top")).toHaveText("9,200");
  await expect(page.locator("#dashboard-count")).toHaveText("2");
  await expect(page.locator("#dashboard-scores li")).toHaveCount(2);
  await expect(page.locator("#dashboard-scores li").first()).toContainText(
    "LIZ9,200THE BAR THRIVES · N95",
  );
  await press(page, "ArrowDown");
  await expect(page.locator("#dashboard-scores li").nth(1)).toHaveClass(
    /is-selected/,
  );
  await press(page, "ArrowRight");
  await expect.poll(() => loads).toBe(2);
  await press(page, "ArrowLeft");
  await expect(dashboard).not.toBeVisible();
});

test("leaderboard dashboard stays usable on narrow touch screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.route("**/api/leaderboard", (route) =>
    route.fulfill({ json: { scores: [] } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "GLOBAL LEADERBOARD" }).click();
  await expect(page.locator("#dashboard-status")).toContainText(
    "NO SCORES YET",
  );
  await expect(page.locator("#dashboard-count")).toHaveText("0");
  await page.screenshot({ path: "test-results/dashboard-mobile.png" });
  await expect(
    page.getByRole("navigation", { name: "Leaderboard arrow controls" }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.locator("#leaderboard-dashboard")).not.toBeVisible();
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
    await press(page, "ArrowDown", 5);
  await press(page, "ArrowRight", 2);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "arcade");
  await press(page, "ArrowRight", 2);
  await expect(page.locator("#game-status")).toContainText("SIGN-UP SHEET");
  await press(page);
  await press(page, "ArrowDown");
  await press(page);
  await expect(page.locator("#game-status")).toContainText("+500");
  await page.clock.runFor(17_050);
  if (
    (await page.locator("#mobile-readout").textContent()).startsWith(
      "THE GLOBE",
    )
  ) {
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
