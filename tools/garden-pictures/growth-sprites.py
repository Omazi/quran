"""
The element of each hizb alone, cut from the shipped garden pictures: what picture hNN-f0 adds to
picture h(NN-1)-f0. The picture fallback of the garden (no GL) draws it over the garden of the
hizb before, scaled from its foot as the pages of its hizb are read (owner, 25 November 2026:
"the change must appear little by little").

    python3 -I tools/garden-pictures/growth-sprites.py

Writes assets/images/garden/level-1/grow/eNN.webp (1 to 60) and
src/features/garden/garden-sprites.generated.ts (where each one sits in the picture, and its
foot). Reads the pictures in the repository and the baked 3D garden (for the foot of each element:
the camera of the pictures, decision D40). Needs Pillow, like pixels.py.
"""

import json
import math
import os
import struct

from PIL import Image, ImageChops, ImageFilter

TOOL = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(TOOL))
BASE = os.path.join(REPO, "assets", "images", "garden", "level-1", "base")
OUT = os.path.join(REPO, "assets", "images", "garden", "level-1", "grow")
GLB = os.path.join(REPO, "assets", "models", "garden", "level-1", "garden.glb")
TABLE = os.path.join(REPO, "src", "features", "garden", "garden-sprites.generated.ts")

# The camera of the pictures (src/features/garden/garden3d/config.ts PICTURE).
AZIMUTH = math.radians(45)
ELEVATION = math.radians(38)
TARGET = (0.0, 1.5, 0.0)
UNIT = 20.2 / 900
RENDER = (1200, 900)
CROP = (15, 79)
# A change smaller than this (sum over the four channels) is the noise of the lossy pictures.
THRESHOLD = 40
QUALITY = 84


def camera_axes():
    d = (math.sin(AZIMUTH) * math.cos(ELEVATION), math.sin(ELEVATION), math.cos(AZIMUTH) * math.cos(ELEVATION))
    up = (0.0, 1.0, 0.0)
    x = (up[1] * d[2] - up[2] * d[1], up[2] * d[0] - up[0] * d[2], up[0] * d[1] - up[1] * d[0])
    n = math.sqrt(sum(c * c for c in x))
    x = tuple(c / n for c in x)
    y = (d[1] * x[2] - d[2] * x[1], d[2] * x[0] - d[0] * x[2], d[0] * x[1] - d[1] * x[0])
    return x, y


def project(point):
    x, y = camera_axes()
    p = tuple(point[k] - TARGET[k] for k in range(3))
    u = RENDER[0] / 2 + sum(p[k] * x[k] for k in range(3)) / UNIT - CROP[0]
    v = RENDER[1] / 2 - sum(p[k] * y[k] for k in range(3)) / UNIT - CROP[1]
    return u, v


def feet_of_elements():
    """For each element count n, the feet of the instanced plants that first appear at n."""
    data = open(GLB, "rb").read()
    length = struct.unpack("<I", data[12:16])[0]
    gltf = json.loads(data[20 : 20 + length])
    binary = 20 + length + 8
    feet = {}
    for node in gltf["nodes"]:
        gpu = node.get("extensions", {}).get("EXT_mesh_gpu_instancing")
        if gpu is None:
            continue
        material = gltf["materials"][gltf["meshes"][node["mesh"]]["primitives"][0]["material"]]
        if not material["extras"].get("wilts"):
            continue
        accessor = gltf["accessors"][gpu["attributes"]["TRANSLATION"]]
        view = gltf["bufferViews"][accessor["bufferView"]]
        offset = binary + view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
        translations = struct.unpack(f"<{accessor['count'] * 3}f", data[offset : offset + accessor["count"] * 12])
        items = node["extras"]["instanceItems"]
        for k in range(0, len(items), 4):
            instance, start = items[k], items[k + 1]
            point = translations[instance * 3 : instance * 3 + 3]
            feet.setdefault(start, set()).add(tuple(round(c, 3) for c in point))
    return feet


def main():
    os.makedirs(OUT, exist_ok=True)
    feet = feet_of_elements()
    table = {}
    total = 0
    for n in range(1, 61):
        before = Image.open(os.path.join(BASE, f"h{n - 1:02d}-f0.webp")).convert("RGBA")
        after = Image.open(os.path.join(BASE, f"h{n:02d}-f0.webp")).convert("RGBA")
        diff = ImageChops.difference(before, after)
        r, g, b, a = diff.split()
        summed = ImageChops.add(ImageChops.add(r, g), ImageChops.add(b, a))
        mask = summed.point(lambda value: 255 if value > THRESHOLD else 0)
        # Close the small holes, drop the specks, then soften the edge by a pixel.
        mask = mask.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
        mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
        mask = mask.filter(ImageFilter.GaussianBlur(0.8))
        box = mask.getbbox()
        if box is None:
            continue
        alpha = ImageChops.multiply(after.getchannel("A"), mask)
        sprite = after.copy()
        sprite.putalpha(alpha)
        sprite = sprite.crop(box)
        name = f"e{n:02d}"
        path = os.path.join(OUT, f"{name}.webp")
        sprite.save(path, "WEBP", quality=QUALITY, method=6)
        total += os.path.getsize(path)
        points = sorted(feet.get(n, []))
        if points:
            # The plants of the element: their feet, averaged; the lowest of them on screen.
            projected = [project(p) for p in points]
            foot = (sum(u for u, _ in projected) / len(projected), max(v for _, v in projected))
        else:
            # Something built: it rises from the middle of what it adds (the channels from the basin).
            foot = ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2)
        table[n] = {
            "name": name,
            "x": box[0],
            "y": box[1],
            "width": box[2] - box[0],
            "height": box[3] - box[1],
            "footX": round(foot[0], 1),
            "footY": round(foot[1], 1),
        }
    lines = [
        "/* generated by tools/garden-pictures/growth-sprites.py: do not edit by hand. */",
        "/**",
        " * The element of each hizb alone, cut from the garden pictures (what hNN-f0 adds to the picture",
        " * of the hizb before), where it sits in the picture, in pixels, and its foot: the point it grows",
        " * from in the picture fallback.",
        " */",
        "",
        "export interface GardenSprite {",
        "  readonly asset: number;",
        "  readonly x: number;",
        "  readonly y: number;",
        "  readonly width: number;",
        "  readonly height: number;",
        "  readonly footX: number;",
        "  readonly footY: number;",
        "}",
        "",
        "/** By element (hizb), 1 to 60. */",
        "export const GARDEN_SPRITES: Readonly<Record<number, GardenSprite>> = {",
    ]
    for n, entry in table.items():
        lines.append(
            f"  {n}: {{ asset: require('../../../assets/images/garden/level-1/grow/{entry['name']}.webp'), "
            f"x: {entry['x']}, y: {entry['y']}, width: {entry['width']}, height: {entry['height']}, "
            f"footX: {entry['footX']}, footY: {entry['footY']} }},"
        )
    lines.append("};")
    open(TABLE, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print(f"{len(table)} sprites, {total} bytes")


if __name__ == "__main__":
    main()
