import { test, expect } from "@playwright/test";

async function press(page, key, count = 1) {
  for (let i = 0; i < count; i++) await page.keyboard.press(key);
}

async function openEditor(page) {
  await page.goto("/");
  await press(page, "ArrowRight");
  await press(page, "ArrowDown");
  await press(page, "ArrowRight");
  await expect(page.locator("#game")).toHaveAttribute("data-screen", "mask");
}

async function headPixels(page, x, y, scale) {
  await page.clock.runFor(32);
  return page.evaluate(
    ({ x, y, scale }) => {
      const crop = document.createElement("canvas");
      crop.width = 13 * scale;
      crop.height = 12 * scale;
      crop
        .getContext("2d")
        .drawImage(
          document.getElementById("game"),
          x,
          y,
          crop.width,
          crop.height,
          0,
          0,
          crop.width,
          crop.height,
        );
      return crop.toDataURL();
    },
    { x, y, scale },
  );
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-26T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-09-26T12:00:01Z"));
});

for (let style = 0; style < 5; style++) {
  test(`mask base changes the preview pixels with color ${style}, pattern ${style % 4}, and accessory ${style % 4}`, async ({
    page,
  }) => {
    await openEditor(page);
    for (const changes of [style, style % 4, style % 4]) {
      await press(page, "ArrowDown");
      await press(page, "ArrowRight", changes);
    }
    await press(page, "ArrowUp", 3);
    const heads = [];
    for (let base = 0; base < 4; base++) {
      heads.push(await headPixels(page, 137, 218, 12));
      await press(page, "ArrowRight");
    }
    expect(new Set(heads).size).toBe(4);
    expect(await headPixels(page, 137, 218, 12)).toBe(heads[0]);
    await press(page, "ArrowLeft");
    expect(await headPixels(page, 137, 218, 12)).toBe(heads[3]);
  });
}

test("colors, patterns, and accessories still change each mask, but never a bare face", async ({
  page,
}) => {
  for (let base = 0; base < 4; base++) {
    await openEditor(page);
    await press(page, "ArrowRight", base);
    let previous = await headPixels(page, 137, 218, 12);
    for (let category = 0; category < 3; category++) {
      await press(page, "ArrowDown");
      await press(page, "ArrowRight");
      const current = await headPixels(page, 137, 218, 12);
      if (base === 3) expect(current).toBe(previous);
      else expect(current).not.toBe(previous);
      previous = current;
    }
  }
});

test("each selected mask stays distinct on the gameplay character, including rear straps", async ({
  page,
}) => {
  const fronts = [],
    backs = [];
  for (let base = 0; base < 4; base++) {
    await openEditor(page);
    await press(page, "ArrowRight", base);
    const preview = await headPixels(page, 137, 218, 12);
    await page.screenshot({ path: `test-results/mask-base-${base}.png` });
    await press(page, "ArrowDown", 4);
    await press(page, "ArrowRight");
    await expect(page.locator("#game")).toHaveAttribute("data-screen", "ready");
    await press(page, "ArrowLeft");
    expect(await headPixels(page, 137, 218, 12)).toBe(preview);
    await press(page, "ArrowRight", 2);
    await expect(page.locator("#game")).toHaveAttribute(
      "data-screen",
      "arcade",
    );
    backs.push(await headPixels(page, 448, 313, 2));
    await press(page, "ArrowDown");
    fronts.push(await headPixels(page, 448, 351, 2));
    const edge = await page.evaluate(() =>
      Array.from(
        document
          .getElementById("game")
          .getContext("2d")
          .getImageData(448 + 3 * 2, 351 + 6 * 2, 1, 1).data,
      ).slice(0, 3),
    );
    expect(edge).toEqual(base === 3 ? [239, 169, 117] : [25, 21, 34]);
  }
  expect(new Set(fronts).size).toBe(4);
  expect(new Set(backs).size).toBe(4);
});
