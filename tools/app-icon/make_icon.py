"""Draws the app icon of Jannatuk and writes every file the app needs from it.

The icon is the name, جنتك ("your garden"), written in Nastaliq calligraphy (the typeface Gulzar,
SIL Open Font License). The long stroke of the kaf rises across the icon and ends in a leaf: the
word grows the garden. The dots of the letters are water, coloured like it. See
docs/design/brand-spec.md, "Icône", and docs/DECISIONS.md, D38.

usage:
  python3 -I tools/app-icon/make_icon.py [--previews DIR]
      Writes the icon files from tools/app-icon/word.svg. Needs Python 3 with Pillow and numpy,
      and rsvg-convert (librsvg) to turn the vector layers into PNG. Same bytes on every run on
      the same machine.
  python3 -I tools/app-icon/make_icon.py --outline PATH/TO/Gulzar-Regular.ttf
      Shapes the word again with HarfBuzz and rewrites tools/app-icon/word.svg (the outlines,
      in font units). Needs uharfbuzz and fontTools. Only needed to change the word or the font.

Writes:
  assets/expo.icon/                       Icon Composer bundle: background gradient (light and
                                          dark) and three vector layers, leaf, water, word
  assets/images/icon.png                  1024 x 1024, opaque, square corners
  assets/images/android-icon-*.png        adaptive icon layers
  assets/images/favicon.png, splash-icon.png
Nothing here ships in the app but the files above.
"""
import hashlib
import io
import json
import math
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
WORD_SVG = os.path.join(HERE, "word.svg")
S = 1024
TEXT = "جنتك"

# Background: Icon Composer's own gradient. Deep water, the app's action colour (accent #0E6B78)
# a little lighter at the top; at night (dark appearance), the same water, darker.
FIELD = ("#13808C", "#0A515B")
FIELD_DARK = ("#0B3C44", "#05222A")
# Foreground colours, the same in every appearance (only the background darkens).
WORD = "#F6FBF9"  # the letters: near white, cool (not paper, not cream)
WATER = "#8FE0EA"  # the dots: water, the accent's high-contrast value in dark mode
LEAF = "#8FDB6B"  # the leaf: a young green, lighter than the water so the two never merge

# The leaf, in font units (y up): it grows out of the end of the kaf's stroke, its base inside
# the stroke's last taper so the stroke runs into it, lying along the stroke's way and curling up
# a little, with a slit for its midrib. A leaf set on the very tip balanced on a point (stuck on);
# one standing upright read as a flame; two leaves made a loop that read as one more letter (م)
# in the one-tone versions.
LEAF_SHAPE = {"base": (1355, 1086), "angle": 42, "length": 500, "half_width": 128, "bend": 0.06,
              "vein": (0.12, 0.76, 16)}
# Size and place: the whole mark (word and leaf) is centred, its larger side this share of the
# canvas (app-icons.md › Icon shape: primary content centred).
FILL = 0.78
# Then nudged up and left: the box is centred, but the weight of the word (the jim, the dots)
# sits low and right of it; this moves the mark about half way towards its centre of mass.
OPTICAL_SHIFT = (-0.025, -0.03)  # shares of the canvas

LAYERS = ("word", "water", "leaf")  # bottom first
TINTED_OPACITY = {"water": 0.7}  # tinted and clear: the drops a step lighter than word and leaf
MONO_WEIGHT = {"word": 1.0, "water": 0.6, "leaf": 1.0}  # Android themed icon, one colour


# ----------------------------------------------------------------------------- outlines (font)


