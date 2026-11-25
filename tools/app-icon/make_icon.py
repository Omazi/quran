"""Draws the app icon of Jannatuk and writes every file the app needs from it.

The icon is the plan of the app's own garden seen from above (tools: docs/specs/garden.md,
layout of the level-1 garden): four beds around the pool where the channels meet. The pool is
the eight-pointed star of the listening rosette (src/features/listening/rosette), the mark of
the hizb in the mushaf. Water is the field the garden stands on. See docs/design/brand-spec.md,
section "Icône", and docs/DECISIONS.md, D38.

usage: python3 -I tools/app-icon/make_icon.py [--previews DIR]

Needs Python 3 with Pillow and numpy, and `rsvg-convert` (librsvg) on the PATH. Nothing here is
part of the app. Writes:
  assets/expo.icon/                       Icon Composer bundle (iOS 26 layered icon)
  assets/images/icon.png                  1024 x 1024, opaque, square corners
  assets/images/android-icon-*.png        adaptive icon layers
  assets/images/favicon.png, splash-icon.png
"""
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
S = 1024
C = S / 2

# Colours by role. Every one is a value of docs/design/brand-spec.md, section 3, except the
# two water tones of the field, which extend `accent` towards `accentStrong` (light) and towards
# a night water (dark appearance).
FIELD = ("#13838F", "#0A4F59")  # water: lighter accent at the top, accentStrong at the bottom
FIELD_DARK = ("#0D3A40", "#04191C")  # the same water at night, for the dark appearance
BEDS = ("#63C794", "#2E9160")  # growth: `growth` dark value at the top, deeper at the bottom
SPRING = "#8FE0EA"  # accentStrong, dark value: the brightest thing in the icon

# Geometry, in points of the 1024 canvas.
PLAN_SPAN = 672  # side of the square the four beds fill, before turning it by 45 degrees
CHANNEL = 56  # width of the water between two beds
BED_CORNER = 108  # radius of a bed's outer corners
POOL_CLEARANCE = 196  # radius of the water left around the spring
SPRING_RADIUS = 156  # radius of the star's tips: 40 points of water keep it apart from the beds
SPRING_CORNER = 0.07  # rounding of the star's corners, as a share of its radius

# The star of the rosette (src/features/listening/config.ts, ROSETTE_GEOMETRY.hollow).
HOLLOW = math.sqrt(0.5) / math.cos(math.pi / 8)


def fmt(v):
    return f"{v:.2f}".rstrip("0").rstrip(".")


def rotate(p, degrees, centre=(C, C)):
    a = math.radians(degrees)
    x, y = p[0] - centre[0], p[1] - centre[1]
    return (centre[0] + x * math.cos(a) - y * math.sin(a), centre[1] + x * math.sin(a) + y * math.cos(a))


class Path:
    """A path built from absolute commands, turned by `turn` degrees around the centre."""

    def __init__(self, turn=0.0):
        self.turn, self.parts = turn, []

    def _p(self, p):
        q = rotate(p, self.turn)
        return f"{fmt(q[0])} {fmt(q[1])}"

    def move(self, p):
        self.parts.append("M" + self._p(p))

    def line(self, p):
        self.parts.append("L" + self._p(p))

    def quad(self, c, p):
        self.parts.append(f"Q{self._p(c)} {self._p(p)}")

    def arc(self, r, sweep, p):  # circular arcs only: a rotation leaves them unchanged
        self.parts.append(f"A{fmt(r)} {fmt(r)} 0 0 {sweep} {self._p(p)}")

    def close(self):
        self.parts.append("Z")

    def __str__(self):
        return "".join(self.parts)


def toward(p, q, distance):
    length = math.hypot(q[0] - p[0], q[1] - p[1])
    k = min(distance, length / 2) / length
    return (p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k)


