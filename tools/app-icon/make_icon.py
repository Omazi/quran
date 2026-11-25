"""Draws the app icon of Jannatuk and writes every file the app needs from it.

The icon is the plan of the app's own garden seen from above (docs/specs/garden.md, layout of
the level-1 garden), turned as the app shows it: four beds around the pool, canals of light
water leaving the pool between them, and one bed still growing, because the garden grows hizb
by hizb. In the pool, the eight-pointed star of the listening rosette
(src/features/listening/rosette), the mark of the hizb in the mushaf. See
docs/design/brand-spec.md, section "Icône", and docs/DECISIONS.md, D38.

usage: python3 -I tools/app-icon/make_icon.py [--previews DIR]

Needs Python 3 with Pillow and numpy, and `rsvg-convert` (librsvg) on the PATH. Nothing here is
part of the app. Writes:
  assets/expo.icon/                       Icon Composer bundle (iOS 26 layered icon)
  assets/images/icon.png                  1024 x 1024, opaque, square corners
  assets/images/android-icon-*.png        adaptive icon layers
  assets/images/favicon.png, splash-icon.png
"""
import dataclasses
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

# The star of the rosette (src/features/listening/config.ts, ROSETTE_GEOMETRY.hollow).
HOLLOW = math.sqrt(0.5) / math.cos(math.pi / 8)


@dataclasses.dataclass(frozen=True)
class Design:
    """Every choice of the icon. Lengths are points of the 1024 canvas.

    Colours by role (docs/design/brand-spec.md, "Icône"). Contrast, WCAG formula: beds against
    the water (pool, canals) 3.1:1 to 3.3:1; beds against the paving 2.0:1 to 2.1:1, helped by
    the hue (yellow-green on blue-green); water against the paving 6.6:1. The star is lighter
    than the water (1.4:1): a detail, not the identity.
    """

    field: tuple = ("#073338", "#042125")  # deep water, top to bottom
    field_dark: tuple = ("#03191C", "#010B0D")  # the same water at night (dark appearance)
    plot_top: str = "#0F4A4E"  # the plot's surface between the beds (paving)
    plot_side: str = "#021416"  # the plot's sides, darker than the field: they draw the block
    beds: tuple = ("#417E2B", "#45822D")  # growth, towards yellow-green; nearly flat, against the field's slope
    water: str = "#8FE0EA"  # accentStrong, dark value: the pool and the canals
    spring: str = "#EFFCFD"  # the star: the lightest shape

    squash: float = 0.62  # vertical scale of the plan: seen at an angle, as the app shows the garden
    depth: float = 60  # height of the plot, in points on screen
    motif: float = 0.70  # width of the four beds, as a share of the canvas (with the plot: 82.6 %)
    plot_margin: float = 40  # plot border around the beds
    channel: float = 86  # paving between two beds: 64 points on screen once seen at an angle
    corner: float = 0.11  # outer corner radius, as a share of a bed's side
    bite: float = 112  # radius of the pool's clearance, the beds' concave edge
    pool_overlap: float = 8  # how far the pool's water lies over the beds' inner edges
    star: float = 70  # radius of the star's tips
    canal_root: float = 44  # canal width where it leaves the pool
    canal_tip: float = 26  # canal width where it stops
    canal_reach: float = 0.5  # canal length after the pool, as a share of a bed's side

    young: str = "low"  # how the growing bed shows: "low" (not grown yet, faint) or "small"
    young_bed: int = 2  # which bed grows: 0 back, 1 right, 2 front, 3 left (as seen)
    young_opacity: float = 0.4  # "low": opacity of the bed that has not grown yet
    young_scale: float = 0.6  # "small": size of the young bed


FINAL = Design()


def fmt(v):
    return f"{v:.2f}".rstrip("0").rstrip(".")


def rotate(p, degrees, centre=(C, C)):
    a = math.radians(degrees)
    x, y = p[0] - centre[0], p[1] - centre[1]
    return (centre[0] + x * math.cos(a) - y * math.sin(a), centre[1] + x * math.sin(a) + y * math.cos(a))


class Path:
    """A path of absolute commands, turned by `turn` degrees around the centre on output."""

    def __init__(self, turn=45.0, squash=1.0, shift=0.0):
        self.turn, self.squash, self.shift, self.parts = turn, squash, shift, []

    def _p(self, p):
        q = rotate(p, self.turn)
        return f"{fmt(q[0])} {fmt(C + (q[1] - C) * self.squash + self.shift)}"

    def move(self, p):
        self.parts.append("M" + self._p(p))

    def line(self, p):
        self.parts.append("L" + self._p(p))

    def quad(self, c, p):
        self.parts.append(f"Q{self._p(c)} {self._p(p)}")

    def arc(self, r, sweep, p, large=0):
        # Circular arcs only: the turn leaves them circles, the squash makes them level ellipses.
        self.parts.append(f"A{fmt(r)} {fmt(r * self.squash)} 0 {large} {sweep} {self._p(p)}")

    def close(self):
        self.parts.append("Z")

    def __str__(self):
        return "".join(self.parts)