def outline(font_path):
    """Shape TEXT with HarfBuzz, outline every glyph, and write word.svg in font units, y down.
    Marks (GDEF class 3: the dots) go to the "water" path, everything else to "word"."""
    import uharfbuzz as hb
    from fontTools.pens.basePen import BasePen
    from fontTools.pens.transformPen import TransformPen
    from fontTools.ttLib import TTFont

    class PathPen(BasePen):
        def __init__(self, glyph_set):
            super().__init__(glyph_set)
            self.d = []

        def _moveTo(self, p):
            self.d.append("M%s" % _pt(p))

        def _lineTo(self, p):
            self.d.append("L%s" % _pt(p))

        def _curveToOne(self, a, b, c):
            self.d.append("C%s %s %s" % (_pt(a), _pt(b), _pt(c)))

        def _qCurveToOne(self, a, b):
            self.d.append("Q%s %s" % (_pt(a), _pt(b)))

        def _closePath(self):
            self.d.append("Z")

    blob = hb.Blob.from_file_path(font_path)
    font = hb.Font(hb.Face(blob))
    buf = hb.Buffer()
    buf.add_str(TEXT)
    buf.guess_segment_properties()
    buf.language = "ar"
    hb.shape(font, buf, {})
    tt = TTFont(font_path)
    glyph_set, order = tt.getGlyphSet(), tt.getGlyphOrder()
    classes = tt["GDEF"].table.GlyphClassDef.classDefs
    paths = {"word": PathPen(glyph_set), "water": PathPen(glyph_set)}
    x = 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = order[info.codepoint]
        pen = paths["water" if classes.get(name) == 3 else "word"]
        glyph_set[name].draw(TransformPen(pen, (1, 0, 0, -1, x + pos.x_offset, -pos.y_offset)))
        x += pos.x_advance
    with open(font_path, "rb") as f:
        digest = hashlib.sha256(f.read()).hexdigest()
    family = tt["name"].getDebugName(4)
    version = tt["name"].getDebugName(5)
    with open(WORD_SVG, "w", encoding="utf-8") as f:
        f.write(
            "<!-- %s: the word %s shaped by HarfBuzz %s, outlined by fontTools, in font units\n"
            "     (y down, %d units per em). Font: %s, %s, SHA-256 %s, SIL Open Font License 1.1.\n"
            "     Written by tools/app-icon/make_icon.py --outline; do not edit by hand. -->\n"
            % (os.path.basename(WORD_SVG), TEXT, hb.version_string(), tt["head"].unitsPerEm, family, version, digest)
        )
        f.write('<svg xmlns="http://www.w3.org/2000/svg">\n')
        for key, pen in paths.items():
            f.write('<path id="%s" d="%s"/>\n' % (key, " ".join(pen.d)))
        f.write("</svg>\n")
    print("outlines written:", WORD_SVG)


def _pt(p):
    return "%s,%s" % (_num(p[0]), _num(p[1]))


def _num(v):
    v = round(v, 1)
    return str(int(v)) if v == int(v) else str(v)


# ----------------------------------------------------------------------------- geometry


def read_word():
    with open(WORD_SVG, encoding="utf-8") as f:
        text = f.read()
    return {m.group(1): m.group(2) for m in re.finditer(r'<path id="(\w+)" d="([^"]*)"', text)}


def leaf_path(base, angle, length, half_width, bend, vein):
    """A leaf as two cubic arcs, font units y up, flipped to y down in the result like word.svg.
    The midrib slit runs the other way round, so it is a hole under the default (nonzero) fill
    rule; the word needs that rule too, since joined letters overlap."""
    a = math.radians(angle)
    ux, uy, nx, ny = math.cos(a), math.sin(a), -math.sin(a), math.cos(a)

    def at(t, side):
        curl = bend * length * t * t
        return (base[0] + ux * length * t + nx * (side + curl), -(base[1] + uy * length * t + ny * (side + curl)))

    w = half_width
    d = "M%s C%s %s %s C%s %s %s Z" % tuple(
        _pt(p) for p in (at(0, 0), at(0.18, 1.15 * w), at(0.7, 1.05 * w), at(1, 0),
                         at(0.7, -1.05 * w), at(0.18, -1.15 * w), at(0, 0))
    )
    t0, t1, half = vein
    tm = (t0 + t1) / 2
    d += " M%s Q%s %s Q%s %s Z" % tuple(_pt(p) for p in (at(t0, 0), at(tm, -half), at(t1, 0), at(tm, half), at(t0, 0)))
    return d


NUM_PAIR = re.compile(r"(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)")


def pairs(d):
    return [(float(a), float(b)) for a, b in NUM_PAIR.findall(d)]


