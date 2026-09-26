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
  await expect(page.locator("#game-status")).toContainText(
    "HIGH SCORES OFFLINE",
  );
  await press(page, "ArrowLeft");
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "title");
  await press(page);
  await expect(page.locator("#game")).toHaveAttribute(
    "data-screen",
    "adventure",
  );
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