def bed(path, x0, y0, x1, y1):
    """One bed: a square with rounded outer corners, its inner corner bitten by the pool."""
    cx = x1 if C > (x0 + x1) / 2 else x0  # the corner nearest the centre
    cy = y1 if C > (y0 + y1) / 2 else y0
    sx, sy = (1 if cx == x1 else -1), (1 if cy == y1 else -1)
    on_x_edge = (cx, C - sy * math.sqrt(POOL_CLEARANCE**2 - (C - cx) ** 2))
    on_y_edge = (C - sx * math.sqrt(POOL_CLEARANCE**2 - (C - cy) ** 2), cy)
    corners = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    k = corners.index((cx, cy))
    rounded = corners[k + 1 :] + corners[:k]
    start = on_x_edge if rounded[0][0] == cx else on_y_edge
    end = on_y_edge if start is on_x_edge else on_x_edge
    path.move(start)
    previous = start
    for i, corner in enumerate(rounded):
        following = rounded[i + 1] if i + 1 < len(rounded) else end
        path.line(toward(corner, previous, BED_CORNER))
        path.quad(corner, toward(corner, following, BED_CORNER))
        previous = corner
    path.line(end)
    # The corners are walked clockwise on screen, so the arc closing the bed always turns the
    # other way around the centre: sweep 0, the bite is concave.
    path.arc(POOL_CLEARANCE, 0, start)
    path.close()


def beds_path():
    path = Path(turn=45)
    half, side = PLAN_SPAN / 2, (PLAN_SPAN - CHANNEL) / 2
    for sx in (-1, 1):
        for sy in (-1, 1):
            x0 = C - half if sx < 0 else C + CHANNEL / 2
            y0 = C - half if sy < 0 else C + CHANNEL / 2
            bed(path, x0, y0, x0 + side, y0 + side)
    return str(path)


def spring_path():
    """The eight-pointed star, first tip up, every corner rounded (HIG: no sharp corners)."""
    points = []
    for i in range(16):
        length = SPRING_RADIUS if i % 2 == 0 else SPRING_RADIUS * HOLLOW
        a = i * math.pi / 8 - math.pi / 2
        points.append((C + math.cos(a) * length, C + math.sin(a) * length))
    path, r = Path(), SPRING_RADIUS * SPRING_CORNER
    for i, p in enumerate(points):
        a = toward(p, points[i - 1], r)
        b = toward(p, points[(i + 1) % 16], r)
        (path.move if i == 0 else path.line)(a)
        path.quad(p, b)
    path.close()
    return str(path)


def svg(body, defs=""):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{S}" height="{S}" viewBox="0 0 {S} {S}">'
        f"{f'<defs>{defs}</defs>' if defs else ''}{body}</svg>\n"
    )


def vertical(id_, top, bottom):
    return (
        f'<linearGradient id="{id_}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="{S}">'
        f'<stop offset="0" stop-color="{top}"/><stop offset="1" stop-color="{bottom}"/></linearGradient>'
    )


def layer_svgs(beds_colours=BEDS, spring=SPRING):
    beds = svg(f'<path d="{beds_path()}" fill="url(#beds)"/>', vertical("beds", *beds_colours))
    star = svg(f'<path d="{spring_path()}" fill="{spring}"/>')
    return beds, star


def field_svg(colours=FIELD):
    return svg(f'<rect width="{S}" height="{S}" fill="url(#field)"/>', vertical("field", *colours))


def raster(svg_text, size, tmp):
    src, out = os.path.join(tmp, "in.svg"), os.path.join(tmp, "out.png")
    with open(src, "w", encoding="utf-8") as f:
        f.write(svg_text)
    subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size), src, "-o", out], check=True)
    return Image.open(out).convert("RGBA").copy()


def colour(hex_):
    """Icon Composer colour string, sRGB."""
    r, g, b = (int(hex_[i : i + 2], 16) / 255 for i in (1, 3, 5))
    return f"srgb:{r:.5f},{g:.5f},{b:.5f},1.00000"


def gradient(colours):
    return {
        "linear-gradient": [colour(colours[0]), colour(colours[1])],
        "orientation": {"start": {"x": 0.5, "y": 0}, "stop": {"x": 0.5, "y": 1}},
    }


def manifest():
    """icon.json. Background: Icon Composer's own gradient fill, light and dark (HIG app-icons ›
    Layer design: no imported background needed). Two foreground groups, so the system can
    give each its own depth: the beds, then the spring on top."""
    return {
        "fill-specializations": [
            {"value": gradient(FIELD)},
            {"appearance": "dark", "value": gradient(FIELD_DARK)},
        ],
        "groups": [
            {
                "name": "Spring",
                "layers": [{"image-name": "spring.svg", "name": "spring", "glass": True}],
                "shadow": {"kind": "neutral", "opacity": 0.5},
                "specular": True,
                "translucency": {"enabled": True, "value": 0.2},
            },
            {
                "name": "Beds",
                "layers": [{"image-name": "beds.svg", "name": "beds", "glass": True}],
                "shadow": {"kind": "neutral", "opacity": 0.5},
                "specular": True,
                "translucency": {"enabled": True, "value": 0.3},
                # Tinted and clear: the spring stays the brightest shape, the beds step back.
                "opacity-specializations": [{"appearance": "tinted", "value": 0.7}],
            },
        ],
        "supported-platforms": {"squares": "shared"},
    }