def placed(paths):
    """Scale and move every path (font units, y down) so the whole mark is centred on the canvas,
    its larger side FILL of it. The bounds are those of the control points: for these outlines
    they are within a few units of the curves (checked on the rendered alpha in the previews)."""
    pts = [p for d in paths.values() for p in pairs(d)]
    x0, x1 = min(p[0] for p in pts), max(p[0] for p in pts)
    y0, y1 = min(p[1] for p in pts), max(p[1] for p in pts)
    k = S * FILL / max(x1 - x0, y1 - y0)
    tx = S / 2 - (x0 + x1) / 2 * k + OPTICAL_SHIFT[0] * S
    ty = S / 2 - (y0 + y1) / 2 * k + OPTICAL_SHIFT[1] * S
    return {
        name: NUM_PAIR.sub(lambda m: "%.2f,%.2f" % (float(m.group(1)) * k + tx, float(m.group(2)) * k + ty), d)
        for name, d in paths.items()
    }


def layer_svg(d, colour):
    """One Icon Composer layer: a square canvas, one path, one flat colour, no transform."""
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">\n'
        '<path fill="%s" d="%s"/>\n</svg>\n' % (S, S, S, S, colour, d)
    )


COLOURS = {"word": WORD, "water": WATER, "leaf": LEAF}


def layers():
    word = read_word()
    shapes = placed({"word": word["word"], "water": word["water"], "leaf": leaf_path(**LEAF_SHAPE)})
    return {name: layer_svg(shapes[name], COLOURS[name]) for name in LAYERS}


# ----------------------------------------------------------------------------- rasters


def raster(svg_text, size=S):
    from PIL import Image

    out = subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size)], input=svg_text.encode(),
                         capture_output=True, check=True).stdout
    return Image.open(io.BytesIO(out)).convert("RGBA")


def gradient(colours, size=S):
    import numpy as np
    from PIL import Image

    top, bottom = (np.array([int(h[i: i + 2], 16) for i in (1, 3, 5)], dtype=np.float64) for h in colours)
    t = np.linspace(0, 1, size)[:, None, None]
    return Image.fromarray(np.round(top * (1 - t) + bottom * t).astype(np.uint8).repeat(size, 1), "RGB")


def composite(rasters, field, names=LAYERS):
    im = gradient(field).convert("RGBA")
    for name in names:
        im.alpha_composite(rasters[name])
    return im


def foreground(rasters):
    from PIL import Image

    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    for name in LAYERS:
        im.alpha_composite(rasters[name])
    return im


def monochrome(rasters):
    """Android themed icon: one colour; the drops lighter than the word and the leaf."""
    import numpy as np
    from PIL import Image

    out = np.zeros((S, S), dtype=np.float32)
    for name in LAYERS:
        a = np.asarray(rasters[name].getchannel("A"), dtype=np.float32) / 255
        out = out * (1 - a) + MONO_WEIGHT[name] * a
    im = Image.new("RGBA", (S, S), (255, 255, 255, 0))
    im.putalpha(Image.fromarray((out * 255).round().astype(np.uint8), "L"))
    return im


def reach(im):
    """Distance from the centre to the farthest visible pixel of `im`."""
    import numpy as np

    ys, xs = np.nonzero(np.asarray(im)[:, :, 3] > 8)
    return float(np.sqrt((xs + 0.5 - im.width / 2) ** 2 + (ys + 0.5 - im.height / 2) ** 2).max())


