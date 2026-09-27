import { test, expect } from "@playwright/test";

test("character choice changes the preview and stays selected after leaving the editor", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowDown");
  await expect(page.locator("#mobile-readout")).toContainText("CHARACTER: WOMAN");
  const before = await page.locator("#game").screenshot();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#mobile-readout")).toContainText("CHARACTER: MAN");
  expect(await page.locator("#game").screenshot()).not.toEqual(before);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "ready");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#mobile-readout")).toContainText("CHARACTER: MAN");
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
