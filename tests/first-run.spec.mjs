import { test, expect } from "@playwright/test";

async function press(page, key = "Enter", count = 1) {
  for (let i = 0; i < count; i++) await page.keyboard.press(key);
  await page.clock.runFor(32);
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-26T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-09-26T12:00:01Z"));
});

test("the first-run path is primary and secondary modes remain in More", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "PLAY STORY / START HERE" })).toBeVisible();
  await press(page);
  await expect(page.locator("#mobile-readout")).toContainText("→ PLAY STORY / START HERE");
  await expect(page.locator("#mobile-readout")).not.toContainText("SUPER CHAOS / MEDIATOR");
  await page.screenshot({ path: "test-results/first-run-title.png" });
  await press(page, "ArrowDown", 4);
  await press(page);
  await expect(page.locator("#mobile-readout")).toContainText("SUPER CHAOS / MEDIATOR");
  await expect(page.locator("#mobile-readout")).toContainText("MAKE MEME CARD");
  await press(page, "ArrowLeft");
  await expect(page.locator("#mobile-readout")).toContainText("→ MORE");
  await page.getByRole("button", { name: "PLAY STORY / START HERE" }).click();
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "adventure");
});

test("keyboard cues guide a new player from mask to a point-earning quest", async ({ page }) => {
  await page.goto("/");
  await press(page, "Enter", 2);
  await press(page, "Enter", 2);
  await expect(page.locator("#mobile-readout")).toContainText("Pick a mask, then settle the Saturday plan on Zoom.");
  await expect(page.locator("#mobile-readout")).toContainText("Helpful choices earn points; chaos costs you.");
  await press(page, "Enter", 2);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "mask");
  await expect(page.locator("#mobile-readout")).toContainText("NEXT: PICK A MASK, THEN JOIN THE ZOOM.");
  await page.screenshot({ path: "test-results/first-run-mask.png" });
  await press(page, "Enter", 5);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "zoom");
  await expect(page.locator("#mobile-readout")).toContainText("GOAL: GET ONE MIC AND A SATURDAY PLAN.");
  await expect(page.locator("#mobile-readout")).toContainText("ONE MIC. PUT AUDITIONS IN ROOM 2. [+250]");
  await press(page, "Enter", 2);
  await expect(page.locator("#mobile-readout")).toContainText("+250 POINTS");
  for (let i = 0; i < 8 && (await page.locator("#game").getAttribute("data-screen")) !== "quests"; i++)
    await press(page);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "quests");
  await expect(page.locator("#mobile-readout")).toContainText("START HERE: HELP WILLOW PLAN A MASKED HOUR.");
  await expect(page.locator("#mobile-readout")).toContainText("→ START HERE / ASK WILLOW");
  await expect(page.locator("#mobile-readout")).toContainText("Best available: +150 this step");
  await page.screenshot({ path: "test-results/first-run-quest.png" });
  await press(page, "ArrowLeft");
  await expect(page.locator("#mobile-readout")).toContainText("profit 40+, trust 65+, chaos 60 or less");
});

test("touch D-pad follows the same first-run guidance", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const right = page.getByRole("button", { name: "Right", exact: true });
  const down = page.getByRole("button", { name: "Down", exact: true });
  await right.click();
  await right.click();
  for (let i = 0; i < 4; i++) await right.click();
  await page.clock.runFor(32);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "mask");
  await expect(page.locator("#mobile-readout")).toContainText("NEXT: PICK A MASK, THEN JOIN THE ZOOM.");
  for (let i = 0; i < 4; i++) await down.click();
  await right.click();
  await page.clock.runFor(32);
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "zoom");
  await expect(page.locator("#mobile-readout")).toContainText("GOAL: GET ONE MIC AND A SATURDAY PLAN.");
});
