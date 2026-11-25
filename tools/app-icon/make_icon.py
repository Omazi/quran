"""Renders the app icon of Jannatuk and writes every file the app needs from it.

The icon is a young fruit tree rooted at the edge of a small stream that runs down a soft lawn
towards the viewer: reading waters the garden, "gardens beneath which rivers flow"
(docs/design/brand-spec.md, "Icône"; docs/DECISIONS.md, D38). It is a 3D render, like the garden
itself (D35); every shape is built in the scene, every colour is flat and set here.

usage: python3 -I tools/app-icon/make_icon.py [--previews DIR]

Needs Python 3 with Pillow, numpy and Playwright (headless Chromium), and the garden render tool
(its three.js), by default in /home/claude/gen/garden3d (set GARDEN3D to move
it). The scene is tools/app-icon/scene.html. The output is the same, byte for byte, from one run
to the next on the same machine (software WebGL). Nothing here ships in the app. Writes:
  assets/expo.icon/                       Icon Composer bundle (iOS 26 layered icon)
  assets/images/icon.png                  1024 x 1024, opaque, square corners
  assets/images/android-icon-*.png        adaptive icon layers
  assets/images/favicon.png, splash-icon.png
"""
import base64
import contextlib
import functools
import http.server
import io
import json
import os
import shutil
import socketserver
import sys
import tempfile
import threading

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
GARDEN3D = os.environ.get("GARDEN3D", "/home/claude/gen/garden3d")
S = 1024

# Background: Icon Composer's own gradient, a pale warm sky down to a soft water teal.
FIELD = ("#D6ECE2", "#7DC0C5")
FIELD_DARK = ("#0E5A63", "#062E33")  # the same, at night (dark appearance)

SCENE = {
    # The lawn: the crown of a large sphere, running off the bottom edge.
    "moundRadius": 6.0, "moundTop": 0.0, "lawn": "#6DBA4E",
    # The stream: from behind the tree, past its foot, down towards the viewer (x, z on the lawn).
    "stream": [[0.9, -3.2], [0.45, -1.2], [0.3, 0.1], [-0.05, 1.3], [0.35, 2.5], [0.05, 4.2], [0.3, 6.0]],
    "streamWidth": [0.16, 0.62], "streamLift": 0.012,
    "waterDeep": "#2C8FA2", "waterBank": "#86D3DB", "waterShine": "#E8FAFB",
    "highlight": [0.5, 0.66, -0.55, 0.05],
    # The tree: a short sturdy trunk, a crown of five low-poly masses, two shades.
    "treeAt": [-0.12, 0.0], "trunk": [0.09, 0.14, 0.62],
    "crown": [[0.0, 0.42, 0.0, 0.56, 0], [-0.44, 0.2, 0.05, 0.42, 0], [0.44, 0.24, -0.05, 0.44, 0],
              [0.04, 0.82, -0.1, 0.42, 0], [0.08, 0.14, 0.34, 0.36, 0]],
    "crownDetail": 1, "leaf": "#7CC95A", "leafDeep": "#4E9E46", "bark": "#6E4630",
    "toonSteps": [150, 255],
    # Five fruits, round and coral: they give the tree its kind at 60 points and up, vanish at 29
    # without a smudge, and have about the leaves' luminance, so the one-tone versions (tinted,
    # clear) show no dark spots (a red read as a spotted mushroom there).
    "fruit": [[-0.25, 0.48, 0.5], [0.24, 0.66, 0.42], [0.44, 0.28, 0.32], [-0.48, 0.14, 0.34], [0.02, 0.2, 0.64]],
    "fruitRadius": 0.09, "fruitColour": "#FF8A70",
    # Light: a clear warm key from the upper left, a cool sky fill.
    "sky": "#CFE6FF", "bounce": "#8DB36A", "fill": 1.1, "key": 2.0, "sun": [-4, 6, 5],
    "sunColour": "#FFE6C2", "shadow": 0.35,
}
VIEW = {"fov": 26, "az": 0, "el": 12, "target": [0, 0.8, 0], "dist": 7.0, "offset": [0, 0]}
CROWN_WIDTH = 0.53  # the tree's width, as a share of the canvas
TREE_CENTRE = (0.48, 0.42)  # where the tree's box sits (x, y), as shares of the canvas