def scaled(im, k):
    from PIL import Image

    small = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.alpha_composite(small, ((im.width - small.width) // 2, (im.height - small.height) // 2))
    return out


def squircle(size, n=5.0, ss=4):
    """Approximation of the system's rounded square, for files that carry their own corners."""
    import numpy as np
    from PIL import Image

    s = size * ss
    y, x = np.mgrid[0:s, 0:s]
    u, v = (x + 0.5) / s * 2 - 1, (y + 0.5) / s * 2 - 1
    m = ((np.abs(u) ** n + np.abs(v) ** n) <= 1).astype(np.uint8) * 255
    return Image.fromarray(m, "L").resize((size, size), Image.LANCZOS)


# ----------------------------------------------------------------------------- Icon Composer


def colour(hex_):
    r, g, b = (int(hex_[i: i + 2], 16) / 255 for i in (1, 3, 5))
    return f"srgb:{r:.5f},{g:.5f},{b:.5f},1.00000"


def ic_gradient(colours):
    return {
        "linear-gradient": [colour(colours[0]), colour(colours[1])],
        "orientation": {"start": {"x": 0.5, "y": 0}, "stop": {"x": 0.5, "y": 1}},
    }


def manifest():
    """icon.json. Background: Icon Composer's gradient fill, light and dark (app-icons.md › Layer
    design). Three groups, top first: the leaf, the water, the word, each one vector layer.
    The drops are a little translucent (water); the word and the leaf are not."""

    def group(name, translucency):
        g = {
            "name": name.capitalize(),
            "layers": [{"image-name": f"{name}.svg", "name": name, "glass": True}],
            "shadow": {"kind": "neutral", "opacity": 0.5},
            "specular": True,
            "translucency": {"enabled": translucency > 0, "value": translucency},
        }
        if name in TINTED_OPACITY:
            g["opacity-specializations"] = [{"appearance": "tinted", "value": TINTED_OPACITY[name]}]
        return g

    return {
        "color-space-for-untagged-svg-colors": "srgb",
        "fill-specializations": [
            {"value": ic_gradient(FIELD)},
            {"appearance": "dark", "value": ic_gradient(FIELD_DARK)},
        ],
        "groups": [group("leaf", 0), group("water", 0.3), group("word", 0)],
        "supported-platforms": {"squares": "shared"},
    }


# ----------------------------------------------------------------------------- previews


def previews(out, rasters, svgs):
    """What a reviewer needs to judge the icon: sizes, Home Screens, appearance approximations,
    Android masks. The tinted and clear versions are approximations of what iOS computes."""
    import numpy as np
    from PIL import Image, ImageDraw

    os.makedirs(out, exist_ok=True)
    light, dark = composite(rasters, FIELD), composite(rasters, FIELD_DARK)

    def rounded(im, size):
        t = im.resize((size, size), Image.LANCZOS).convert("RGBA")
        t.putalpha(squircle(size))
        return t

    def lum_layers(bg, opacity):
        a = np.zeros((S, S, 3), np.float32) + np.array(bg, np.float32) / 255
        for name in LAYERS:
            px = np.asarray(rasters[name]).astype(np.float32) / 255
            lum = 0.2126 * px[..., 0] + 0.7152 * px[..., 1] + 0.0722 * px[..., 2]
            al = px[..., 3:4] * opacity.get(name, 1.0)
            a = a * (1 - al) + lum[..., None] * al
        return a

    def tinted(tint):
        g = lum_layers((0.07, 0.07, 0.08), TINTED_OPACITY)[..., :1]
        bg = np.array([0.07, 0.07, 0.08], np.float32)
        a = bg * (1 - g) + np.array(tint, np.float32) / 255 * g
        return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), "RGB")

    def wall(dark_):
        w = Image.new("RGB", (1170, 700))
        d = ImageDraw.Draw(w)
        for y in range(700):
            t = y / 700
            d.line([(0, y), (1170, y)], fill=(int(36 + 30 * t), int(44 + 20 * t), int(84 - 30 * t)) if dark_
                   else (int(214 - 40 * t), int(190 + 20 * t), int(232 - 30 * t)))
        return w

    def clear(dark_):
        a = np.asarray(wall(dark_).resize((S, S))).astype(np.float32) / 255
        a = a * 0.5 + 0.5 * (np.array([0.16, 0.17, 0.19]) if dark_ else np.array([0.86, 0.88, 0.9]))
        for name in LAYERS:
            al = np.asarray(rasters[name]).astype(np.float32)[..., 3:4] / 255 * 0.85 * TINTED_OPACITY.get(name, 1.0)
            a = a * (1 - al) + (0.97 if dark_ else 1.0) * al
        return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), "RGB")

    def home(icon, dark_):
        w = wall(dark_)
        for j, y in enumerate((120, 400)):
            for i, x in enumerate((78, 348, 618, 888)):
                if (i, j) == (1, 0):
                    t = rounded(icon, 192)
                    w.paste(t, (x, y), t)
                else:
                    ph = Image.new("RGB", (192, 192), (60, 60, 66) if dark_ else (232, 232, 237))
                    w.paste(ph, (x, y), squircle(192))
        return w

    def android(fg, bg):
        vis = round(S * 72 / 108)
        off = (S - vis) // 2
        c = bg.copy().convert("RGBA")
        c.alpha_composite(fg)
        c = c.crop((off, off, off + vis, off + vis)).resize((512, 512), Image.LANCZOS)
        m = Image.new("L", (2048, 2048), 0)
        ImageDraw.Draw(m).ellipse([0, 0, 2047, 2047], fill=255)
        c.putalpha(m.resize((512, 512), Image.LANCZOS))
        return c

    files = {
        "icon-1024-light.png": light.convert("RGB"),
        "icon-1024-dark.png": dark.convert("RGB"),
        "home-light.png": home(light, False),
        "home-dark.png": home(dark, True),
        "tinted-light.png": tinted((255, 176, 64)),
        "tinted-dark.png": tinted((120, 200, 255)),
        "clear-light.png": clear(False),
        "clear-dark.png": clear(True),
    }
    k = android_scale(rasters)
    fg = scaled(foreground(rasters), k)
    files["android-round.png"] = android(fg, gradient(FIELD))
    mono = scaled(monochrome(rasters), k)
    tint = Image.new("RGBA", (S, S), (210, 232, 214, 255))
    tint.putalpha(mono.getchannel("A"))
    files["android-monochrome.png"] = android(tint, Image.new("RGB", (S, S), (34, 50, 40)))
    sizes = Image.new("RGB", (640, 460), "#E9E9EB")
    for r, im in enumerate((light, dark)):
        x = 16
        for s in (180, 60, 29):
            t = rounded(im, s)
            sizes.paste(t, (x, 16 + r * 220), t)
            x += s + 24
        t = rounded(im, 29).resize((116, 116), Image.NEAREST)  # 29 px, magnified four times
        sizes.paste(t, (x, 16 + r * 220), t)
    files["sizes-180-60-29.png"] = sizes
    for name, im in files.items():
        im.save(os.path.join(out, name))
    for name in LAYERS:
        rasters[name].save(os.path.join(out, f"layer-{name}.png"))
        with open(os.path.join(out, f"layer-{name}.svg"), "w", encoding="utf-8") as f:
            f.write(svgs[name])


