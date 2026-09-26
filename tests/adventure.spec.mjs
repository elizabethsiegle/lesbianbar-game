import { test, expect } from "@playwright/test";

async function press(page, key = "ArrowRight", count = 1) {
  for (let i = 0; i < count; i++) await page.keyboard.press(key);
  await page.clock.runFor(32);
}

async function until(page, text) {
  for (let i = 0; i < 24; i++) {
    if ((await page.locator("#mobile-readout").textContent()).includes(text))
      return;
    await press(page);
  }
  throw new Error("Did not reach " + text);
}

async function choose(page, down = 0) {
  await press(page, "ArrowUp");
  await press(page, "ArrowDown", down);
  await press(page);
}

async function hub(page) {
  for (let i = 0; i < 20; i++) {
    if (
      (await page.locator("#game").getAttribute("data-screen")) === "quests" &&
      (await page.locator("#mobile-readout").textContent()).includes(
        "ZOOM RECESS",
      )
    )
      return;
    await press(page);
  }
  throw new Error("Did not reach the quest board");
}

async function quest(page, index) {
  await press(page, "ArrowDown", index);
  await press(page);
  await choose(page);
  await hub(page);
}

async function rejoin(page) {
  await press(page, "ArrowDown", 5);
  await press(page);
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-26T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-09-26T12:00:01Z"));
});

test("arrow-only adventure carries quest evidence through Zoom, Saturday, score submission, and credits", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await press(page, "ArrowRight", 2);
  await until(page, "BASE: N95");
  await press(page, "ArrowDown", 4);
  await press(page);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "zoom");
  await page.screenshot({ path: "test-results/adventure-zoom.png" });
  await choose(page);
  await hub(page);
  await quest(page, 0);
  await quest(page, 0);
  await expect(page.locator("#mobile-readout")).toContainText("ERRANDS 0/2");
  await page.screenshot({ path: "test-results/adventure-quests.png" });
  await rejoin(page);
  await choose(page);
  await until(page, "PAT / SHARING THE WRONG SCREEN");
  await choose(page);
  await hub(page);
  await quest(page, 4);
  await quest(page, 4);
  await rejoin(page);
  await choose(page);
  await until(page, "DOTTIE / THE BREAKOUT ROOMS");
  await choose(page);
  await hub(page);
  await quest(page, 2);
  await quest(page, 2);
  await rejoin(page);
  await choose(page);
  await until(page, "NORA / BEFORE I FILE");
  await choose(page);
  await until(page, "TESS / THE RENT ENVELOPE");
  await choose(page, 2);
  await until(page, "NORA / ONE LAST FOLLOW-UP");
  await choose(page);
  await until(page, "11:58 PM");
  await choose(page);
  await until(page, "SHIFT COMPLETE");
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "tally");
  await page.screenshot({ path: "test-results/adventure-tally.png" });
  await press(page, "ArrowRight", 2);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "ending");
  await expect(page.locator("#mobile-readout")).toContainText(
    "THE GRUDGING COMPROMISE",
  );
  await press(page);
  await page.route(
    "**/api/score",
    (route) =>
      route.fulfill({ status: 503, json: { error: "HIGH SCORES OFFLINE" } }),
    { times: 1 },
  );
  await press(page, "ArrowRight", 3);
  await expect(page.locator("#game-status")).toContainText(
    "HIGH SCORES OFFLINE",
  );
  await press(page);
  await expect(page.locator("#game")).toHaveAttribute(
    "data-screen",
    "leaderboard",
  );
  await expect(page.locator("#game-status")).toContainText(
    "Global high scores",
  );
  await press(page);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "credits");
  expect(errors).toEqual([]);
});

test("mobile quest board exposes choices, points, and the notebook without spending an errand", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const right = page.getByRole("button", { name: "Right", exact: true });
  await right.click();
  await right.click();
  await until(page, "BASE: N95");
  await press(page, "ArrowDown", 4);
  await press(page);
  await choose(page);
  await hub(page);
  await page.screenshot({
    path: "test-results/adventure-mobile.png",
    fullPage: true,
  });
  await expect(page.locator("#mobile-readout")).toContainText("SCORE 750");
  await page.getByRole("button", { name: "Left", exact: true }).click();
  await page.clock.runFor(32);
  await expect(page.locator("#mobile-readout")).toContainText("YOUR NOTEBOOK");
  await hub(page);
  await expect(page.locator("#mobile-readout")).toContainText("ERRANDS 2/2");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});
