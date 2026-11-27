"""Where the ink of a piece of text really is inside its container, measured on a picture.

The layout box of a line of text says nothing about where its glyphs are drawn: an Arabic font
keeps a tall ascent and a deep descent for its marks, so a title "centred" by its box can sit
visibly low or high. This module looks at the pixels.

    box = (left, top, right, bottom) of the container, in pixels of the picture
    ink = ink_box(image, box)         # the pixels that differ from the container's background
    off = centring(box, ink)          # how far the ink's middle is from the container's middle

`python3 tools/design-qa/ink.py picture.png left top right bottom [--inset N] [--scale S]`
prints the measure. Coordinates are in pixels of the picture; `--scale` (2 for a 2x capture)
only converts the answer to points.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass

from PIL import Image, ImageChops, ImageDraw

Box = tuple[int, int, int, int]


@dataclass(frozen=True)
class Centring:
    """Distances in pixels. `dx` > 0: the ink is right of the middle; `dy` > 0: it is low."""

    dx: float
    dy: float
    left: int
    top: int
    right: int
    bottom: int

    @property
    def overflows(self) -> bool:
        return min(self.left, self.top, self.right, self.bottom) < 0


def background_of(image: Image.Image, box: Box) -> tuple[int, int, int]:
    """The most frequent colour of the box: its background, as long as text is the smaller part."""
    crop = image.convert("RGB").crop(box)
    colours = crop.getcolors(crop.width * crop.height) or []
    return max(colours)[1] if colours else (0, 0, 0)


def ink_box(
    image: Image.Image,
    box: Box,
    *,
    background: tuple[int, int, int] | None = None,
    threshold: int = 48,
    search: Box | None = None,
) -> Box | None:
    """The bounding box of the pixels of `search` (default: `box`) far enough from the background.

    `threshold` is the smallest difference, on the strongest channel, that counts as ink: high
    enough to ignore the soft edge of a shadow or of a gradient, low enough to keep the thin
    strokes of a vowel mark. Pass a larger `search` than `box` to see ink that leaves the box.
    """
    rgb = image.convert("RGB")
    area = search or box
    crop = rgb.crop(area)
    back = background or background_of(rgb, box)
    difference = ImageChops.difference(crop, Image.new("RGB", crop.size, back))
    strongest = difference.convert("L").point(lambda _: 0)
    for channel in difference.split():
        strongest = ImageChops.lighter(strongest, channel)
    found = strongest.point(lambda value: 255 if value >= threshold else 0).getbbox()
    if found is None:
        return None
    return (area[0] + found[0], area[1] + found[1], area[0] + found[2], area[1] + found[3])


def difference_box(shown: Image.Image, hidden: Image.Image, threshold: int = 24) -> Box | None:
    """The ink of one element: what changes between a capture with it and a capture without it."""
    difference = ImageChops.difference(shown.convert("RGB"), hidden.convert("RGB"))
    strongest = difference.convert("L").point(lambda _: 0)
    for channel in difference.split():
        strongest = ImageChops.lighter(strongest, channel)
    return strongest.point(lambda value: 255 if value >= threshold else 0).getbbox()


def container_at(image: Image.Image, point: tuple[int, int], tolerance: int = 10) -> Box:
    """The box of the flat area a point of a photo is in: the pill or button around a label.

    For a photo of a real screen, where nothing says where a button starts: the area of the colour
    found most often around the point is filled outward until the colour changes.
    """
    rgb = image.convert("RGB")
    x, y = point
    around = rgb.crop((x - 20, y - 6, x + 21, y + 7))
    colour = max(around.getcolors(around.width * around.height))[1]
    seed = min(
        ((sx, sy) for sx in range(x - 20, x + 21) for sy in range(y - 6, y + 7) if rgb.getpixel((sx, sy)) == colour),
        key=lambda p: abs(p[0] - x) + abs(p[1] - y),
    )
    marker = (255, 0, 255) if colour != (255, 0, 255) else (0, 255, 0)
    filled = rgb.copy()
    ImageDraw.floodfill(filled, seed, marker, thresh=tolerance)
    mask = ImageChops.difference(filled, rgb).convert("L").point(lambda value: 255 if value else 0)
    return mask.getbbox()


def band_of_label(image: Image.Image, box: Box, threshold: int = 48) -> tuple[Box, int] | None:
    """The ink of a label inside `box`, and its baseline: the row most letters stand on.

    The baseline is the bottom most columns of ink end on; a "p" or a "g" goes lower, but only in
    a few columns. The band the eye centres is then from the top of the ink to that baseline.
    The search leaves out the rounded ends of the box, where the outside shows.
    """
    height = box[3] - box[1]
    inner = (box[0] + height // 2, box[1] + 2, box[2] - height // 2, box[3] - 2)
    if inner[2] <= inner[0]:
        return None
    found = ink_box(image, box, search=inner, threshold=threshold)
    if found is None:
        return None
    rgb = image.convert("RGB")
    back = background_of(rgb, box)
    bottoms: dict[int, int] = {}
    for x in range(found[0], found[2]):
        for y in range(found[3] - 1, found[1] - 1, -1):
            if max(abs(a - b) for a, b in zip(rgb.getpixel((x, y)), back)) >= threshold:
                bottoms[y + 1] = bottoms.get(y + 1, 0) + 1
                break
    baseline = max(bottoms, key=lambda row: (bottoms[row] + bottoms.get(row - 1, 0) + bottoms.get(row + 1, 0), row))
    return found, baseline


def centring(box: Box, ink: Box) -> Centring:
    """The four margins of the ink inside the box, and the offset of its middle."""
    left, top = ink[0] - box[0], ink[1] - box[1]
    right, bottom = box[2] - ink[2], box[3] - ink[3]
    return Centring((left - right) / 2, (top - bottom) / 2, left, top, right, bottom)


def describe(measure: Centring, scale: float = 1) -> str:
    def points(value: float) -> str:
        return f"{value / scale:+.1f}".replace("+-", "-")

    vertical = "bas" if measure.dy > 0 else "haut"
    horizontal = "droite" if measure.dx > 0 else "gauche"
    text = (
        f"marges haut {measure.top / scale:.1f} / bas {measure.bottom / scale:.1f}, "
        f"gauche {measure.left / scale:.1f} / droite {measure.right / scale:.1f} ; "
        f"décalage vertical {points(measure.dy)} pt ({vertical}), "
        f"horizontal {points(measure.dx)} pt ({horizontal})"
    )
    return text + (" ; DÉBORDE" if measure.overflows else "")


def main(argv: list[str]) -> int:
    if len(argv) < 5:
        print(__doc__)
        return 2
    image = Image.open(argv[0])
    box: Box = (int(argv[1]), int(argv[2]), int(argv[3]), int(argv[4]))
    inset = int(argv[argv.index("--inset") + 1]) if "--inset" in argv else 0
    scale = float(argv[argv.index("--scale") + 1]) if "--scale" in argv else 1
    inner = (box[0] + inset, box[1] + inset, box[2] - inset, box[3] - inset)
    ink = ink_box(image, inner)
    if ink is None:
        print("aucune encre trouvée")
        return 1
    print(f"encre {ink} dans {inner} : {describe(centring(inner, ink), scale)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
