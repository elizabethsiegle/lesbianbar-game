import { DurableObject } from "cloudflare:workers";
import type { ScoreSubmission } from "./validation";

type ScoreRow = {
  id: number;
  submissionId: string;
  initials: string;
  score: number;
  ending: string;
  mask: string;
  timestamp: string;
};

type SubmitResult =
  | { ok: true; rank: number; entry: ScoreRow }
  | { ok: false; retryAfter: number };

export class Leaderboard extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submissionId TEXT NOT NULL UNIQUE,
        initials TEXT NOT NULL,
        score INTEGER NOT NULL CHECK(score BETWEEN 0 AND 10500),
        ending TEXT NOT NULL,
        mask TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS scores_ranking ON scores(score DESC, id ASC);
      CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ipHash TEXT NOT NULL,
        at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS submissions_ip ON submissions(ipHash, at);
      CREATE INDEX IF NOT EXISTS submissions_expiry ON submissions(at);
    `);
  }

  topTen() {
    return this.ctx.storage.sql
      .exec<ScoreRow>(
        "SELECT id, initials, score, ending, mask, timestamp FROM scores ORDER BY score DESC, id ASC LIMIT 10",
      )
      .toArray()
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }

  submit(input: ScoreSubmission, ipHash: string): SubmitResult {
    return this.ctx.storage.transactionSync(() => {
      const now = Date.now();
      this.ctx.storage.sql.exec(
        "DELETE FROM submissions WHERE at <= ?",
        now - 60_000,
      );
      const recent = this.ctx.storage.sql
        .exec<{ count: number; oldest: number | null }>(
          "SELECT COUNT(*) AS count, MIN(at) AS oldest FROM submissions WHERE ipHash = ?",
          ipHash,
        )
        .one();
      if (recent.count >= 5) {
        return {
          ok: false,
          retryAfter: Math.max(
            1,
            Math.ceil(((recent.oldest ?? now) + 60_000 - now) / 1000),
          ),
        };
      }
      this.ctx.storage.sql.exec(
        "INSERT INTO submissions (ipHash, at) VALUES (?, ?)",
        ipHash,
        now,
      );
      const existing = this.ctx.storage.sql
        .exec<ScoreRow>(
          "SELECT * FROM scores WHERE submissionId = ?",
          input.submissionId,
        )
        .toArray()[0];
      const entry =
        existing ??
        this.ctx.storage.sql
          .exec<ScoreRow>(
            "INSERT INTO scores (submissionId, initials, score, ending, mask, timestamp) VALUES (?, ?, ?, ?, ?, ?) RETURNING *",
            input.submissionId,
            input.initials,
            input.score,
            input.ending,
            input.mask,
            new Date(now).toISOString(),
          )
          .one();
      const { rank } = this.ctx.storage.sql
        .exec<{ rank: number }>(
          "SELECT COUNT(*) + 1 AS rank FROM scores WHERE score > ? OR (score = ? AND id < ?)",
          entry.score,
          entry.score,
          entry.id,
        )
        .one();
      return { ok: true, rank, entry };
    });
  }
}
