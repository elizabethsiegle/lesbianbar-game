import { test, expect } from "@playwright/test";

async function press(page, key = "ArrowRight", count = 1) {
  for (let i = 0; i < count; i++) await page.keyboard.press(key);
  await page.clock.runFor(32);
}

async function start(page) {
  await page.clock.install({ time: new Date("2026-09-26T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-09-26T12:00:01Z"));
  await page.goto("/");
  await press(page);
  await press(page, "ArrowDown", 6);
  await expect(page.locator("#mobile-readout")).toContainText("SUPER CHAOS / MEDIATOR");
  await page.screenshot({ path: "test-results/mediator-title.png" });
  await press(page);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "mask");
  await expect(page.locator("#mobile-readout")).toContainText("+3 SECONDS PER DISPUTE");
  await press(page, "ArrowDown", 5);
  await press(page);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "mediator-ready");
  await page.screenshot({ path: "test-results/mediator-ready.png" });
  await press(page);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "mediator");
}

async function mediate(page, index) {
  await press(page, "ArrowDown", index);
  await press(page);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "mediator-result");
}

test("Super Chaos mediates Zoom and the bar with gains, losses, and a final tally", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await start(page);
  await page.screenshot({ path: "test-results/mediator-zoom.png" });
  await expect(page.locator("#mobile-readout")).toContainText("CLOWN-SCHOOL ZOOM · DISPUTE 1/8");
  await mediate(page, 0);
  await expect(page.locator("#mobile-readout")).toContainText("ROOM STEADIED");
  await expect(page.locator("#mobile-readout")).toContainText(/\+\d+ points\. Score/);
  await press(page);
  await mediate(page, 0);
  await expect(page.locator("#mobile-readout")).toContainText("ANOTHER THREAD OPENS");
  await expect(page.locator("#mobile-readout")).toContainText("-150 points");
  await press(page);
  await mediate(page, 2);
  await press(page);
  await mediate(page, 1);
  await press(page);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "mediator-break");
  await press(page);
  await expect(page.locator("#mobile-readout")).toContainText("LAST DITCH BAR · DISPUTE 5/8");
  await page.screenshot({ path: "test-results/mediator-bar.png" });
  for (const index of [2, 0, 1, 2]) {
    await mediate(page, index);
    await press(page);
  }
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "tally");
  await expect(page.locator("#mobile-readout")).toContainText("Mediator ");
  await press(page, "ArrowRight", 2);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "ending");
  await press(page);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "initials");
  await press(page, "ArrowRight", 3);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "leaderboard");
  await press(page);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "credits");
  expect(errors).toEqual([]);
});

test("an unanswered dispute times out and costs points", async ({ page }) => {
  await start(page);
  await page.clock.runFor(22_000);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "mediator-result");
  await expect(page.locator("#mobile-readout")).toContainText("TIME RAN OUT");
  await expect(page.locator("#mobile-readout")).toContainText("-200 points. Score 300");
  await press(page);
  await expect(page.locator("#mobile-readout")).toContainText("DISPUTE 2/8");
});

test("a chaotic answer shortens the next dispute clock", async ({ page }) => {
  await start(page);
  await mediate(page, 2);
  await expect(page.locator("#mobile-readout")).toContainText("ANOTHER THREAD OPENS");
  await press(page);
  await expect(page.locator("#mobile-readout")).toContainText("DISPUTE 2/8 · 20s");
});