def top(d):
    """Vertical offset of the plane the beds' tops, the water and the star lie on."""
    return -d.depth / 2


def P(d, shift=None, turn=45.0):
    return Path(turn, d.squash, top(d) if shift is None else shift)


def toward(p, q, distance):
    length = math.hypot(q[0] - p[0], q[1] - p[1])
    k = min(distance, length / 2) / length
    return (p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k)


def scale_about(p, origin, k):
    return (origin[0] + (p[0] - origin[0]) * k, origin[1] + (p[1] - origin[1]) * k)


# Before the 45-degree turn the beds sit in the four quadrants. After it, quadrant (sx, sy) is
# seen at: (-1,-1) top, (1,-1) right, (1,1) bottom, (-1,1) left.
QUADRANTS = [(-1, -1), (1, -1), (1, 1), (-1, 1)]


def span_of(d):
    """Side of the square the four beds fill, so the turned plan covers `motif` of the canvas."""
    # A square turned by 45 degrees reaches side * sqrt(2); a rounded corner (quadratic, cut
    # back by r on each edge) gives back r / sqrt(2) at each tip. Solve for the side.
    target = d.motif * S
    side = target / math.sqrt(2)
    for _ in range(20):
        bed = (side - d.channel) / 2
        side = (target + 2 * (d.corner * bed) / math.sqrt(2)) / math.sqrt(2)
    return side


def bed_corners(d, quadrant):
    span = span_of(d)
    half, side = span / 2, (span - d.channel) / 2
    sx, sy = quadrant
    x0 = C - half if sx < 0 else C + d.channel / 2
    y0 = C - half if sy < 0 else C + d.channel / 2
    return x0, y0, x0 + side, y0 + side, side


def inner(d, quadrant):
    """The bed's corner nearest the pool, and the direction from the bed towards the centre."""
    x0, y0, x1, y1, side = bed_corners(d, quadrant)
    cx = x1 if C > (x0 + x1) / 2 else x0
    cy = y1 if C > (y0 + y1) / 2 else y0
    return (x0, y0, x1, y1, side), (cx, cy), (1 if cx == x1 else -1), (1 if cy == y1 else -1)


def on_inner_edges(corner, sx, sy, radius):
    """Where a circle of `radius` around the centre crosses the bed's two inner edges."""
    cx, cy = corner
    return ((cx, C - sy * math.sqrt(radius**2 - (C - cx) ** 2)),
            (C - sx * math.sqrt(radius**2 - (C - cy) ** 2), cy))


def bed(path, d, quadrant, k=1.0):
    """One bed: a square, outer corners rounded, the corner nearest the pool bitten (concave).
    `k` < 1 draws it smaller, grown out from the pool."""
    (x0, y0, x1, y1, side), (cx, cy), sx, sy = inner(d, quadrant)
    r = d.corner * side
    on_x, on_y = on_inner_edges((cx, cy), sx, sy, d.bite)
    corners = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    i = corners.index((cx, cy))
    rounded = corners[i + 1 :] + corners[:i]
    start = on_x if rounded[0][0] == cx else on_y
    end = on_y if start is on_x else on_x
    if k != 1.0:  # grow from the pool: scale the outer part about the middle of the bite
        mid = (C - sx * d.bite / math.sqrt(2), C - sy * d.bite / math.sqrt(2))
        rounded = [scale_about(p, mid, k) for p in rounded]
        r *= k
    path.move(start)
    previous = start
    for j, corner in enumerate(rounded):
        following = rounded[j + 1] if j + 1 < len(rounded) else end
        path.line(toward(corner, previous, r))
        path.quad(corner, toward(corner, following, r))
        previous = corner
    path.line(end)
    # Corners are walked clockwise on screen: the closing arc turns the other way, sweep 0.
    path.arc(d.bite, 0, start)
    path.close()


def circle(path, cx, cy, r):
    path.move((cx + r, cy))
    path.arc(r, 1, (cx - r, cy), large=1)
    path.arc(r, 1, (cx + r, cy), large=1)
    path.close()


