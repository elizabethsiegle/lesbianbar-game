from pathlib import Path
from tempfile import TemporaryDirectory
from shutil import copyfile
import json
import hashlib
import re
from pyboy import PyBoy
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ROM = ROOT / "build/last-ditch.gbc"
SYMBOLS = {
    name: int(address, 16)
    for name, address in re.findall(r"DEF _(\w+) 0x([0-9A-Fa-f]+)", ROM.with_suffix(".noi").read_text())
}
SHOTS = ROOT / "build/screenshots"
SHOTS.mkdir(exist_ok=True)


class Game:
    def __init__(self, path):
        self.emu = PyBoy(str(path), window="null", sound_emulated=True, cgb=True)
        self.emu.set_emulation_speed(0)
        self.emu.tick(180, True)

    def read(self, name, offset=0):
        return self.emu.memory[SYMBOLS[name] + offset]

    def word(self, name):
        return self.read(name) | self.read(name, 1) << 8

    def tap(self, button):
        self.emu.button_press(button)
        self.emu.tick(8, True)
        self.emu.button_release(button)
        self.emu.tick(12, True)

    def screenshot(self, name):
        self.emu.screen.image.resize((640, 576), Image.Resampling.NEAREST).save(SHOTS / (name + ".png"))

    def ready(self):
        for _ in range(20):
            assert self.read("state") == 3, "Expected dialogue"
            page = self.read("dialog_page")
            rows = self.read("dialog_lines")
            length = 0
            for row in range(page * 5, min(page * 5 + 5, rows)):
                line = bytes(self.emu.memory[SYMBOLS["wrapped"] + row * 19:SYMBOLS["wrapped"] + row * 19 + 19])
                length += len(line.split(b"\0")[0])
            if page + 1 == self.read("dialog_pages") and self.read("dialog_pos") >= length:
                return
            self.tap("a")
        raise AssertionError("Dialogue did not advance")

    def choose(self, index=0):
        self.ready()
        for _ in range(index):
            self.tap("down")
        self.tap("a")

    def finish_text(self, target):
        for _ in range(20):
            if self.read("state") == target:
                return
            assert self.read("state") == 3, f"Unexpected screen {self.read('state')}"
            assert self.read("menu_count") == 0, "Would accidentally choose an option"
            self.ready()
            self.tap("a")
        raise AssertionError("Text did not finish")

    def new_run(self, mask=0):
        assert self.read("state") == 0
        self.tap("a")
        self.finish_text(1)
        for _ in range(mask):
            self.tap("right")
        self.screenshot("mask-" + str(mask))
        for _ in range(5):
            self.tap("a")
        assert self.read("state") == 2
        assert self.read("stamina") == [5, 3, 1, 0][mask]

    def walk(self, x, y, allow_dialog=False):
        for _ in range(80):
            if allow_dialog and self.read("state") == 3:
                return
            assert self.read("state") in (2, 4), "Walk hit an unexpected interaction"
            px, py = self.read("px"), self.read("py")
            if (px, py) == (x, y):
                return
            button = "down" if py < y else "up" if py > y else "right" if px < x else "left"
            self.emu.button_press(button)
            self.emu.tick(1, True)
            self.emu.button_release(button)
            self.emu.tick(4, True)
        raise AssertionError("Movement did not reach target")

    def person(self, x, expected=3):
        self.walk(self.read("px"), 8)
        self.walk(x, 8)
        self.tap("up")
        assert self.read("state") == expected

    def location(self, target):
        for _ in range(3):
            if self.read("location") == target:
                return
            self.tap("select")
        raise AssertionError("Location did not change")

    def quest(self, place, x, good=True):
        self.location(place)
        self.person(x)
        before = self.word("points")
        self.choose(0 if good else 1)
        self.finish_text(2)
        assert (self.word("points") > before) == good

    def close(self):
        self.emu.stop()


def validate_header():
    rom = ROM.read_bytes()
    assert len(rom) == 65536
    assert rom[0x143] == 0xC0, "Must be a Game Boy Color ROM"
    assert rom[0x147] == 0x1B, "Battery SRAM cartridge type"
    assert rom[0x149] == 2, "8 KiB SRAM"
    checksum = 0
    for byte in rom[0x134:0x14D]:
        checksum = (checksum - byte - 1) & 255
    assert checksum == rom[0x14D]


