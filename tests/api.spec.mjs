import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

let ipCounter = 1;
const ip = () => ({ "CF-Connecting-IP": `192.0.2.${ipCounter++}` });
const submission = (overrides = {}) => ({
  submissionId: randomUUID(),
  initials: "ELM",
  score: 4200,
  ending: "compromise",
  mask: "n95",
  ...overrides,
});

test("static game and API routing work", async ({ request }) => {
  const html = await request.get("/");
  expect(html.status()).toBe(200);
  expect(await html.text()).toContain("A Western Mass Bar Saga");
  expect((await request.get("/api/missing")).status()).toBe(404);
  const wrongMethod = await request.get("/api/score");
  expect(wrongMethod.status()).toBe(405);
  expect(wrongMethod.headers().allow).toBe("POST");
});

test("accepts boundaries, stores metadata, filters initials, and ranks ties by arrival", async ({
  request,
}) => {
  const headers = ip();
  const first = await request.post("/api/score", {
    headers,
    data: submission({ initials: "fUk", score: 10500 }),
  });
  expect(first.status()).toBe(201);
  const result = await first.json();
  expect(result.rank).toBe(1);
  expect(result.entry.initials).toBe("???");
  expect(result.entry.ending).toBe("compromise");
  expect(result.entry.mask).toBe("n95");
  expect(Number.isFinite(Date.parse(result.entry.timestamp))).toBe(true);
  const second = await request.post("/api/score", {
    headers,
    data: submission({ score: 10500 }),
  });
  expect((await second.json()).rank).toBe(2);
  expect(
    (
      await request.post("/api/score", {
        headers,
        data: submission({ score: 0 }),
      })
    ).status(),
  ).toBe(201);
});

test("rejects malformed, out-of-range, cross-origin, and oversized submissions", async ({
  request,
}) => {
  const headers = ip();
  const malformed = [
    null,
    [],
    {},
    submission({ score: -1 }),
    submission({ score: 10501 }),
    submission({ score: 1.5 }),
    submission({ score: "100" }),
    submission({ score: 1e40 }),
    submission({ initials: "<x>" }),
    submission({ initials: "ABCD" }),
    submission({ ending: "unknown" }),
    submission({ mask: "respirator" }),
    submission({ timestamp: "yesterday" }),
    submission({ submissionId: "invalid" }),
  ];
  for (const data of malformed) {
    const result = await request.post("/api/score", {
      headers: { ...headers, "Content-Type": "application/json" },
      data: JSON.stringify(data),
    });
    expect(result.status(), JSON.stringify(data)).toBe(400);
  }
  expect(
    (
      await request.post("/api/score", {
        headers: { ...headers, "Content-Type": "application/json" },
        data: "{",
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/score", {
        headers: { ...headers, "Content-Type": "text/plain" },
        data: "{}",
      })
    ).status(),
  ).toBe(415);
  expect(
    (
      await request.post("/api/score", {
        headers: { ...headers, Origin: "https://another-site.example" },
        data: submission(),
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/score", {
        headers,
        data: submission({ initials: "A".repeat(1500) }),
      })
    ).status(),
  ).toBe(413);
});

test("enforces five requests per rolling minute, including concurrent submissions", async ({
  request,
}) => {
  const headers = ip();
  const results = await Promise.all(
    Array.from({ length: 8 }, () =>
      request.post("/api/score", { headers, data: submission() }),
    ),
  );
  expect(results.filter((response) => response.status() === 201)).toHaveLength(
    5,
  );
  expect(results.filter((response) => response.status() === 429)).toHaveLength(
    3,
  );
  const blocked = results.find((response) => response.status() === 429);
  expect(Number(blocked.headers()["retry-after"])).toBeGreaterThan(0);
  expect(Number(blocked.headers()["retry-after"])).toBeLessThanOrEqual(60);
  expect(
    (
      await request.post("/api/score", { headers: ip(), data: submission() })
    ).status(),
  ).toBe(201);
});

test("retries do not create duplicate scores and top ten stay sorted", async ({
  request,
}) => {
  const headers = ip();
  const data = submission({ initials: "OAK", score: 7100 });
  const one = await (
    await request.post("/api/score", { headers, data })
  ).json();
  const two = await (
    await request.post("/api/score", { headers, data })
  ).json();
  expect(two.entry.id).toBe(one.entry.id);
  expect(two.rank).toBe(one.rank);
  for (let n = 0; n < 12; n++)
    await request.post("/api/score", {
      headers: ip(),
      data: submission({ score: 8000 + n }),
    });
  const response = await request.get("/api/leaderboard");
  expect(response.headers()["cache-control"]).toBe("no-store");
  const { scores } = await response.json();
  expect(scores).toHaveLength(10);
  expect(scores.map((entry) => entry.rank)).toEqual([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ]);
  expect(scores.map((entry) => entry.score)).toEqual(
    scores.map((entry) => entry.score).sort((a, b) => b - a),
  );
});