def canal(path, d, direction):
    """A canal leaving the pool along a channel, narrowing, stopping short with a round end."""
    side = (span_of(d) - d.channel) / 2
    start, stop = d.bite - 20, d.bite + d.canal_reach * side
    a = math.radians(direction)
    ux, uy, nx, ny = math.cos(a), math.sin(a), -math.sin(a), math.cos(a)

    def at(dist, offset):
        return (C + ux * dist + nx * offset, C + uy * dist + ny * offset)

    path.move(at(start, -d.canal_root / 2))
    path.line(at(stop, -d.canal_tip / 2))
    path.arc(d.canal_tip / 2, 1, at(stop, d.canal_tip / 2))
    path.line(at(start, d.canal_root / 2))
    path.close()


def star_path(d):
    """The eight-pointed star, first tip up, every corner rounded (HIG: no sharp corners)."""
    points = []
    for i in range(16):
        length = d.star if i % 2 == 0 else d.star * HOLLOW
        a = i * math.pi / 8 - math.pi / 2
        points.append((C + math.cos(a) * length, C + math.sin(a) * length))
    path, r = P(d, turn=0), d.star * 0.07
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


def hull(points):
    """Convex hull, counter-clockwise (monotone chain)."""
    pts = sorted(set(points))

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def plot_svg(d):
    """The raised plot under the plan. The plot is convex, so the solid it makes, seen from any
    angle, is the convex hull of its surface and of the same surface lowered by `depth`: one
    plain path for the sides, then the surface on top. No filter, no effect."""
    span = span_of(d) + 2 * d.plot_margin
    r = d.corner * (span - d.channel) / 2
    corners = [(C - span / 2, C - span / 2), (C + span / 2, C - span / 2),
               (C + span / 2, C + span / 2), (C - span / 2, C + span / 2)]

    def outline(path):
        for j, p in enumerate(corners):
            a, b = toward(p, corners[j - 1], r), toward(p, corners[(j + 1) % 4], r)
            (path.move if j == 0 else path.line)(a)
            path.quad(p, b)
        path.close()

    def on_screen(shift, steps=24):
        """The outline as points on screen, the rounded corners sampled finely."""
        tracer, pts = P(d, shift=shift), []
        for j, p in enumerate(corners):
            a, b = toward(p, corners[j - 1], r), toward(p, corners[(j + 1) % 4], r)
            for k in range(steps + 1):
                t = k / steps
                q = ((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * p[0] + t * t * b[0],
                     (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * p[1] + t * t * b[1])
                x, y = rotate(q, tracer.turn)
                pts.append((round(x, 2), round(C + (y - C) * d.squash + shift, 2)))
        return pts

    solid = hull(on_screen(top(d)) + on_screen(d.depth / 2))
    sides = "M" + "L".join(f"{fmt(x)} {fmt(y)}" for x, y in solid) + "Z"
    face = P(d)
    outline(face)
    return svg(f'<path d="{sides}" fill="{d.plot_side}"/><path d="{face}" fill="{d.plot_top}"/>')


def beds_svg(d):
    grown, parts = P(d), []
    for n, q in enumerate(QUADRANTS):
        if n != d.young_bed:
            bed(grown, d, q)
    parts.append(f'<path d="{grown}" fill="url(#beds)"/>')
    young = P(d)
    q = QUADRANTS[d.young_bed]
    if d.young == "small":
        bed(young, d, q, d.young_scale)
        parts.append(f'<path d="{young}" fill="url(#beds)"/>')
    else:
        bed(young, d, q)
        parts.append(f'<path d="{young}" fill="url(#beds)" fill-opacity="{d.young_opacity}"/>')
    return svg("".join(parts), vertical("beds", *d.beds))


def water_svg(d):
    pool = P(d)
    circle(pool, C, C, d.bite + d.pool_overlap)
    paths = [f'<path d="{pool}" fill="{d.water}"/>']
    for direction in (0, 90, 180, 270):
        c = P(d)
        canal(c, d, direction)
        paths.append(f'<path d="{c}" fill="{d.water}"/>')
    return svg("".join(paths))


def spring_svg(d):
    return svg(f'<path d="{star_path(d)}" fill="{d.spring}"/>')


def field_svg(colours):
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


def manifest(d):
    """icon.json. Background: Icon Composer's own gradient fill, light and dark (HIG app-icons ›
    Layer design). Four foreground groups, top first: the spring, the water (pool and canals,
    lying a little over the beds' inner edges), the beds, the plot. In tinted and clear, opacity
    keeps the order of brightness: spring, water, beds, plot."""
    shadow = {"kind": "neutral", "opacity": 0.5}

    def group(name, translucency, tinted=None, specular=True):
        g = {
            "name": name.capitalize(),
            "layers": [{"image-name": f"{name}.svg", "name": name, "glass": True}],
            "shadow": shadow,
            "specular": specular,
            "translucency": {"enabled": translucency > 0, "value": translucency},
        }
        if tinted is not None:
            g["opacity-specializations"] = [{"appearance": "tinted", "value": tinted}]
        return g

    return {
        "fill-specializations": [
            {"value": gradient(d.field)},
            {"appearance": "dark", "value": gradient(d.field_dark)},
        ],
        "groups": [
            group("spring", 0.2),
            group("water", 0.3, tinted=0.85),
            group("beds", 0.12, tinted=0.65),
            group("plot", 0, tinted=0.3, specular=False),
        ],
        "supported-platforms": {"squares": "shared"},
    }


def layers(d):
    """The foreground layers, bottom first."""
    return [
        ("plot.svg", plot_svg(d)),
        ("beds.svg", beds_svg(d)),
        ("water.svg", water_svg(d)),
        ("spring.svg", spring_svg(d)),
    ]


def write_bundle(d):
    bundle = os.path.join(ROOT, "assets", "expo.icon")
    assets = os.path.join(bundle, "Assets")
    if os.path.isdir(assets):
        shutil.rmtree(assets)
    os.makedirs(assets)
    for name, text in layers(d):
        with open(os.path.join(assets, name), "w", encoding="utf-8") as f:
            f.write(text)
    with open(os.path.join(bundle, "icon.json"), "w", encoding="utf-8") as f:
        json.dump(manifest(d), f, indent=2)
        f.write("\n")


def mark(d, tmp, size=S):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    for _, text in layers(d):
        im.alpha_composite(raster(text, size, tmp))
    return im


def flat(d, tmp, field=None, size=S):
    im = raster(field_svg(field or d.field), size, tmp)
    im.alpha_composite(mark(d, tmp, size))
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


def monochrome(d, tmp):
    """Android themed icon: one colour, the parts kept apart by opacity (plot faint, beds full,
    water half, the star full inside it), each laid over the ones below."""
    out = np.zeros((S, S), dtype=np.float32)
    for (_, text), weight in zip(layers(d), (0.3, 1.0, 0.5, 1.0)):
        a = np.asarray(raster(text, S, tmp).getchannel("A"), dtype=np.float32) / 255
        out = out * (1 - a) + weight * a
    im = Image.new("RGBA", (S, S), (255, 255, 255, 0))
    im.putalpha(Image.fromarray((out * 255).round().astype(np.uint8), "L"))
    return im


def main(d=FINAL):
    images = os.path.join(ROOT, "assets", "images")
    write_bundle(d)
    with tempfile.TemporaryDirectory() as tmp:
        # Every platform but iOS 26: one flat square, opaque, the system rounds it.
        flat(d, tmp).convert("RGB").save(os.path.join(images, "icon.png"), optimize=True)

        # Android adaptive icon (108 dp canvas): the mark stays well inside the 66 dp circle every
        # launcher mask keeps, so a round, squircle or teardrop mask never cuts it.
        safe = S * 33 / 108
        fit(mark(d, tmp), safe * 0.9).save(os.path.join(images, "android-icon-foreground.png"), optimize=True)
        raster(field_svg(d.field), S, tmp).convert("RGB").save(os.path.join(images, "android-icon-background.png"))
        fit(monochrome(d, tmp), safe * 0.9).save(os.path.join(images, "android-icon-monochrome.png"), optimize=True)

        # Web: the tile with its own corners (a browser tab does not round it).
        tile = flat(d, tmp, size=192)
        tile.putalpha(squircle(192))
        tile.resize((48, 48), Image.LANCZOS).save(os.path.join(images, "favicon.png"), optimize=True)

        # Splash picture, kept for whoever needs it; app.json shows no picture on the launch
        # screen on purpose (HIG launching.md › Launch screens). The whole tile, so it holds on
        # a white or a black screen alike.
        splash = flat(d, tmp, size=512)
        splash.putalpha(squircle(512))
        splash.save(os.path.join(images, "splash-icon.png"), optimize=True)

        if "--previews" in sys.argv:
            out = sys.argv[sys.argv.index("--previews") + 1]
            os.makedirs(out, exist_ok=True)
            flat(d, tmp, d.field_dark).convert("RGB").save(os.path.join(out, "flat-dark.png"))
            for name, text in layers(d):
                raster(text, S, tmp).save(os.path.join(out, "layer-" + name.replace(".svg", ".png")))
    print("icon written")


if __name__ == "__main__":
    main()
