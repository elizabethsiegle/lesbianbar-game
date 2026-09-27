import { test, expect } from "@playwright/test";

test("mask editor keeps one owner character and no gender selector", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#mobile-readout")).toContainText("BASE: N95");
  await expect(page.locator("#mobile-readout")).toContainText("ACCESSORY:");
  await expect(page.locator("#mobile-readout")).not.toContainText(/CHARACTER:|WOMAN|MAN/);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#mobile-readout")).toContainText("BASE: CLOTH MASK");
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowDown");
  await expect(page.locator("#mobile-readout")).toContainText("→ DONE");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "ready");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#mobile-readout")).toContainText("BASE: CLOTH MASK");
  await expect(page.locator("#mobile-readout")).not.toContainText(/CHARACTER:|WOMAN|MAN/);
});

test("meme studio downloads a PNG and opens a draft without posting", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "MAKE MEME CARD" }).click();
  await expect(page.getByRole("dialog", { name: "DISCOURSE POSTCARD" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "SAVE PNG", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("last-ditch-discourse.png");
  expect(await download.failure()).toBeNull();
  const clipPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "SAVE 6-SECOND CLIP" }).click();
  const clip = await clipPromise;
  expect(clip.suggestedFilename()).toMatch(/last-ditch-discourse\.(mp4|webm)$/);
  expect(await clip.failure()).toBeNull();
  await expect(page.locator("#share-twitter")).toHaveAttribute("href", /twitter.com\/intent\/tweet\?/);
  await page.screenshot({ path: "test-results/meme-studio.png" });
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#share-studio")).not.toBeVisible();
  expect(errors).toEqual([]);
});

test("secret arrow sequence opens the meme studio", async ({ page }) => {
  await page.goto("/");
  for (const key of ["Up", "Up", "Down", "Down", "Left", "Right", "Left", "Right"])
    await page.keyboard.press("Arrow" + key);
  await expect(page.locator("#share-studio")).toBeVisible();
});
