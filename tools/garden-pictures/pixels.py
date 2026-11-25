"""
Pixel work for the garden pictures: the only part of the tool that decodes an image. The rules
(which box to cut, how much margin) are in lib.mjs, in plain JavaScript, where they are tested;
this script reads the alpha channel and cuts, nothing else. Needs Pillow (a build-time tool of the
developer's machine, not an app dependency).

  python3 -I pixels.py bounds <folder with base/ and water/>
      prints {"size": [w, h], "files": {"base/h00-f0.webp": [left, top, right, bottom] | null}}
      the box of the pixels that are not fully transparent, per file.
  python3 -I pixels.py crop <source> <destination> <left> <top> <right> <bottom> [quality]
      writes every picture of <source> cut to the box, same names, same folders.
"""

import json
import os
import sys
from concurrent.futures import ProcessPoolExecutor

from PIL import Image

KINDS = ("base", "water")
# The renders are lossy (quality 80): a little more here keeps the second encoding hardly visible.
DEFAULT_QUALITY = 84


def pictures(root):
    for kind in KINDS:
        folder = os.path.join(root, kind)
        if not os.path.isdir(folder):
            continue
        for name in sorted(os.listdir(folder)):
            if name.endswith(".webp"):
                yield f"{kind}/{name}"


def bounds(root):
    size = None
    files = {}
    for relative in pictures(root):
        with Image.open(os.path.join(root, relative)) as image:
            if size is None:
                size = image.size
            elif image.size != size:
                raise SystemExit(f"{relative}: {image.size[0]}x{image.size[1]}, others are {size[0]}x{size[1]}")
            box = image.convert("RGBA").getchannel("A").getbbox()
            files[relative] = list(box) if box else None
    print(json.dumps({"size": list(size) if size else None, "files": files}))


def crop_one(job):
    source, destination, relative, box, quality = job
    left, top, right, bottom = box
    with Image.open(os.path.join(source, relative)) as image:
        width, height = image.size
        if not (0 <= left < right <= width and 0 <= top < bottom <= height):
            raise SystemExit(f"{relative}: the box {box} is outside the {width}x{height} picture")
        cut = image.convert("RGBA").crop(box)
    target = os.path.join(destination, relative)
    os.makedirs(os.path.dirname(target), exist_ok=True)
    # Method 4: a little larger than the slowest method, many times faster over 724 pictures.
    cut.save(target, "WEBP", quality=quality, method=4)


def crop(source, destination, box, quality):
    jobs = [(source, destination, relative, box, quality) for relative in pictures(source)]
    with ProcessPoolExecutor() as pool:
        for _ in pool.map(crop_one, jobs, chunksize=8):
            pass


if __name__ == "__main__":
    args = sys.argv[1:]
    if len(args) == 2 and args[0] == "bounds":
        bounds(args[1])
    elif len(args) in (7, 8) and args[0] == "crop":
        crop(args[1], args[2], tuple(int(v) for v in args[3:7]), int(args[7]) if len(args) == 8 else DEFAULT_QUALITY)
    else:
        raise SystemExit(__doc__)