# Layers, bottom first: (name, parts drawn, parts that may hide them). A lower layer is whole
# under the ones above it; a layer is cut only by what stands in front of it.
LAYERS = [
    ("ground", ["ground"], []),
    ("water", ["water"], ["ground"]),
    ("tree", ["tree"], ["ground", "water"]),
]
TINTED = {"ground": 0.45, "water": 0.8, "tree": 1.0}  # tinted/clear: tree, then water, then lawn


class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


@contextlib.contextmanager
def site():
    """A throwaway web root: the scene and three.js (a link, nothing copied)."""
    with tempfile.TemporaryDirectory() as root:
        shutil.copy(os.path.join(HERE, "scene.html"), os.path.join(root, "index.html"))
        os.symlink(os.path.join(GARDEN3D, "tool", "node_modules", "three"), os.path.join(root, "three"))
        handler = functools.partial(_Quiet, directory=root)
        httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
        httpd.daemon_threads = True
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        try:
            yield f"http://127.0.0.1:{httpd.server_address[1]}"
        finally:
            httpd.shutdown()
            httpd.server_close()


@contextlib.contextmanager
def scene_page():
    from playwright.sync_api import sync_playwright

    with site() as base, sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        page = browser.new_page(viewport={"width": 512, "height": 512})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(base + "/index.html")
        page.wait_for_function("window.ready === true", timeout=120000)
        page.evaluate("(o) => window.build(o)", SCENE)
        try:
            yield page
        finally:
            browser.close()
            if errors:
                raise RuntimeError("scene errors: " + "; ".join(errors))


def shot(page, view, size, only=None, below=None):
    url = page.evaluate("([o, a, b]) => window.shot(o, a, b)", [dict(view, size=size), only, below])
    return Image.open(io.BytesIO(base64.b64decode(url.split(",", 1)[1]))).convert("RGBA")


def frame(page):
    """Move the camera so the tree is CROWN_WIDTH wide and its box centred at TREE_CENTRE; the
    lawn then runs off the bottom edge."""
    view = dict(VIEW)
    for _ in range(4):
        a = np.asarray(shot(page, view, 512, ["tree"], []))[:, :, 3] > 10
        ys, xs = np.nonzero(a)
        x0, x1, y0, y1 = xs.min() / 512, xs.max() / 512, ys.min() / 512, ys.max() / 512
        k = CROWN_WIDTH / (x1 - x0)
        view["dist"] /= k
        view["offset"] = [view["offset"][0] + ((x0 + x1) / 2 - TREE_CENTRE[0]) * k,
                          view["offset"][1] + ((y0 + y1) / 2 - TREE_CENTRE[1]) * k]
    return view


def render_layers():
    """The full picture and each layer, rendered at 2048 and reduced to 1024 (smooth edges)."""
    with scene_page() as page:
        view = frame(page)
        out = {"full": shot(page, view, 2 * S)}
        for name, only, below in LAYERS:
            out[name] = shot(page, view, 2 * S, only, below)
    return {k: v.resize((S, S), Image.LANCZOS) for k, v in out.items()}


def gradient(colours, size=S):
    top, bottom = (np.array([int(h[i : i + 2], 16) for i in (1, 3, 5)], dtype=np.float64) for h in colours)
    t = np.linspace(0, 1, size)[:, None, None]
    return Image.fromarray(np.round(top * (1 - t) + bottom * t).astype(np.uint8).repeat(size, 1), "RGB")


def colour(hex_):
    """Icon Composer colour string, sRGB."""
    r, g, b = (int(hex_[i : i + 2], 16) / 255 for i in (1, 3, 5))
    return f"srgb:{r:.5f},{g:.5f},{b:.5f},1.00000"


def ic_gradient(colours):
    return {
        "linear-gradient": [colour(colours[0]), colour(colours[1])],
        "orientation": {"start": {"x": 0.5, "y": 0}, "stop": {"x": 0.5, "y": 1}},
    }


def manifest():
    """icon.json. Background: Icon Composer's gradient fill, light and dark (HIG app-icons ›
    Layer design). Three groups, top first: the tree, the water, the lawn. No translucency on
    the tree and the lawn (a see-through tree would show the sky through its leaves)."""

    def group(name, translucency):
        g = {
            "name": name.capitalize(),
            "layers": [{"image-name": f"{name}.png", "name": name, "glass": True}],
            "shadow": {"kind": "neutral", "opacity": 0.5},
            "specular": True,
            "translucency": {"enabled": translucency > 0, "value": translucency},
        }
        if TINTED[name] < 1:
            g["opacity-specializations"] = [{"appearance": "tinted", "value": TINTED[name]}]
        return g

    return {
        "fill-specializations": [
            {"value": ic_gradient(FIELD)},
            {"appearance": "dark", "value": ic_gradient(FIELD_DARK)},
        ],
        "groups": [group("tree", 0), group("water", 0.2), group("ground", 0)],
        "supported-platforms": {"squares": "shared"},
    }