def write_bundle(beds, star):
    bundle = os.path.join(ROOT, "assets", "expo.icon")
    assets = os.path.join(bundle, "Assets")
    if os.path.isdir(assets):
        shutil.rmtree(assets)
    os.makedirs(assets)
    for name, text in (("beds.svg", beds), ("spring.svg", star)):
        with open(os.path.join(assets, name), "w", encoding="utf-8") as f:
            f.write(text)
    with open(os.path.join(bundle, "icon.json"), "w", encoding="utf-8") as f:
        json.dump(manifest(), f, indent=2)
        f.write("\n")


def flat(tmp, field=FIELD, size=S):
    beds, star = layer_svgs()
    im = raster(field_svg(field), size, tmp)
    im.alpha_composite(raster(beds, size, tmp))
    im.alpha_composite(raster(star, size, tmp))
    return im


def mark(tmp, size=S):
    beds, star = layer_svgs()
    im = raster(beds, size, tmp)
    im.alpha_composite(raster(star, size, tmp))
    return im


def fit(im, radius):
    """Scale a transparent mark about the centre so its farthest opaque pixel is `radius` away."""
    a = np.asarray(im)[:, :, 3] > 8
    ys, xs = np.nonzero(a)
    reach = np.sqrt((xs + 0.5 - im.width / 2) ** 2 + (ys + 0.5 - im.height / 2) ** 2).max()
    k = radius / reach
    small = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.alpha_composite(small, ((im.width - small.width) // 2, (im.height - small.height) // 2))
    return out


def squircle(size, n=5.0, ss=4):
    """Approximation of the system's rounded square, for files that must carry their own corners."""
    s = size * ss
    y, x = np.mgrid[0:s, 0:s]
    u, v = (x + 0.5) / s * 2 - 1, (y + 0.5) / s * 2 - 1
    m = ((np.abs(u) ** n + np.abs(v) ** n) <= 1).astype(np.uint8) * 255
    return Image.fromarray(m, "L").resize((size, size), Image.LANCZOS)


def main():
    images = os.path.join(ROOT, "assets", "images")
    beds, star = layer_svgs()
    write_bundle(beds, star)
    with tempfile.TemporaryDirectory() as tmp:
        # Every platform but iOS 26: one flat square, opaque, the system rounds it.
        flat(tmp).convert("RGB").save(os.path.join(images, "icon.png"), optimize=True)

        # Android adaptive icon (108 dp canvas): the mark stays inside the 66 dp circle every
        # launcher mask keeps, so a round, squircle or teardrop mask never cuts it.
        safe = S * 33 / 108
        m = mark(tmp)
        fit(m, safe * 0.86).save(os.path.join(images, "android-icon-foreground.png"), optimize=True)
        raster(field_svg(), S, tmp).convert("RGB").save(os.path.join(images, "android-icon-background.png"))
        mono = fit(m, safe * 0.86)
        alpha = mono.getchannel("A")
        white = Image.new("RGBA", mono.size, (255, 255, 255, 0))
        white.putalpha(alpha)
        white.save(os.path.join(images, "android-icon-monochrome.png"), optimize=True)

        # Web: the tile with its own corners (a browser tab does not round it).
        tile = flat(tmp, size=192)
        tile.putalpha(squircle(192))
        tile.resize((48, 48), Image.LANCZOS).save(os.path.join(images, "favicon.png"), optimize=True)

        # Splash picture, kept for whoever needs it; app.json shows no picture on the launch
        # screen on purpose (HIG launching.md › Launch screens).
        # It is the whole tile, so it holds on a white or a black screen alike.
        splash = flat(tmp, size=512)
        splash.putalpha(squircle(512))
        splash.save(os.path.join(images, "splash-icon.png"), optimize=True)

        if "--previews" in sys.argv:
            out = sys.argv[sys.argv.index("--previews") + 1]
            os.makedirs(out, exist_ok=True)
            flat(tmp, FIELD_DARK).convert("RGB").save(os.path.join(out, "flat-dark.png"))
            for name, text in (("layer-beds", beds), ("layer-spring", star)):
                raster(text, S, tmp).save(os.path.join(out, name + ".png"))
    print("icon written")


if __name__ == "__main__":
    main()
