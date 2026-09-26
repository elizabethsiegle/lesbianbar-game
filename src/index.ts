import { validateSubmission } from "./validation";
export { Leaderboard } from "./leaderboard";

function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

async function readBody(request: Request): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let body = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) {
        await reader.cancel();
        return null;
      }
      body += decoder.decode(value, { stream: true });
    }
    return body + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (!["/api/leaderboard", "/api/score"].includes(url.pathname))
      return json({ error: "Not found." }, 404);
    const method = url.pathname === "/api/score" ? "POST" : "GET";
    if (request.method !== method)
      return json({ error: "Method not allowed." }, 405, { Allow: method });
    try {
      const board = env.LEADERBOARD.getByName("global");
      if (method === "GET") return json({ scores: await board.topTen() });
      const origin = request.headers.get("Origin");
      if (origin && origin !== url.origin)
        return json({ error: "Cross-origin submission rejected." }, 403);
      if (
        request.headers
          .get("Content-Type")
          ?.split(";")[0]
          .trim()
          .toLowerCase() !== "application/json"
      ) {
        return json({ error: "Use application/json." }, 415);
      }
      const body = await readBody(request);
      if (body === null)
        return json({ error: "Submission is too large." }, 413);
      let value: unknown;
      try {
        value = JSON.parse(body);
      } catch {
        return json({ error: "Invalid JSON." }, 400);
      }
      const input = validateSubmission(value);
      if (!input) return json({ error: "Invalid score submission." }, 400);
      const ip = request.headers.get("CF-Connecting-IP") ?? "local";
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(ip),
      );
      const ipHash = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      const result = await board.submit(input, ipHash);
      if (!result.ok)
        return json(
          {
            error: "Five scores per minute. Take a snack break.",
            retryAfter: result.retryAfter,
          },
          429,
          { "Retry-After": String(result.retryAfter) },
        );
      return json({ rank: result.rank, entry: result.entry }, 201);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "leaderboard_failure",
          route: url.pathname,
          message: error instanceof Error ? error.message : "Unknown error",
        }),
      );
      return json({ error: "HIGH SCORES OFFLINE" }, 503);
    }
  },
} satisfies ExportedHandler<Env>;
