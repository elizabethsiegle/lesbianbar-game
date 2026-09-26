# LAST DITCH: A WESTERN MASS BAR SAGA

One lesbian bar. One policy change. An entire town with reply-all privileges.

[Play the deployed game](https://last-ditch-bar-saga.lizzie-siegle5086.workers.dev).

A complete arrow-only RPG and 90-second small-town meltdown. Chase a tip-jar raccoon, dodge flying reply-all paperwork, negotiate with a goose, and win municipal dance battles. Choose **CHAOS MODE** to skip the story and jump straight to mask selection and Saturday.

All art uses a 16-color canvas palette and a built-in bitmap font. Four original chiptune loops and sound effects run through Web Audio. No external assets, fonts, or runtime libraries.

## Run locally

1. Install Node.js 22 or newer and npm.
2. From this directory, install dependencies, including Wrangler:

   ```sh
   npm install
   ```

3. Start the Worker, assets, and local SQLite Durable Object:

   ```sh
   npx wrangler dev
   ```

4. Open `http://localhost:8787`. Press an arrow to enable audio and open the menu.

Local scores persist in `.wrangler/state`. They do not affect the deployed leaderboard.

## Deploy

1. Sign in to the Cloudflare account that will own the game:

   ```sh
   npx wrangler login
   ```

2. Validate, then publish:

   ```sh
   npm run build
   npx wrangler deploy
   ```

3. Open the `workers.dev` URL printed by Wrangler.

The first deployment creates the `Leaderboard` SQLite Durable Object through the `v1` migration. No database IDs or secrets are required. All API requests use the named instance `global`. Keep the class name, binding, migration, and instance name stable to retain the same board.

## Controls

| Screen         | Arrows                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------- |
| Bar or town    | Move on the grid. Bump people, doors, or objects.                                        |
| Dialogue       | Any arrow reveals text; another advances.                                                |
| Choices        | Up/down chooses. Right confirms. Left goes back.                                         |
| Social feed    | Up/down scrolls. Right reads the next post, then continues.                              |
| Mask editor    | Up/down selects a category. Left/right cycles. Right on DONE confirms.                   |
| Saturday night | Bump marked incidents or matching tool stations. Dodge flying paperwork.                 |
| Dance/karaoke  | Copy the displayed arrow sequence before eight seconds expire.                           |
| Initials       | Up/down changes a letter. Right advances; right on letter three submits. Left goes back. |

Touch devices get the same four directions on a D-pad. Small screens also show readable dialogue, choices, and instructions below the canvas. Sound can be toggled from the header or title menu. Leaving the window pauses the arcade shift; an arrow resumes it. Reduced-motion preferences remove blinking and sprite bobbing and speed up dialogue.

## The game

- Talk to Tess. Saying no plays a short decline branch and returns to the decision.
- Post the announcement, read the feed, and meet Tess by the town co-op. Reinstate the policy, hold a four-round clown-school Zoom meeting, or stay quiet.
- Other neighbors offer optional conversations. Story choices determine ally and visitor waves.
- Bump the bar's sewing table to choose an N95, cloth mask, novelty mask, or no mask. N95s have a raised bridge and center seam; cloth masks have pleats; novelty masks have a grin and cheek tabs. Each mask has a dark outline and light straps so it reads on the small character sprite. Sage green is the starting color; color, pattern, and accessory stay customizable.
- Saturday escalates through nine incidents: a thieving raccoon, reply-all printer, conga annexation, rival petitions, accidental national livestream, campaigning goose, exes with the aux cord, escaped slideshow, and municipal line dance.
- Chase moving incidents and bump them to choose a practical fix or a ridiculous escalation. Paperwork knocks you around; stamina cushions the impact. Matching tool stations offer another way to resolve each problem.
- Dance and karaoke incidents use timed arrow sequences. Dialogue and performances pause the room. A missed sequence can be retried. Clown allies shorten sequences.
- Chain three saves within fourteen seconds of each other to clear flying paper, recharge tools, and gain a brief collision shield. Incidents left alone escalate after eighteen seconds but remain fixable. The room speeds up in three acts.
- Drinks are optional: at most six patrons offer small score bonuses, vibe, and stamina recovery. Ignoring them has no meter penalty. Most points come from handling disasters.
- Finish with three dialogue rounds against Marlow Quill's clipboard. See your tally, one of four warm endings, initials entry, global scores, and credits.

N95s have five stamina and reduce sick-day penalties. Cloth masks have three stamina and add ten trust. Novelty masks have one stamina and add thirty starting vibe. No mask has no stamina and moves faster when a direction is held. All health-related stats are fictional game mechanics.

## Score and leaderboard

```text
score = arcade points + profit × 10 + trust × 10 + (100 − chaos) × 10
```

Each meter is bounded to 0–100. Nine incidents are worth 500 each, six faction waves 150 each, six optional drinks 100 each, and three boss answers 500 each: at most 7,500 arcade points. Meter bonuses add at most 3,000. The enforced ceiling remains **10,500**, and existing leaderboard scores are preserved. Each incident, wave, or patron can award points only once. Chains improve tools and survivability, not the score ceiling.

Ending rules, in order: high trust/profit and manageable chaos earn the compromise; strong clown ties or a novelty mask with enough chaos earn the annex; high chaos or profit earns national attention; other runs earn the eternal subcommittee.

### API

`GET /api/leaderboard` returns `{ "scores": [...] }`, at most ten entries, ordered by score descending and arrival order for ties. Entries include `rank`, `id`, `initials`, `score`, `ending`, `mask`, and a server-generated ISO `timestamp`.

`POST /api/score` accepts JSON with exactly these fields:

```json
{
  "submissionId": "1077ca2c-1c19-4ab7-bf95-2ecf5c5c714d",
  "initials": "ELM",
  "score": 4200,
  "ending": "compromise",
  "mask": "n95"
}
```

- `submissionId`: a UUID v4, generated once per completed game. Retries reuse it and cannot create duplicate scores.
- `initials`: exactly three ASCII letters. Uppercased on the server; blocked combinations become `???`.
- `score`: an integer from 0 through 10,500.
- `ending`: `compromise`, `clown`, `viral`, or `committee`.
- `mask`: `n95`, `cloth`, `novelty`, or `none`.

Success returns HTTP 201 with `{ "rank": 1, "entry": {...} }`. Rank is among all accepted scores, not only the displayed ten. HTTP 400 rejects malformed fields, 413 rejects bodies above 1 KiB, 415 rejects non-JSON, and 429 includes `Retry-After`. Wrong-origin browser submissions are rejected.

SQLite enforces a rolling limit of five valid submission requests per IP per minute, including retries. The Worker uses Cloudflare's client-IP header and hashes it before passing it to the Durable Object. Rate-limit history is pruned on subsequent submissions. Rate checks, insertion, and ranking run in one synchronous transaction.

Scores remain client-reported. Bounds, validation, deduplication, and rate limits deter basic abuse; they do not prove a run was played or prevent fabricated in-range scores. This is a casual game, not a competition-grade anti-cheat system. The requested single global object also sets a throughput ceiling.

Network requests time out after eight seconds. Failed score submissions offer retry or continue without saving. Leaderboard failures display **HIGH SCORES OFFLINE** and never block a new game. Failed submissions are not silently queued.

## Verify

```sh
npm run types
npm run build
npm test
```

Tests use an installed Google Chrome browser and an isolated local Worker with temporary SQLite storage. They cover API validation, ordering, concurrent rate limiting, retry deduplication, a complete arrow-only playthrough, story branches, touch controls, offline behavior, mask benefits, waves, endings, and score limits. Mask tests compare actual sprite pixels in the editor and gameplay, including rear views and customization. Production scores are never touched. Screenshots and failure traces go in `test-results/`.

## Files

- `public/index.html`: all game logic, pixel art, UI, CSS, and audio.
- `src/index.ts`: static asset fallback and HTTP API.
- `src/leaderboard.ts`: SQLite storage, rate limits, ranking, and retries.
- `src/validation.ts`: input schema, score bound, initials blocklist.
- `wrangler.jsonc`: assets, Durable Object binding, migration, and logs.
- `worker-configuration.d.ts`: generated Cloudflare types.

Fictional town, fictional people, affectionate satire. Health needs are never the punchline.
