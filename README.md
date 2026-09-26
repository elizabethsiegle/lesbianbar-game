# LAST DITCH: A WESTERN MASS BAR SAGA

One lesbian bar. One policy change. An entire town with reply-all privileges.

[Play the deployed game](https://last-ditch-bar-saga.lizzie-siegle5086.workers.dev).

Last Ditch Bar and Arts Venue in Greenfield is real. The game takes inspiration from [Annalisa Quinn's Boston Globe report on the mask-policy dispute and community meeting](https://www.bostonglobe.com/2026/09/22/magazine/greenfield-last-ditch-bar-backlash/). Its characters, dialogue, and outcomes are invented; it is not the bar's account of events.

A choose-your-own-adventure about keeping a lesbian bar open. Rent is due Sunday. Your mask-policy post has started a town debate. Fictional Boston Globe reporter Nora Ink files at midnight. The clown school lends you its Zoom account, but the meeting link also admits its audition class.

**STORY MODE** follows your choices through recurring Zoom meetings, five side quests, and Saturday night. **CHAOS MODE** is a separate 90-second arcade shift.

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
| Quest board    | Up/down selects an errand. Right visits. Left opens the free notebook.                   |
| Social feed    | Up/down scrolls. Right reads the next post, then continues.                              |
| Mask editor    | Up/down selects a category. Left/right cycles. Right on DONE confirms.                   |
| Saturday night | Bump marked incidents or matching tool stations. Dodge flying paperwork.                 |
| Dance/karaoke  | Copy the displayed arrow sequence before eight seconds expire.                           |
| Initials       | Up/down changes a letter. Right advances; right on letter three submits. Left goes back. |

Touch devices get the same four directions on a D-pad. Small screens also show readable dialogue, choices, and instructions below the canvas. Sound can be toggled from the header or title menu. Leaving the window pauses the arcade shift; an arrow resumes it. Reduced-motion preferences remove blinking and sprite bobbing and speed up dialogue.

## Story mode

- Start with 500 points. Choose a mask, then join the clown-school Zoom call.
- The seven-beat route bar tracks the opening call, three recesses, Saturday, the reporter, and the final call. Finish the route for an ending; Story Mode has no timer.
- Three recesses give you two errands each. Each of five side quests takes two errands; you cannot finish them all. There is no real-time deadline while reading.
- The quest board previews the best available points for each step. Clean errands earn 150–450 points and unlock higher-value Zoom and Saturday answers. Use all six errands before rejoining.
- Willow needs a practical access plan. Dottie offers a clown benefit. Nora needs verified facts. Ruth wants queer trivia back. Tess needs ticket sales that cover rent.
- Quest rewards unlock answers in later Zoom calls and plans for Saturday. Failed errands cost points and close without their reward. Repeating a completed quest earns nothing.
- Handle unmuted auditions, Pat's 87 slides, disputed breakout rooms, the rent debate, and the final policy vote. Nora returns to ask what changed.
- Promising an access plan earns 100 points now. Completing it before Saturday earns another 450; breaking the promise loses 450. The notebook tracks evidence, promises, and score changes.
- Keep masks required, use the completed patio plan, run the optional trial, or retreat to clown school. Saturday depends on the bookings, rehearsal, and relationships you prepared.
- End with one last Zoom meeting: adjourn with receipts, enroll in clown school, or establish a permanent subcommittee. Then see your tally, ending, initials entry, and global scores.

Any ending completes the story. For the compromise ending, stay at the bar, adjourn the final call, and finish with profit at least 40, trust at least 65, and chaos no higher than 60. Final meters add score bonuses even on other routes.

In story mode, N95s provide five stamina, cloth masks provide three and ten trust, and novelty masks provide one and a 200-point bonus for a rehearsed clown benefit. Call-out pile-ons drain stamina; each call-out beyond the remaining hearts costs 75 points, two trust, and two chaos. Recess restores one heart up to the mask's limit. Stamina also unlocks patient follow-up answers. Evidence and honest answers let every mask choice finish the story. These are game mechanics, not health claims.

## Chaos mode and original RPG scenes

The separate arcade mode retains the earlier Mask Lab encounters and time-management rules. The original top-down story scenes remain in the source; the title's Story Mode now starts the adventure above.

- Talk to Tess. Saying no plays a short decline branch and returns to the decision.
- Post the announcement, read the feed, and meet Tess by the town co-op. Reinstate the policy, hold a four-round clown-school Zoom meeting, stay quiet, or retreat to Classroom Two at the clown school. The retreat route changes Saturday's venue, adds clown allies, and leads to the warm annex ending.
- Other neighbors offer optional conversations. Story choices determine ally and visitor waves.
- Bump the bar's sewing table to choose an N95, cloth mask, novelty mask, or no mask. N95s have a raised bridge and center seam; cloth masks have pleats; novelty masks have a grin and cheek tabs. Each mask has a dark outline and light straps so it reads on the small character sprite. Sage green is the starting color; color, pattern, and accessory stay customizable.
- Saturday escalates through nine Mask Lab mix-ups: a policy pasted over a sign-up sheet, three visits from fictional Globe reporter Nora Ink, clown-school orientation, rival chalkboards, an escaped slideshow, masked karaoke with the exes, and a final commencement line dance.
- Chase moving incidents and bump them to choose a clear fix or a quotable escalation. The reporter also follows you with questions. Paperwork knocks you around; stamina cushions the impact. Matching tool stations offer another way to resolve each problem.
- Dance and karaoke incidents use timed arrow sequences. Dialogue and performances pause the room. A missed sequence can be retried. Clown allies shorten sequences.
- Handle incidents quickly for a speed bonus. Clear answers protect trust; wild quotes pay more immediately and recruit clown allies, but raise chaos. A chain adds points, and three saves within fourteen seconds clear flying paper, recharge tools, and grant a brief collision shield. Incidents left alone escalate after eighteen seconds but remain fixable. The room speeds up in three acts.
- Drinks are optional: at most six patrons offer small score bonuses, vibe, and stamina recovery. Ignoring them has no meter penalty. Most points come from handling the Mask Lab mix-ups.
- Finish with three dialogue rounds against Marlow Quill's clipboard. See your tally, one of four warm endings, initials entry, global scores, and credits.

N95s have five stamina and reduce sick-day penalties. Cloth masks have three stamina and add ten trust. Novelty masks have one stamina and add thirty starting vibe. No mask has no stamina and moves faster when a direction is held. All health-related stats are fictional game mechanics.

## Score and leaderboard

```text
score = mode points + profit × 10 + trust × 10 + (100 − chaos) × 10
```

Each meter is bounded to 0–100. Story points start at 500, rise or fall with decisions, and stay within 0–7,500. Each decision resolves once. The tally shows points gained and lost; the notebook keeps the ledger. Early departure from a recess forfeits its unused errands.

In Chaos Mode, each of nine incidents earns 250 base points, up to 150 speed points, 50–100 approach points, and up to 50 chain points, capped at 500 per incident. Six faction waves earn up to 150 each, six optional drinks 100 each, and three boss answers 500 each: at most 7,500 arcade points. Meter bonuses add at most 3,000. The enforced ceiling remains **10,500**, and existing leaderboard scores are preserved. Each incident, wave, or patron can award points only once. Both modes share the casual leaderboard.

Explicitly choosing clown-school retreat or the permanent subcommittee determines that ending. Otherwise, high trust/profit and manageable chaos earn the compromise; strong clown ties or a novelty mask with enough chaos earn the annex; high chaos or profit earns national attention; other runs earn the eternal subcommittee.

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

Tests use an installed Google Chrome browser and an isolated local Worker with temporary SQLite storage. They cover API validation, rate limiting, retry deduplication, a complete arrow-only adventure, finite errands, locked answers, point losses, promises, clown-school retreat, touch controls, offline behavior, mask benefits, waves, endings, and score limits. Mask tests compare actual sprite pixels in the editor and gameplay, including rear views and customization. Production scores are never touched. Screenshots and failure traces go in `test-results/`.

## Files

- `public/index.html`: all game logic, pixel art, UI, CSS, and audio.
- `src/index.ts`: static asset fallback and HTTP API.
- `src/leaderboard.ts`: SQLite storage, rate limits, ranking, and retries.
- `src/validation.ts`: input schema, score bound, initials blocklist.
- `wrangler.jsonc`: assets, Durable Object binding, migration, and logs.
- `worker-configuration.d.ts`: generated Cloudflare types.

Real town, imagined game story, affectionate satire. Health needs are never the punchline.