def android_scale(rasters):
    """The whole mark inside the 66 dp circle every launcher mask keeps (108 dp canvas)."""
    return min(1.0, S * 33 / 108 * 0.96 / reach(foreground(rasters)))


# ----------------------------------------------------------------------------- main


def save(im, *path):
    im.save(os.path.join(ROOT, *path), optimize=True)


def main():
    if "--outline" in sys.argv:
        outline(sys.argv[sys.argv.index("--outline") + 1])
        return
    svgs = layers()
    rasters = {name: raster(svg) for name, svg in svgs.items()}

    bundle = os.path.join(ROOT, "assets", "expo.icon")
    shutil.rmtree(os.path.join(bundle, "Assets"), ignore_errors=True)
    os.makedirs(os.path.join(bundle, "Assets"))
    for name in LAYERS:
        with open(os.path.join(bundle, "Assets", f"{name}.svg"), "w", encoding="utf-8") as f:
            f.write(svgs[name])
    with open(os.path.join(bundle, "icon.json"), "w", encoding="utf-8") as f:
        json.dump(manifest(), f, indent=2, ensure_ascii=False)
        f.write("\n")

    # Every platform but iOS 26: one flat square, opaque; the system rounds it.
    save(composite(rasters, FIELD).convert("RGB"), "assets", "images", "icon.png")

    # Android adaptive icon: the mark inside the safe circle, the gradient behind.
    k = android_scale(rasters)
    save(scaled(foreground(rasters), k), "assets", "images", "android-icon-foreground.png")
    save(gradient(FIELD), "assets", "images", "android-icon-background.png")
    save(scaled(monochrome(rasters), k), "assets", "images", "android-icon-monochrome.png")

    # Web: the tile with its own corners (a browser tab does not round it).
    from PIL import Image

    tile = composite(rasters, FIELD).resize((192, 192), Image.LANCZOS)
    tile.putalpha(squircle(192))
    save(tile.resize((48, 48), Image.LANCZOS), "assets", "images", "favicon.png")

    # Splash picture, kept for whoever needs it; app.json shows no picture on the launch screen
    # on purpose (launching.md › Launch screens).
    splash = composite(rasters, FIELD).resize((512, 512), Image.LANCZOS)
    splash.putalpha(squircle(512))
    save(splash, "assets", "images", "splash-icon.png")

    if "--previews" in sys.argv:
        previews(sys.argv[sys.argv.index("--previews") + 1], rasters, svgs)
    print("icon written")


if __name__ == "__main__":
    main()
