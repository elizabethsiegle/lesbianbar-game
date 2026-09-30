# LAST DITCH / Chromatic Edition

A native Game Boy Color adaptation for the ModRetro Chromatic. The build is
`build/last-ditch.gbc`: a 64 KiB ROM with MBC5 and 8 KiB battery SRAM.

## Play

Load the ROM in a Game Boy Color emulator or a compatible programmable cartridge.
ModRetro's [DevDay guide](https://support.modretro.com/en_us/chromatic-devday-edition-quickstart-guid-By1iOlcMg)
explains developer mode and supported cartridge flashing. This repository does
not flash hardware automatically.

- D-pad: move and bump into people, doors, and stations. Up/down selects responses.
- A: reveal text, continue, or confirm. Right also confirms dialogue.
- B: leave an unfinished optional quest without spending points.
- Select: switch between the bar, your roommate's clown-school Zoom, and clown school.
- Start: pause Saturday and resume it.
- Mask editor: up/down selects a row; left/right changes it. A advances to DONE.
- Initials: up/down changes letters; A/right advances; B/left goes back.

Get the Zoom call under control. Complete any of five optional quests for access,
ticket sales, verified reporting, a clown benefit, or trivia. Each quest resolves
once. Bump the Zoom host again to choose Saturday's policy, or retreat to clown
school. Access compromises need Willow's plan.

Saturday lasts 60 seconds. Bump arrivals before their patience bars expire;
practical responses gain points and escalation loses points. Dodge flying
paperwork. Snacks and a line dance restore stamina and vibe with an eight-second
cooldown. N95 gives five stamina; cloth gives three and ten trust; novelty gives
one and extra clown-benefit points; no mask moves faster. Any mask can finish.

The finale is a three-choice listserv battle, followed by a score tally, one of
four endings, initials, and a local top five. Scores, ending, mask, and initials
persist in battery SRAM. The cartridge uses local scores because it has no
connection to the browser game's Cloudflare leaderboard. Save progress mid-run
and network scores are not included in this edition.

The satire targets committees and escalation. Access needs are practical game
objectives. Characters and dialogue are invented.

## Build

Install Node.js, Make, and the official [GBDK 2020 4.5.0 release](https://github.com/gbdk-2020/gbdk-2020/releases/tag/4.5.0)
for your OS. Extract GBDK to a directory of your choice:

```sh
make GBDK_HOME=/path/to/gbdk
```

The asset generator creates 2-bit tiles from the original bitmap font and code
art. Backgrounds use 102 tiles and eight four-color palettes. The owner uses four
8x8 sprites, with separate palettes for the face and flannel. Mask type, color,
pattern, and accessories update those actual hardware sprites.

## Validate

Use Python 3.9 or newer in a virtual environment:

```sh
python3 -m venv .venv
.venv/bin/pip install -r tools/requirements.txt
.venv/bin/python tools/playtest.py
```

The emulator test checks boot/header validation, controls, three locations,
quest rewards and penalties, repeat prevention, mask pixels, stamina, a real
arcade interaction, timer pause, the finale, initials, and SRAM after reboot.
It writes `build/playtest.json` and screenshots. Its temporary saves never
change the player's cartridge scores. Physical Chromatic testing is separate.

Source: `src/main.c`. Generated art: `src/assets.c`. Generator: `tools/assets.mjs`.