def run():
    validate_header()
    with TemporaryDirectory(prefix="last-ditch-playtest-") as temp:
        path = Path(temp) / "last-ditch.gbc"
        copyfile(ROM, path)
        game = Game(path)
        game.screenshot("title")
        game.new_run()
        game.screenshot("bar")
        game.walk(1, 9)
        game.walk(1, 10)
        game.tap("left")
        assert game.read("location") == 1, "Bump the bar door to enter Zoom"
        game.walk(17, 10)
        game.tap("right")
        assert game.read("location") == 2, "Bump the portal to enter clown school"
        game.location(1)
        game.person(5)
        game.ready()
        game.screenshot("zoom")
        game.choose()
        game.finish_text(2)
        assert game.read("phase") == 2
        game.quest(0, 14)
        game.quest(0, 5)
        game.quest(1, 14)
        game.quest(2, 5)
        game.screenshot("school")
        assert [game.read("quests", i) for i in range(4)] == [1, 1, 1, 1]
        before = game.word("points")
        game.person(5, expected=2)
        assert game.read("state") == 2, "A completed quest must not reopen"
        assert game.word("points") == before, "No repeat points"
        game.location(1)
        game.person(5)
        game.choose()
        game.finish_text(4)
        game.screenshot("saturday")
        seconds = game.read("shift_seconds")
        game.tap("start")
        game.emu.tick(180, True)
        assert game.read("shift_seconds") == seconds, "Paused timer must stop"
        game.tap("start")
        game.emu.tick(720, True)
        assert game.read("shift_seconds") < seconds
        # The arcade path resolves an actual arrival through movement and a choice.
        visitors = SYMBOLS["visitors"]
        active = next(i for i in range(3) if game.emu.memory[visitors + i * 5 + 3])
        x, y = game.emu.memory[visitors + active * 5:visitors + active * 5 + 2]
        game.walk(x, y + 1, allow_dialog=True)
        if game.read("state") == 4:
            game.tap("up")
        assert game.read("state") == 3
        before = game.word("points")
        game.choose()
        assert game.read("state") == 4
        assert game.word("points") > before
        assert game.read("resolved") >= 1
        for _ in range(100):
            if game.read("state") == 3:
                break
            active = [i for i in range(3) if game.emu.memory[visitors + i * 5 + 3]]
            if active:
                x, y = game.emu.memory[visitors + active[0] * 5:visitors + active[0] * 5 + 2]
                game.walk(x, y + 1, allow_dialog=True)
                if game.read("state") == 4:
                    game.tap("up")
                assert game.read("state") == 3
                game.choose()
            else:
                game.emu.tick(120, True)
        assert game.read("state") == 3, "Saturday reaches the listserv finale"
        assert game.read("spawned") == 9
        assert game.read("resolved") == 9, "Every arrival can be rescued in time"
        for _ in range(3):
            game.choose()
        assert game.read("state") == 9
        score = game.word("final_score")
        assert 0 <= score <= 10500
        assert game.read("ending_id") == 0, "Successful plans reach the compromise"
        game.screenshot("tally")
        game.tap("a")
        if game.read("state") == 9:
            game.tap("a")
        game.finish_text(6)
        game.screenshot("initials")
        for _ in range(3):
            game.tap("a")
        assert game.read("state") == 7, f"Initials screen {game.read('state')}, letter {game.read('initials_pos')}"
        assert game.word("board") == score
        game.screenshot("leaderboard")
        game.close()
        game = Game(path)
        assert game.word("board") == score, "Battery scores survive reboot"
        game.close()

        hashes = set()
        for mask in range(4):
            newpath = Path(temp) / ("mask" + str(mask) + ".gbc")
            copyfile(ROM, newpath)
            game = Game(newpath)
            game.new_run(mask)
            pixels = game.emu.screen.ndarray[80:96, 80:96].tobytes()
            hashes.add(hashlib.sha256(pixels).hexdigest())
            if mask == 1:
                assert game.read("trust") == 60
            game.location(0)
            game.quest(0, 5, good=False)
            assert game.read("quests", 1) == 2
            game.close()
        assert len(hashes) == 4, "Four visibly distinct masks on the player"

        for ending, policy, answers in [(1, 2, [0, 0, 0]), (2, 1, [1, 1, 0]), (3, 1, [0, 0, 2])]:
            newpath = Path(temp) / ("ending" + str(ending) + ".gbc")
            copyfile(ROM, newpath)
            game = Game(newpath)
            game.new_run()
            game.location(1)
            game.person(5)
            game.choose()
            game.finish_text(2)
            game.person(5)
            game.choose(policy)
            game.finish_text(4)
            game.emu.tick(4500, True)
            for answer in answers:
                game.choose(answer)
            assert game.read("state") == 9
            assert game.read("ending_id") == ending, f"Expected ending {ending}"
            game.close()

    report = {"status": "passed", "rom": ROM.name, "sha256": hashlib.sha256(ROM.read_bytes()).hexdigest(),
              "checks": ["CGB boot and cartridge header", "four visible masks and stamina", "three locations", "points gain and loss", "quests cannot loop or farm points", "Zoom to Saturday", "all nine arcade arrivals and pause", "all four endings and bounded scores", "initials and battery leaderboard reboot"]}
    (ROOT / "build/playtest.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    run()
