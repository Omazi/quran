"""The vertical measures of a font that centring needs, read from the font file itself.

    python3 tools/design-qa/font_band.py <font.ttf> [text]
    python3 tools/design-qa/font_band.py <font.ttf> --surah-titles

Prints, in ems: the ascent and descent the layout engines use for the line (table `hhea`), and the
band of Arabic letters without marks, from the top of alif-lam down to the bowls of ra and waw
(measured on the shaped glyphs of "سورة ال", or of `text`). With `--surah-titles` the band is the
median over the 114 titles the reader writes ("سورة" and the name of `assets/data/structure.json`):
one title with a deep final mim or a hamza above its alif must not move all the others.
`src/ui/ink-centre.ts` keeps these numbers for the fonts of framed Arabic titles;
`test_font_band.py` checks they still match the font files.
"""

from __future__ import annotations

import json
import statistics
import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont, features

BAND_TEXT = "سورة ال"
SIZE = 400  # pixels per em: the measure is good to 1/400 em


def line_metrics(path: str) -> tuple[float, float]:
    font = TTFont(path)
    units = font["head"].unitsPerEm
    return font["hhea"].ascent / units, -font["hhea"].descent / units


def ink_band(path: str, text: str = BAND_TEXT) -> tuple[float, float]:
    """How far the ink of `text` rises above the baseline and falls below it, in ems."""
    if not features.check("raqm"):
        raise RuntimeError("Pillow without libraqm cannot shape Arabic: the band cannot be measured")
    font = ImageFont.truetype(path, SIZE, layout_engine=ImageFont.Layout.RAQM)
    image = Image.new("L", (SIZE * (len(text) + 4), SIZE * 5), 0)
    baseline = SIZE * 3
    ImageDraw.Draw(image).text((SIZE, baseline), text, font=font, fill=255, anchor="ls", direction="rtl", language="ar")
    box = image.point(lambda value: 255 if value >= 128 else 0).getbbox()
    return (baseline - box[1]) / SIZE, (box[3] - baseline) / SIZE


def surah_titles() -> list[str]:
    structure = Path(__file__).resolve().parents[2] / "assets" / "data" / "structure.json"
    return ["سورة " + surah["nameArabic"] for surah in json.loads(structure.read_text())["surahs"]]


def median_band(path: str, texts: list[str]) -> tuple[float, float]:
    bands = [ink_band(path, text) for text in texts]
    return statistics.median(band[0] for band in bands), statistics.median(band[1] for band in bands)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    ascent, descent = line_metrics(sys.argv[1])
    if "--surah-titles" in sys.argv:
        top, bottom = median_band(sys.argv[1], surah_titles())
    else:
        top, bottom = ink_band(sys.argv[1], *(sys.argv[2:3]))
    print(f"ascent {ascent:.3f}  descent {descent:.3f}  bandTop {top:.3f}  bandBottom {bottom:.3f}")
    print(f"shift = ((bandTop - bandBottom) - (ascent - descent)) / 2 = {((top - bottom) - (ascent - descent)) / 2:+.4f} em")