def scaled(im, k):
    """`im` scaled by `k` about the centre, on a transparent square of the same size."""
    small = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.alpha_composite(small, ((im.width - small.width) // 2, (im.height - small.height) // 2))
    return out


def reach(im):
    """Distance from the centre to the farthest opaque pixel of `im`."""
    ys, xs = np.nonzero(np.asarray(im)[:, :, 3] > 8)
    return np.sqrt((xs + 0.5 - im.width / 2) ** 2 + (ys + 0.5 - im.height / 2) ** 2).max()


def squircle(size, n=5.0, ss=4):
    """Approximation of the system's rounded square, for files that must carry their own corners."""
    s = size * ss
    y, x = np.mgrid[0:s, 0:s]
    u, v = (x + 0.5) / s * 2 - 1, (y + 0.5) / s * 2 - 1
    m = ((np.abs(u) ** n + np.abs(v) ** n) <= 1).astype(np.uint8) * 255
    return Image.fromarray(m, "L").resize((size, size), Image.LANCZOS)


def monochrome(layers):
    """Android themed icon: one colour, lawn faint, water half, tree full, each over the ones below."""
    out = np.zeros((S, S), dtype=np.float32)
    for name, weight in (("ground", 0.35), ("water", 0.6), ("tree", 1.0)):
        a = np.asarray(layers[name].getchannel("A"), dtype=np.float32) / 255
        out = out * (1 - a) + weight * a
    im = Image.new("RGBA", (S, S), (255, 255, 255, 0))
    im.putalpha(Image.fromarray((out * 255).round().astype(np.uint8), "L"))
    return im


def flat(full, field, size=S):
    im = gradient(field, S).convert("RGBA")
    im.alpha_composite(full)
    return im if size == S else im.resize((size, size), Image.LANCZOS)


def save(im, *path):
    im.save(os.path.join(ROOT, *path), optimize=True)


def main():
    layers = render_layers()
    full = layers["full"]

    bundle = os.path.join(ROOT, "assets", "expo.icon")
    if os.path.isdir(os.path.join(bundle, "Assets")):
        shutil.rmtree(os.path.join(bundle, "Assets"))
    os.makedirs(os.path.join(bundle, "Assets"))
    for name, _, _ in LAYERS:
        save(layers[name], "assets", "expo.icon", "Assets", f"{name}.png")
    with open(os.path.join(bundle, "icon.json"), "w", encoding="utf-8") as f:
        json.dump(manifest(), f, indent=2)
        f.write("\n")

    # Every platform but iOS 26: one flat square, opaque, the system rounds it.
    save(flat(full, FIELD).convert("RGB"), "assets", "images", "icon.png")

    # Android adaptive icon (108 dp canvas): the tree stays inside the 66 dp circle every launcher
    # mask keeps; the lawn and the stream run on under the mask, as they run off the iOS icon.
    k = min(1.0, S * 33 / 108 * 0.95 / reach(layers["tree"]))
    save(scaled(full, k), "assets", "images", "android-icon-foreground.png")
    save(gradient(FIELD), "assets", "images", "android-icon-background.png")
    save(scaled(monochrome(layers), k), "assets", "images", "android-icon-monochrome.png")

    # Web: the tile with its own corners (a browser tab does not round it).
    tile = flat(full, FIELD, 192)
    tile.putalpha(squircle(192))
    save(tile.resize((48, 48), Image.LANCZOS), "assets", "images", "favicon.png")

    # Splash picture, kept for whoever needs it; app.json shows no picture on the launch screen
    # on purpose (HIG launching.md › Launch screens).
    splash = flat(full, FIELD, 512)
    splash.putalpha(squircle(512))
    save(splash, "assets", "images", "splash-icon.png")

    if "--previews" in sys.argv:
        out = sys.argv[sys.argv.index("--previews") + 1]
        os.makedirs(out, exist_ok=True)
        flat(full, FIELD_DARK).convert("RGB").save(os.path.join(out, "flat-dark.png"))
        for name, im in layers.items():
            im.save(os.path.join(out, f"layer-{name}.png"))
    print("icon written")


if __name__ == "__main__":
    main()
