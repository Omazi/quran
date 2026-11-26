"""Pictures of a baked garden (assets/models/garden/level-N/garden.glb), drawn by the app's own 3D
scene in headless Chromium: the picture fallback and the thumbnails of a level are its 3D garden at
rest (docs/specs/garden-pictures.md, D40, D46).

usage:
  python3 -I tools/garden-3d/render.py check --level N [--glb file] [--out file.png]
      A contact sheet to look at: hizb 0, 15, 30, 45, 60, a drought and the dead earth, on the
      light and dark backgrounds of the app.
  python3 -I tools/garden-3d/render.py set --level N --out <folder> [--from A --to B]
      The whole set, as the level-1 set (docs/specs/garden-pictures.md): <folder>/base/hNN-fF.webp,
      the dry garden of NN elements and foliage F, and <folder>/water/hNN-fF-wW.webp, what the
      water (W 1 low, 2 flowing) changes on it. 1170 x 816, the frame of the level-1 pictures.

Needs Python with Playwright and its Chromium, Pillow and numpy, and node (to make the app's
TypeScript readable by the browser).
"""
import argparse
import base64
import io
import os
import subprocess
import sys
import tempfile
import time

from PIL import Image

TOOL = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, TOOL)
from bake import CHROMIUM_ARGS, REPO, output_of, serve  # noqa: E402

SIZE = (1170, 816)  # the frame of every garden picture (GARDEN_PICTURE_PIXELS)
SUPERSAMPLE = 4 / 3  # drawn larger, then reduced: smoother edges, as the level-1 pictures (1600 to 1200)
QUALITY = 84  # the quality of the shipped pictures after the cut (tools/garden-pictures)
LIGHT, DARK = (242, 242, 247), (0, 0, 0)
FOLIAGE_STAGES = 4
WATER_PICTURES = (1, 2)


def overlay_of(dry, wet):
    """The pixels water changes, from the picture with water: over the dry picture, they give the wet one."""
    import numpy as np

    a, b = np.asarray(dry, dtype=np.int16), np.asarray(wet, dtype=np.int16)
    changed = np.abs(a - b).max(axis=2) > 6
    out = np.asarray(wet).copy()
    out[..., 3] = np.where(changed, out[..., 3], 0)
    out[~changed, :3] = 0
    return Image.fromarray(out, "RGBA")


class Renderer:
    def __init__(self, page, glb_url):
        self.page = page
        big = (round(SIZE[0] * SUPERSAMPLE), round(SIZE[1] * SUPERSAMPLE))
        self.info = page.evaluate("([u, w, h]) => window.load(u, w, h)", [glb_url, big[0], big[1]])

    def shot(self, count, water, foliage):
        data = self.page.evaluate("(s) => window.shot(s)", {"count": count, "water": water, "foliage": foliage})
        image = Image.open(io.BytesIO(base64.b64decode(data.split(",", 1)[1]))).convert("RGBA")
        return image.resize(SIZE, Image.LANCZOS)


def on(background, image):
    card = Image.new("RGB", image.size, background)
    card.paste(image, (0, 0), image)
    return card


def check(renderer, out):
    states = [(0, 2, 0), (15, 2, 0), (30, 2, 0), (45, 2, 0), (60, 2, 0), (60, 1, 1), (60, 0, 3), (0, 0, 3)]
    shots = [renderer.shot(*s) for s in states]
    w, h = SIZE[0] // 2, SIZE[1] // 2
    sheet = Image.new("RGB", (w * 4, h * 4), LIGHT)
    for i, image in enumerate(shots):
        small = image.resize((w, h), Image.LANCZOS)
        col, row = i % 4, (i // 4) * 2
        sheet.paste(on(LIGHT, small), (col * w, row * h))
        sheet.paste(on(DARK, small), (col * w, (row + 1) * h))
    sheet.save(out)
    # Nothing may touch the edges of the frame: the level-1 pictures keep 16 pixels free around.
    for (count, water, foliage), image in zip(states, shots):
        box = image.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
        if box and (box[0] < 8 or box[1] < 8 or box[2] > SIZE[0] - 8 or box[3] > SIZE[1] - 8):
            print(f"warning: hizb {count} water {water} foliage {foliage} touches the frame: {box}")
    for (count, water, foliage), image in zip(states, shots):
        if (count, water, foliage) == (60, 2, 0):
            on(LIGHT, image).save(out.replace(".png", "-full.png"))


def full_set(renderer, out, first, last):
    for folder in ("base", "water"):
        os.makedirs(os.path.join(out, folder), exist_ok=True)
    started = time.time()
    for count in range(first, last + 1):
        for foliage in range(FOLIAGE_STAGES):
            dry = renderer.shot(count, 0, foliage)
            dry.save(os.path.join(out, "base", f"h{count:02d}-f{foliage}.webp"), "WEBP", quality=QUALITY, method=4)
            for water in WATER_PICTURES:
                over = overlay_of(dry, renderer.shot(count, water, foliage))
                if over.getbbox() is None:
                    continue  # no water in this garden yet
                over.save(os.path.join(out, "water", f"h{count:02d}-f{foliage}-w{water}.webp"), "WEBP", quality=QUALITY, method=4)
        print(f"  hizb {count}: {time.time() - started:.0f} s", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("what", choices=["check", "set"])
    parser.add_argument("--level", type=int, required=True)
    parser.add_argument("--glb")
    parser.add_argument("--out")
    parser.add_argument("--from", dest="first", type=int, default=0)
    parser.add_argument("--to", dest="last", type=int, default=60)
    args = parser.parse_args()
    glb = os.path.abspath(args.glb or output_of(args.level))
    from playwright.sync_api import sync_playwright

    with tempfile.TemporaryDirectory() as app:
        subprocess.run(["node", os.path.join(TOOL, "lib", "app-modules.mjs"), app], check=True)
        roots = {"/app/": app, "/glb/": os.path.dirname(glb)}
        with serve(TOOL, roots) as base, sync_playwright() as p:
            browser = p.chromium.launch(args=CHROMIUM_ARGS)
            page = browser.new_page()
            logs = []
            page.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))
            page.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
            try:
                page.goto(base + "/repo/tools/garden-3d/render.html")
                page.wait_for_function("window.ready === true", timeout=60000)
                renderer = Renderer(page, "/glb/" + os.path.basename(glb))
                if args.what == "check":
                    out = args.out or f"/tmp/garden-level-{args.level}-check.png"
                    check(renderer, out)
                    print("written:", out)
                else:
                    full_set(renderer, args.out, args.first, args.last)
            except Exception:
                print("\n".join(logs[-30:]))
                raise
            browser.close()


if __name__ == "__main__":
    main()
