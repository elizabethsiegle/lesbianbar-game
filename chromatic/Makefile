GBDK_HOME ?= $(HOME)/gbdk
LCC := $(GBDK_HOME)/bin/lcc
ROM := build/last-ditch.gbc

.PHONY: all assets test
all: $(ROM)

assets: src/assets.c src/assets.h

src/assets.c src/assets.h: tools/assets.mjs
	node tools/assets.mjs

$(ROM): src/main.c src/assets.c src/assets.h
	mkdir -p build
	$(LCC) -Wm-yC -Wm-yt0x1B -Wm-yo4 -Wm-ya1 -Wm-ynLASTDITCH -Wl-j -o $(ROM) src/main.c src/assets.c

test: $(ROM)
	python3 tools/playtest.py
