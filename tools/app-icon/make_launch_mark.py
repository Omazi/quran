"""Writes src/features/launch/mark-geometry.ts: the outlines of the icon's three layers (word,
water drops, leaf), placed on the 1024 canvas exactly as make_icon.py places them, so the animated
launch mark and the icon are the same drawing.

usage: python3 -I tools/app-icon/make_launch_mark.py
Same bytes on every run. Needs nothing but Python 3 (the outlines are already in word-arabic.svg).
"""
import importlib.util
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "src", "features", "launch", "mark-geometry.ts")

spec = importlib.util.spec_from_file_location("make_icon", os.path.join(HERE, "make_icon.py"))
icon = importlib.util.module_from_spec(spec)
spec.loader.exec_module(icon)

# The part of the 1024 canvas the launch mark shows: the icon's own margins are cropped, so the
# mark fills its 180 pt box as the launch picture did (600 px for 856 canvas px).
CROP = (58, 54, 856)

word = icon.read_word("arabic")
shapes = icon.placed({"word": word["word"], "water": word["water"], "leaf": icon.leaf_path(**icon.LEAF_SHAPE)})

# Where the leaf grows from: the base of its slit-less outline, placed like everything else. The
# probe is part of the bounds only if it lies outside them, which the assert rules out.
base = icon.LEAF_SHAPE["base"]
raw = {"word": word["word"], "water": word["water"], "leaf": icon.leaf_path(**icon.LEAF_SHAPE)}
raw_probe = icon.placed({**raw, "probe": "M%s,%s" % (base[0], -base[1])})
assert all(raw_probe[k] == shapes[k] for k in shapes), "the leaf base lies outside the mark"
ox, oy = icon.pairs(raw_probe["probe"])[0]

drops = [s.strip() for s in re.split(r"(?=M)", shapes["water"]) if s.strip()]
ys = [p[1] for p in icon.pairs(shapes["word"])]


def ts(d):
    return "'%s'" % d


lines = [
    "/**",
    " * The mark of the launch animation: the outlines of the app icon's three layers, on its 1024",
    " * canvas. Written by tools/app-icon/make_launch_mark.py: do not edit by hand.",
    " */",
    "export const LAUNCH_MARK = {",
    "  /** The part of the canvas shown (x, y, side): the icon's margins are cropped. */",
    "  viewBox: { x: %d, y: %d, size: %d }," % CROP,
    "  /** The letters, with the Arabic kaf's small mark. */",
    "  word: %s," % ts(shapes["word"]),
    "  /** The drops of water, one outline each, in the order the font draws them. */",
    "  drops: [",
    *["    %s," % ts(d) for d in drops],
    "  ] as readonly string[],",
    "  /** The leaf, with its midrib slit. */",
    "  leaf: %s," % ts(shapes["leaf"]),
    "  /** Where the leaf joins the stroke of the kaf: the point it grows from. */",
    "  leafBase: { x: %.2f, y: %.2f }," % (ox, oy),
    "  /** Top and bottom of the letters, for the wipe that writes them. */",
    "  wordTop: %.1f," % min(ys),
    "  wordBottom: %.1f," % max(ys),
    "} as const;",
    "",
]
with open(OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
print("wrote", OUT, len(drops), "drops")
