"""Writes the gardens of levels 2 to 7 (docs/DECISIONS.md D23, D46): for each level,
tools/garden-3d/source/level-N/layout.json and pack.json, which bake.py turns into
assets/models/garden/level-N/garden.glb.

    python3 -I tools/garden-3d/levels/make_levels.py

Every garden has the 60 steps of the garden catalogue (src/domain/garden/catalog.ts), in the
same order and with the same ids and kinds, so that what the app says of a step ("Les canaux",
"Un grenadier") stays true of the garden on screen: water first, then the paths and the ground,
the plants, and the landmarks at the end. What a step looks like is the style's own: the
"channels" of the oasis are its spring and pool, those of the orchard its river. Birds and
butterflies have no model in the packs (as in level 1): those four steps show nothing.

Models: Quaternius "Ultimate Stylized Nature" (plants, rocks) and Kenney kits (everything built),
both CC0, the mix the owner chose (D22). Plain shapes (ground, paths, water) are the tool's own,
as in level 1. Axes: x east, z south, y up, metres; the camera looks from the south-east, so
(-9, -9) is the top of the picture and (9, 9) its bottom. `uv(u, v)`: u across the picture, left
to right, v toward the viewer.
"""
import json
import math
import os

TOOL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(TOOL, "source")
S2 = math.sqrt(2)

# ------------------------------------------------------------------------------ the catalogue
# src/domain/garden/catalog.ts, the reference variant: the test of the levels checks they agree.
ELEMENTS_BY_HIZB = {
    1: ("channels", "channels"), 2: ("paving", "paving"), 3: ("bed-1", "bed"), 4: ("bed-2", "bed"),
    6: ("bed-3", "bed"), 8: ("bed-4", "bed"), 10: ("stepping-stones", "stepping-stones"),
    12: ("flowers-1", "flowers"), 15: ("flowers-2", "flowers"), 18: ("flowers-3", "flowers"),
    20: ("fountain", "fountain"), 22: ("flowers-4", "flowers"), 24: ("springs", "springs"),
    27: ("birds-1", "birds"), 30: ("wall-north", "wall"), 31: ("wall-west", "wall"),
    34: ("trellis", "trellis"), 37: ("birds-2", "birds"), 40: ("gate-north", "gate"),
    41: ("gate-west", "gate"), 44: ("lanterns", "lanterns"), 47: ("butterflies", "butterflies"),
    50: ("pavilion", "pavilion"), 52: ("carpets", "carpets"), 54: ("cushions", "cushions"),
    56: ("lectern", "lectern"), 57: ("birds-3", "birds"), 58: ("roses", "roses"),
    59: ("waterfall", "waterfall"), 60: ("full-bloom", "full-bloom"),
}
SPECIES = ["pomegranate", "date-palm", "olive", "fig", "cypress", "orange"]
NO_MODEL = {"birds", "butterflies"}


def catalogue():
    out, trees = [], 0
    for hizb in range(1, 61):
        if hizb in ELEMENTS_BY_HIZB:
            el_id, kind = ELEMENTS_BY_HIZB[hizb]
        else:
            trees += 1
            el_id, kind = f"tree-{trees}", SPECIES[(trees - 1) % 6]
        out.append({"hizb": hizb, "id": el_id, "kind": kind})
    return out


# ---------------------------------------------------------------------------------- models
QS = "packs/quaternius-stylized-nature/ultimate-stylized-nature/sources/"
TEX = "/tool/cache/quaternius-stylized/"
KN = "packs/kenney-shorepine/3d/"


def leaf(name, **kw):
    return {"map": TEX + name + ".png", "source": QS + "Textures/" + name + ".png",
            "alphaTest": 0.5, "doubleSided": True, **kw}


def solid(name, **kw):
    return {"map": TEX + name + ".png", "source": QS + "Textures/" + name + ".png", **kw}


def qs_materials(**over):
    base = {
        "BirchTree_Bark": solid("BirchTree_Bark"), "BirchTree_Leaves": leaf("BirchTree_Leaves"),
        "Bush_Leaves": leaf("Bush_Leaves"), "Flowers": leaf("Flowers"),
        "Grass": solid("Grass", doubleSided=True),
        "MapleTree_Bark": solid("MapleTree_Bark"), "MapleTree_Leaves": leaf("MapleTree_Leaves"),
        "NormalTree_Bark": solid("NormalTree_Bark"), "NormalTree_Leaves": leaf("NormalTree_Leaves"),
        "PalmTree_Trunk": solid("PalmTree_Trunk"), "PalmTree_Leaves": leaf("PalmTree_Leaves"),
        "PineTree_Bark": solid("PineTree_Bark"),
        "PineTree_Leaves": leaf("PineTree_Leaves", color="#6a8e4b"),
        "Rock": solid("Rocks"),
    }
    base.update(over)
    return {"upAxis": "z", "materials": base}


GLOW = "#ffc46b"  # the warm light of the night garden's lanterns
CONFIGS = {
    "qs": qs_materials(),
    "qs-dark": qs_materials(NormalTree_Leaves=leaf("NormalTree_Leaves_Dark")),
    "qs-desert": qs_materials(Rock=solid("Rocks_Desert")),
    # Birch leaves in summer green: the pack's greyscale leaves, tinted.
    "qs-birch": qs_materials(BirchTree_Leaves=leaf("Leaves_BW", color="#9cc25a")),
    # Blossom: the pack has no cherry tree; its greyscale leaves (Leaves_BW, MapleTree_Leaves_BW)
    # are tinted pink or white, the tree models are unchanged.
    "qs-pink": qs_materials(NormalTree_Leaves=leaf("Leaves_BW", color="#f4a6c3"),
                            MapleTree_Leaves=leaf("MapleTree_Leaves_BW", color="#f7b3cc")),
    "qs-pale": qs_materials(NormalTree_Leaves=leaf("Leaves_BW", color="#fbd3e1"),
                            MapleTree_Leaves=leaf("MapleTree_Leaves_BW", color="#fcd9e5")),
    "qs-white": qs_materials(NormalTree_Leaves=leaf("Leaves_BW", color="#fbf4f6"),
                             MapleTree_Leaves=leaf("MapleTree_Leaves_BW", color="#fbf4f6")),
    "qs-pine-dark": qs_materials(PineTree_Leaves=leaf("PineTree_Leaves", color="#4f7246")),
    # The night garden: white blossom and night flowers that glow faintly under the moon.
    "qs-moon": qs_materials(
        NormalTree_Leaves=leaf("Leaves_BW", color="#f6f3ff", emissive="#6c6a80",
                               emissiveIntensity=1, emissiveMap=True),
        Flowers=leaf("Flowers", emissive="#fff1c8", emissiveIntensity=0.7, emissiveMap=True),
        Bush_Leaves=leaf("Bush_Leaves"),
        PineTree_Leaves=leaf("PineTree_Leaves", color="#56744c")),
    # Kenney's nature kit in each garden's stone and wood (its own colours are pastel).
    "kn-sand": {"materials": {"stone": {"color": "#e2cfa8"}, "stoneDark": {"color": "#c9b088"},
                              "wood": {"color": "#c58f5f"}, "woodDark": {"color": "#9c6b45"},
                              "woodBark": {"color": "#8f6444"}, "colorRed": {"color": "#efe3c6"},
                              "_defaultMat": {"color": "#e9dcc0"}}},
    "kn-warm": {"materials": {"stone": {"color": "#d3c8b5"}, "stoneDark": {"color": "#b4a893"},
                              "wood": {"color": "#b98458"}, "woodDark": {"color": "#8e5f3d"},
                              "woodBark": {"color": "#87603f"}, "grass": {"color": "#8fb35c"},
                              "leafsGreen": {"color": "#5f9b45"}, "leafsDark": {"color": "#4a7f3d"},
                              "colorRed": {"color": "#d9534f"}, "_defaultMat": {"color": "#f1ece2"}}},
    "kn-grey": {"materials": {"stone": {"color": "#c2bfb8"}, "stoneDark": {"color": "#9d9a93"},
                              "wood": {"color": "#a8774f"}, "woodDark": {"color": "#7d5537"},
                              "woodBark": {"color": "#73513a"}, "grass": {"color": "#8eaa5c"},
                              "leafsGreen": {"color": "#5e8f46"}, "leafsDark": {"color": "#4a7a3e"},
                              "colorRed": {"color": "#c9483f"}, "_defaultMat": {"color": "#efe8dc"}}},
    "kn-lacquer": {"materials": {"wood": {"color": "#c0443b"}, "woodDark": {"color": "#93312b"},
                                 "woodBark": {"color": "#7a2e28"}, "stone": {"color": "#c9c6bf"},
                                 "stoneDark": {"color": "#a5a29b"}}},
    "kn-forest": {"materials": {"stone": {"color": "#b9b6ad"}, "stoneDark": {"color": "#94918a"},
                                "wood": {"color": "#9a6b45"}, "woodDark": {"color": "#71492f"},
                                "woodBark": {"color": "#6b4a33"}, "colorRed": {"color": "#c84b3e"},
                                "leafsGreen": {"color": "#5d8c45"}, "_defaultMat": {"color": "#efe7d6"},
                                "grass": {"color": "#7f9f55"}}},
    "kn-canvas": {"materials": {"colorRed": {"color": "#7e9463"}, "wood": {"color": "#9a6b45"}}},
    "kn-night": {"materials": {"stone": {"color": "#d8d3e0"}, "stoneDark": {"color": "#b3adc0"},
                               "wood": {"color": "#8a6650"}, "woodDark": {"color": "#664a3a"},
                               "leafsGreen": {"color": "#4f7d4c"}, "leafsDark": {"color": "#3f6a42"},
                               "colorRed": {"color": "#f3efe6"}}},
    # Kenney's colour-mapped kits, recoloured to one tone where a kit's colours do not fit.
    "stone-lantern": {"materials": {"colormap": {"color": "#b9b4aa", "flat": True}}},
    "dark-hedge": {"materials": {"colormap": {"color": "#8aa890"}}},
    "slate-roof": {"materials": {"colormap": {"color": "#5d6470", "flat": True}}},
    "ochre": {"materials": {"colormap": {"color": "#fbe3c6"}}},
    "lamp-glow": {"materials": {"colormap": {"emissive": GLOW, "emissiveIntensity": 1.7,
                                             "emissiveMap": True}}},
    "night-roof": {"materials": {"colormap": {"color": "#3f4a6b", "flat": True}}},
    "night-hedge": {"materials": {"colormap": {"color": "#6f8f78"}}},
    "flat-lacquer": {"materials": {"colormap": {"color": "#b1473d", "flat": True}}},
    "flat-wood": {"materials": {"colormap": {"color": "#8f6a4a", "flat": True}}},
    "flat-night": {"materials": {"colormap": {"color": "#6a6380", "flat": True}}},
}


def q(name, cfg="qs", **kw):
    return {"file": QS + "FBX/" + name + ".fbx", "cfg": cfg, **kw}


def kn(path, cfg=None, **kw):
    entry = {"file": KN + path + ".glb", **kw}
    if cfg:
        entry["cfg"] = cfg
    return entry


FLOWERS = [q("Flower_3_Clump"), q("Flower_4_Clump"), q("Flower_2_Clump"), q("Flower_5_Clump"),
           q("Flower_1_Clump")]
GRASS = [q("Grass_Large"), q("Grass_Small"), q("Grass_Large_Extruded")]
LILY = [kn("nature/lily_large", "kn-warm"), kn("nature/lily_small", "kn-warm")]
GAZEBO = lambda pillar, roof_cfg, roof_scale=1.3: {"parts": (  # noqa: E731
    [kn(f"fantasy-town/{pillar}", pos=[dx, 0, dz]) for dx in (-0.5, 0.5) for dz in (-0.5, 0.5)]
    + [kn("fantasy-town/roof-high-point", roof_cfg, pos=[0, 1.0, 0], scale=roof_scale)])}
LECTERN = {"parts": [kn("furniture/sideTable"), kn("furniture/books", pos=[0, 0.384, 0], yaw=20)]}


# ------------------------------------------------------------------------------- geometry
def rot(x, z, deg):
    a = math.radians(deg)
    return (x * math.cos(a) + z * math.sin(a), -x * math.sin(a) + z * math.cos(a))


def uv(u, v, origin=(0.0, 0.0)):
    return (origin[0] + (u + v) / S2, origin[1] + (-u + v) / S2)


def ellipse(cx, cz, rx, rz, deg=0, n=48):
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        dx, dz = rot(rx * math.cos(t), rz * math.sin(t), deg)
        pts.append([round(cx + dx, 3), round(cz + dz, 3)])
    return pts


def in_ellipse(x, z, cx, cz, rx, rz, deg=0, grow=0.0):
    dx, dz = rot(x - cx, z - cz, -deg)
    return (dx / (rx + grow)) ** 2 + (dz / (rz + grow)) ** 2 <= 1


def on_ellipse(t_deg, cx, cz, rx, rz, deg=0):
    t = math.radians(t_deg)
    dx, dz = rot(rx * math.cos(t), rz * math.sin(t), deg)
    return (cx + dx, cz + dz)


def smooth(points, per=10):
    """Catmull-Rom through the control points."""
    pts = [points[0]] + list(points) + [points[-1]]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        for k in range(per):
            t = k / per
            out.append(tuple(
                0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t
                       + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t ** 3) for j in (0, 1)))
    out.append(tuple(points[-1]))
    return out


def band(line, width):
    left, right = [], []
    for i, (x, z) in enumerate(line):
        ax, az = line[max(i - 1, 0)]
        bx, bz = line[min(i + 1, len(line) - 1)]
        dx, dz = bx - ax, bz - az
        n = math.hypot(dx, dz) or 1
        nx, nz = -dz / n, dx / n
        left.append([round(x + nx * width / 2, 3), round(z + nz * width / 2, 3)])
        right.append([round(x - nx * width / 2, 3), round(z - nz * width / 2, 3)])
    return left + right[::-1]


def clip_half(poly, a, b, c):
    """The part of `poly` where a*x + b*z + c <= 0 (Sutherland-Hodgman, one plane)."""
    f = lambda p: a * p[0] + b * p[1] + c  # noqa: E731
    out = []
    for i, cur in enumerate(poly):
        prev = poly[i - 1]
        fc, fp = f(cur), f(prev)
        if fc <= 0:
            if fp > 0:
                t = fp / (fp - fc)
                out.append([prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])])
            out.append(list(cur))
        elif fp <= 0:
            t = fp / (fp - fc)
            out.append([prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])])
    return [[round(x, 3), round(z, 3)] for x, z in out]


def clip_square(poly, h):
    for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        poly = clip_half(poly, a, b, -h)
    return poly


def clip_disc(poly, r, n=48):
    """Clipped to the regular polygon inscribed... circumscribing a disc of radius r."""
    for i in range(n):
        t = 2 * math.pi * i / n
        poly = clip_half(poly, math.cos(t), math.sin(t), -r)
    return poly


def dist_to_line(x, z, line):
    best = 1e9
    for (ax, az), (bx, bz) in zip(line, line[1:]):
        dx, dz = bx - ax, bz - az
        L = dx * dx + dz * dz or 1e-9
        t = max(0, min(1, ((x - ax) * dx + (z - az) * dz) / L))
        best = min(best, math.hypot(x - ax - t * dx, z - az - t * dz))
    return best


def lcg(seed):
    state = seed
    while True:
        state = (state * 1103515245 + 12345) % (2 ** 31)
        yield state / (2 ** 31)


# The camera of every picture (src/features/garden/garden3d/config.ts): how high a point is in the
# frame, in metres from the point looked at. The frame's top is 8.33 m (the cut of the pictures).
CAM_UP = (-math.sin(math.radians(38)) * math.sin(math.radians(45)), math.cos(math.radians(38)),
          -math.sin(math.radians(38)) * math.cos(math.radians(45)))
FRAME_TOP = 8.1


def screen_height(x, y, z):
    return (x * CAM_UP[0]) + (y - 1.5) * CAM_UP[1] + z * CAM_UP[2]


# --------------------------------------------------------------------------------- garden
class Garden:
    def __init__(self, level, slug, name, idea, plot, roles, colors=None, light=None, spread=1.0):
        self.spread = spread
        self.level, self.slug, self.name, self.idea = level, slug, name, idea
        self.plot, self.roles, self.colors, self.light = plot, roles, colors or {}, light
        self.catalogue = catalogue()
        self.labels = {}
        self.items, self.neutral = [], []
        self._n = 0

    def label(self, el_id, text):
        assert any(e["id"] == el_id for e in self.catalogue), el_id
        self.labels[el_id] = text

    def shape(self, element, kind, **kw):
        self.neutral.append({"element": element, "kind": kind, **kw})

    def put(self, element, role, x, z, size, y=0.0, yaw=None, variant=None, **extra):
        self._n += 1
        item = {"element": element, "role": role, "x": round(x, 3), "z": round(z, 3), "y": round(y, 3),
                "yaw": round((self._n * 137.5) % 360, 1) if yaw is None else yaw,
                "variant": self._n if variant is None else variant, "size": size}
        item.update(extra)
        self.items.append(item)

    def line(self, element, role, a, b, size, y=0.0, gap=None):
        item = {"element": element, "role": role, "size": size, "y": y,
                "line": {"from": list(a), "to": list(b)}}
        if gap:
            item["gap"] = gap
        self.items.append(item)

    def _spread(self):
        """Every place multiplied by `spread` (sizes unchanged): a plot drawn small, made larger."""
        k = self.spread
        if k == 1.0:
            return
        r3 = lambda v: round(v * k, 3)  # noqa: E731
        for item in self.items:
            if "line" in item:
                item["line"] = {key: [r3(a) for a in pt] for key, pt in item["line"].items()}
                if "gap" in item:
                    item["gap"]["at"] = [r3(a) for a in item["gap"]["at"]]
            else:
                item["x"], item["z"] = r3(item["x"]), r3(item["z"])
        for shape in self.neutral:
            if "at" in shape:
                shape["at"] = [r3(shape["at"][0]), shape["at"][1], r3(shape["at"][2])]
            if "points" in shape:
                shape["points"] = [[r3(x), r3(z)] for x, z in shape["points"]]
            if shape["kind"] == "mound":
                shape["r"] = [r3(shape["r"][0]), shape["r"][1], r3(shape["r"][2])]

    def write(self):
        self._spread()
        ids = [e["id"] for e in self.catalogue]
        used = {i["element"] for i in self.items if i["element"]} | {p["element"] for p in self.neutral if p["element"]}
        assert used <= set(ids), used - set(ids)
        missing = {e["id"] for e in self.catalogue if e["kind"] not in NO_MODEL} - used
        assert not missing, (self.slug, missing)
        half = self.plot["half"] - 0.3
        for item in self.items:
            assert self.roles.get(item["role"]), (self.slug, item["role"])
            if "x" in item:
                reach = math.hypot(item["x"], item["z"]) if self.plot["shape"] == "round" else max(abs(item["x"]), abs(item["z"]))
                assert reach <= half, (self.slug, item["element"], item["x"], item["z"])
            if "line" in item or not item["element"]:
                continue
            size = item["size"]
            top = item["y"] + size.get("h", size.get("hmax", size.get("w", 1) * 0.5))
            reach = size.get("wmax", size.get("w", 0.6)) / 2 * 0.7
            if screen_height(item["x"] - reach, top, item["z"] - reach) > FRAME_TOP:
                print(f"  warning {self.slug}: {item['element']} ({item['role']}) at {item['x']},{item['z']}"
                      f" reaches above the frame")
        for el in self.catalogue:
            el["label"] = self.labels.get(el["id"], "")
        unlabelled = [e["id"] for e in self.catalogue if not e["label"]]
        assert not unlabelled, (self.slug, unlabelled)
        folder = os.path.join(OUT, f"level-{self.level}")
        os.makedirs(folder, exist_ok=True)
        layout = {"about": f"Level {self.level} garden '{self.name}' (tools/garden-3d/levels/make_levels.py). "
                           "Metres; x east, z south, y up.",
                  "version": 2, "level": self.level, "style": self.slug, "name": self.name,
                  "idea": self.idea, "plot": self.plot, "colors": self.colors,
                  **({"light": self.light} if self.light else {}),
                  "catalogue": self.catalogue, "neutral": self.neutral, "items": self.items}
        with open(os.path.join(folder, "layout.json"), "w", encoding="utf-8") as f:
            json.dump(layout, f, indent=1, ensure_ascii=True)
            f.write("\n")
        used_cfgs = set()
        for entries in self.roles.values():
            for e in entries:
                for part in e.get("parts", [e]):
                    used_cfgs.add(part.get("cfg", e.get("cfg")))
        pack = {"id": self.slug, "title": self.name,
                "configs": {k: v for k, v in CONFIGS.items() if k in used_cfgs}, "roles": self.roles}
        with open(os.path.join(folder, "pack.json"), "w", encoding="utf-8") as f:
            json.dump(pack, f, indent=1)
            f.write("\n")
        print(f"level {self.level} {self.slug}: {len(self.items)} items, {len(self.neutral)} shapes")


def glow(g, element, x, y, z, r):
    """The light a lantern throws on the ground at night: three discs, fainter outward."""
    for k, share in enumerate((1.0, 0.68, 0.38)):
        g.shape(element, "glow", at=[x, y + 0.002 * k, z], r=round(r * share, 3), color="#ffc979", opacity=0.2,
                emissive="#ffb04a", emissiveIntensity=1.2, segments=32)


def trees_by_slot(g):
    """The catalogue's trees, in order, with their species: (element id, species)."""
    return [(e["id"], e["kind"]) for e in g.catalogue if e["id"].startswith("tree-")]


IN = 8.68  # inner edge of a square plot's border


# =============================================================================================
# Level 2. Oasis: a round plot of sand, dunes behind, a spring that feeds a pool, palms.
# =============================================================================================
def oasis():
    SAND, SAND_SIDE, DUNE = "#e6cd9a", "#c9a46c", "#e9d09e"
    BANK, PATH, GREEN, GREEN_DRY = "#d6bf92", "#efe3c8", "#a9c06f", "#d9c38d"
    roles = {
        "tree.palm": [q("PalmTree_1"), q("PalmTree_3"), q("PalmTree_2"), q("PalmTree_1", yaw=120)],
        "tree.palm-young": [q("PalmTree_4"), q("PalmTree_5")],
        "tree.fruit": [q("NormalTree_5", scale=1.15), q("NormalTree_3", scale=1.15)],
        "tree.fruit-dark": [q("NormalTree_4", "qs-dark", scale=1.15), q("NormalTree_1", "qs-dark", scale=1.2)],
        "rock": [q("Rock_2", "qs-desert"), q("Rock_1", "qs-desert"), q("Rock_5", "qs-desert"), q("Rock_3", "qs-desert")],
        "rock-tall": [q("Rock_4", "qs-desert")],
        "sandstone": [kn("pirate/rocks-sand-a"), kn("pirate/rocks-sand-b"), kn("pirate/rocks-sand-c")],
        "reeds": GRASS, "plant": [q("Plant_1"), q("Plant_2")],
        "flowers": [q("Flower_2_Clump"), q("Flower_4_Clump"), q("Plant_Flowers"), q("Flower_5_Clump")],
        "roses": [q("Bush_Flowers"), q("Bush_Small_Flowers"), q("Bush_Large_Flowers")],
        "bush": [q("Bush_Small"), q("Bush")],
        "stepping-stones": [kn("nature/path_stone", "kn-sand"), kn("nature/path_stoneCircle", "kn-sand")],
        "fountain": [kn("fantasy-town/fountain-round", "ochre")],
        "wall": [kn("castle/wall-narrow", "ochre", lengthAxis="z")],
        "gate": [kn("castle/tower-square-arch", "ochre")],
        "canopy": [kn("survival/structure-canvas")],
        "lantern": [kn("holiday/lantern")],
        "pavilion": [kn("nature/tent_detailedOpen", "kn-sand")],
        "carpet": [kn("furniture/rugRectangle")],
        "cushion": [kn("furniture/pillow"), kn("furniture/pillowBlue"), kn("furniture/pillowLong")],
        "lectern": [LECTERN],
        "lily": LILY,
        "pot": [kn("nature/pot_large", "kn-sand"), kn("nature/pot_small", "kn-sand")],
    }
    g = Garden(
        2, "oasis", "Oasis",
        "Un disque de sable adossé à des dunes. Une source sort au pied de la grande dune, un ruisseau "
        "rejoint le bassin, et la vie s'installe autour : palmiers-dattiers, vergers à leur ombre, "
        "roseaux, puis un campement sous une paillote.",
        {"shape": "round", "half": 10.6, "slab": 0.7, "top": SAND, "topDry": "#d9c7a6", "side": SAND_SIDE,
         "border": None},
        roles, colors={"water": "#5fc0cc", "waterLow": "#86b9b5", "dryBed": "#d2bd98", "lawnDry": GREEN_DRY},
        spread=1.13)
    R = 9.3
    dunes = [(-4.4, -4.4, 3.4, 1.15, 2.1, 45), (-6.9, -0.9, 1.9, 0.7, 1.3, 80), (-0.9, -6.9, 1.9, 0.7, 1.3, 10),
             (5.6, -5.4, 1.5, 0.45, 1.0, 135), (-5.6, 5.2, 1.4, 0.4, 1.0, 45)]
    for (x, z, rx, ry, rz, deg) in dunes:
        g.shape(None, "mound", at=[x, 0, z], r=[rx, ry, rz], yaw=deg, color=DUNE, textured=True, cast=True)

    def ground(x, z):
        h = 0.0
        for (cx, cz, rx, ry, rz, deg) in dunes:
            dx, dz = rot(x - cx, z - cz, -deg)
            k = 1 - (dx / rx) ** 2 - (dz / rz) ** 2
            if k > 0:
                h = max(h, ry * math.sqrt(k))
        return h

    C = (1.1, 1.1)
    POOL = (C[0], C[1], 3.7, 2.4, 45)
    SRC = (-2.6, -2.6)
    rill = smooth([SRC, (-2.1, -1.7), (-1.2, -1.2), (-0.6, -0.4)], 6)
    ring = lambda t, ru, rv: on_ellipse(t, C[0], C[1], ru, rv, 45)  # noqa: E731

    # 1 the water
    g.label("channels", "La source, son ruisseau et le bassin de l'oasis")
    g.shape("channels", "poly", points=ellipse(C[0], C[1], 4.05, 2.75, 45), y=0, h=0.05, color=BANK)
    g.shape("channels", "poly", points=ellipse(*POOL), y=0.05, h=0.012, color="#5fc0cc", water=True)
    g.shape("channels", "poly", points=band(rill, 0.95), y=0, h=0.03, color=BANK)
    g.shape("channels", "poly", points=band(rill, 0.5), y=0.03, h=0.012, color="#5fc0cc", water=True)
    g.shape("channels", "cyl", at=[SRC[0], 0, SRC[1]], r=0.85, h=0.14, color="#d8c398")
    g.shape("channels", "disc", at=[SRC[0], 0.142, SRC[1]], r=0.66, color="#5fc0cc", water=True)
    # 2 the paths
    g.label("paving", "Les allées de pierre de sable")
    front = [(6.4, 6.4), (5.0, 5.0), (3.3, 3.3)]
    side = [(3.5, -1.0), (4.7, -2.4), (5.6, -3.6)]
    g.shape("paving", "poly", points=band(front, 1.3), y=0, h=0.045, color=PATH)
    g.shape("paving", "poly", points=band(side, 1.1), y=0, h=0.045, color=PATH)
    g.shape("paving", "poly", points=ellipse(C[0], C[1], 4.6, 3.25, 45), y=0, h=0.04, color=PATH)
    # beds: the green that the water brings
    beds = [("bed-1", "La palmeraie de l'est, sur la rive", (4.6, -1.0), 2.4, 1.7, 30),
            ("bed-2", "Le verger de l'ouest, à l'ombre", (-2.0, 4.8), 2.6, 1.8, 60),
            ("bed-3", "La rive verte au pied des dunes", (-1.6, -1.6), 2.9, 1.5, 45),
            ("bed-4", "Le pré de l'entrée", (2.4, 5.4), 1.9, 1.4, 0)]
    for el, text, (x, z), rx, rz, deg in beds:
        g.label(el, text)
        g.shape(el, "poly", points=ellipse(x, z, rx, rz, deg), y=0, h=0.02, color=GREEN, lawn=True,
                dryColor=GREEN_DRY)

    # trees: the date palms, the cypress and olive steps are palms too; the others fruit trees in
    # their shade (an oasis is three storeys: palms, fruit trees, crops).
    palm_spots = [ring(250, 5.0, 3.6), ring(290, 5.0, 3.6), ring(215, 5.2, 3.7), ring(325, 5.1, 3.6),
                  (-4.3, -1.3), (-1.3, -4.3), ring(170, 5.3, 3.8), ring(20, 5.4, 3.9), (6.3, 0.9),
                  (-0.4, 7.0), (-6.4, 2.4), (2.6, -6.6), (5.3, 3.4), (1.2, 7.4), (7.4, 1.6)]
    fruit_spots = [(4.3, -0.4), (-1.8, 4.3), (-2.4, 5.6), (5.4, -1.6), (-1.0, -2.2), (3.6, -1.7),
                   (-3.2, 4.0), (-2.4, -0.7), (2.0, 5.9), (5.6, 0.1), (-0.9, 5.4), (-3.4, 5.6),
                   (3.0, 4.9), (4.4, -2.6), (-0.4, -1.6)]
    palms = iter(palm_spots)
    fruits = iter(fruit_spots)
    k = 0
    names = {"date-palm": "Palmier-dattier", "cypress": "Palmier-dattier élancé", "olive": "Jeune palmier",
             "pomegranate": "Grenadier à l'ombre des palmiers", "fig": "Figuier à l'ombre des palmiers",
             "orange": "Oranger à l'ombre des palmiers"}
    for el, species in trees_by_slot(g):
        k += 1
        g.label(el, names[species])
        if species in ("date-palm", "cypress", "olive"):
            x, z = next(palms)
            if species == "olive":
                g.put(el, "tree.palm-young", x, z, {"h": 2.3, "wmax": 2.6}, y=ground(x, z) * 0.8, variant=k)
            else:
                g.put(el, "tree.palm", x, z, {"h": 4.0 if species == "date-palm" else 4.5, "wmax": 3.4},
                      y=ground(x, z) * 0.8, variant=k)
        else:
            x, z = next(fruits)
            role = "tree.fruit-dark" if species == "fig" else "tree.fruit"
            g.put(el, role, x, z, {"h": 2.1 if species != "orange" else 2.3, "wmax": 2.0}, y=0.02, variant=k)

    g.label("stepping-stones", "Des pierres plates pour passer le ruisseau")
    for k, (u, v) in enumerate([(-0.55, 0), (0, 0), (0.55, 0)]):
        x, z = uv(u, v, (-1.7, -1.3))
        g.put("stepping-stones", "stepping-stones", x, z, {"w": 0.55}, y=0.035, yaw=45, variant=k)
    for k, t in enumerate([100, 112, 124]):
        x, z = ring(t, 4.35, 3.0)
        g.put("stepping-stones", "stepping-stones", x, z, {"w": 0.7}, y=0.04, variant=k + 3)
    flower_spots = {"flowers-1": [ring(t, 4.25, 2.9) for t in (60, 70, 80)],
                    "flowers-2": [ring(t, 4.25, 2.9) for t in (140, 150, 160)],
                    "flowers-3": [(-3.3, -2.2), (-2.1, -3.4), (-3.1, -3.3)],
                    "flowers-4": [ring(t, 4.25, 2.9) for t in (195, 205, 345, 355)]}
    texts = {"flowers-1": "Des fleurs sur la rive du sud", "flowers-2": "Des fleurs sur la rive de l'ouest",
             "flowers-3": "Des fleurs autour de la source", "flowers-4": "Des fleurs sur la rive du nord"}
    for el, spots in flower_spots.items():
        g.label(el, texts[el])
        for x, z in spots:
            g.put(el, "flowers", x, z, {"h": 0.55, "wmax": 0.7}, y=0.04)
    g.label("fountain", "La vasque de l'ouest, où l'on puise l'eau")
    g.put("fountain", "fountain", -4.9, 3.6, {"w": 1.5}, y=0, yaw=0)
    g.label("springs", "Deux suintements entre les rochers, au pied des dunes")
    for (x, z) in [(-7.0, 2.4), (2.4, -7.0)]:
        g.shape("springs", "cyl", at=[x, 0, z], r=0.62, h=0.1, color=BANK)
        g.shape("springs", "disc", at=[x, 0.102, z], r=0.45, color="#5fc0cc", water=True)
        for dx, dz, w, v in [(-0.75, -0.3, 0.75, 0), (-0.25, -0.8, 0.6, 1), (0.55, -0.55, 0.5, 2)]:
            sx, sz = (dx, dz) if x < 0 else (dz, dx)
            g.put("springs", "rock", x + sx, z + sz, {"w": w}, y=0, variant=v)
    g.label("birds-1", "Des oiseaux (aucun modèle)")
    g.label("birds-2", "Des oiseaux (aucun modèle)")
    g.label("birds-3", "Des oiseaux (aucun modèle)")
    g.label("butterflies", "Des papillons (aucun modèle)")
    # walls: two low walls of ochre earth along the back, each with a gap for its arch
    g.label("wall-north", "Le mur de terre du nord, derrière les dunes")
    g.line("wall-north", "wall", (-2.4, -8.7), (4.4, -8.1), {"h": 1.25}, y=0,
           gap={"at": [1.0, -8.4], "width": 1.6})
    g.label("wall-west", "Le mur de terre de l'ouest")
    g.line("wall-west", "wall", (-8.7, -2.4), (-8.1, 4.4), {"h": 1.25}, y=0,
           gap={"at": [-8.4, 1.0], "width": 1.6})
    g.label("gate-north", "L'arche du nord")
    g.put("gate-north", "gate", 1.0, -8.4, {"w": 1.6, "hmax": 1.9}, yaw=-5)
    g.label("gate-west", "L'arche de l'ouest")
    g.put("gate-west", "gate", -8.4, 1.0, {"w": 1.6, "hmax": 1.9}, yaw=95)
    CAMP = (5.2, -4.6)
    g.label("trellis", "Un auvent de toile, pour l'ombre du campement")
    g.put("trellis", "canopy", 3.7, -3.2, {"w": 2.3, "hmax": 2.0}, yaw=45)
    g.label("lanterns", "Les lanternes des allées")
    for x, z in [(5.4, 6.4), (3.6, 4.6), (4.0, -1.7), (6.2, -3.0)]:
        g.put("lanterns", "lantern", x, z, {"h": 1.35}, yaw=0)
    g.label("pavilion", "La tente du campement")
    g.put("pavilion", "pavilion", CAMP[0], CAMP[1], {"w": 2.8, "hmax": 2.2}, yaw=-25)
    g.label("carpets", "Le tapis sous l'auvent")
    g.put("carpets", "carpet", 3.7, -3.2, {"w": 1.9}, y=0.0, yaw=45)
    g.label("cushions", "Des coussins sur le tapis")
    for k, (dx, dz, yaw) in enumerate([(-0.55, 0.05, 30), (0.1, -0.6, 70), (0.55, 0.15, 110)]):
        g.put("cushions", "cushion", 3.7 + dx, -3.2 + dz, {"w": 0.5}, y=0.012, yaw=yaw, variant=k)
    g.label("lectern", "Une table basse et ses livres, devant la tente")
    g.put("lectern", "lectern", CAMP[0] - 0.3, CAMP[1] + 1.5, {"w": 0.65, "hmax": 0.55}, yaw=-30)
    g.label("roses", "Des buissons en fleurs le long des murs")
    for k, (x, z) in enumerate([(-1.0, -8.0), (3.0, -7.6), (-8.0, -1.0), (-7.6, 3.0), (6.8, -2.0)]):
        g.put("roses", "roses", x, z, {"h": 0.85, "wmax": 1.1}, y=ground(x, z), variant=k)
    g.label("waterfall", "La chute d'eau entre les rochers de la grande dune")
    g.put("waterfall", "rock-tall", -3.75, -3.15, {"h": 1.7, "wmax": 1.3}, y=0.0, yaw=30)
    g.put("waterfall", "rock-tall", -3.15, -3.75, {"h": 1.5, "wmax": 1.2}, y=0.0, yaw=200)
    g.put("waterfall", "rock", -3.75, -3.75, {"w": 1.3}, y=0.9, yaw=60)
    g.shape("waterfall", "sheet", at=[-2.98, 0.66, -2.98], size=[0.62, 1.3], yaw=45, color="#8fd6df",
            water=True)
    g.label("full-bloom", "La pleine floraison : roseaux, plantes du désert, nénuphars, jarres")
    for k, t in enumerate(range(0, 360, 26)):
        x, z = ring(t + 8, 3.95, 2.58)
        g.put("full-bloom", "reeds", x, z, {"h": 0.6, "wmax": 0.75}, y=0.05, variant=k)
    for k, (u, v) in enumerate([(-1.8, 0.4), (1.2, -0.6), (0.2, 0.9), (2.2, 0.5), (-0.9, -0.8)]):
        x, z = uv(u, v, C)
        g.put("full-bloom", "lily", x, z, {"w": 0.5}, y=0.062, onWater=True, variant=k)
    for k, (x, z) in enumerate([(-5.6, 0.8), (0.8, -5.6), (6.6, 3.2), (-2.6, 7.6), (7.4, -0.8), (-7.4, -3.6)]):
        g.put("full-bloom", "plant", x, z, {"w": 0.9}, y=ground(x, z), variant=k)
    for k, (x, z, w) in enumerate([(4.3, -5.6, 0.7), (4.9, -5.9, 0.5), (-5.6, 4.4, 0.6)]):
        g.put("full-bloom", "pot", x, z, {"w": w}, y=0, variant=k)
    for k, (x, z) in enumerate([(6.8, 4.4), (-4.4, 6.8), (7.4, 1.8)]):
        g.put("full-bloom", "bush", x, z, {"h": 0.6, "wmax": 0.9}, y=0, variant=k)
    for k, (x, z, h) in enumerate([(3.4, 7.6, 1.8), (7.6, 3.4, 1.6), (-3.0, 8.2, 1.5), (8.2, -2.6, 1.7)]):
        g.put("full-bloom", "tree.palm-young", x, z, {"h": h, "wmax": 2.0}, y=0, variant=k)
    g.write()


# =============================================================================================
# Level 3. Waterside orchard: a river across the plot, a wooden bridge, fruit trees in rows.
# =============================================================================================
def orchard():
    EARTH, SIDE, BORDER = "#b89a70", "#9c7c55", "#cbbd9e"
    MEADOW, MEADOW_DRY, BANK, PATH = "#a4c56f", "#cfb978", "#cdbf9c", "#dcc59a"
    roles = {
        "tree.round": [q("NormalTree_5", scale=1.15), q("NormalTree_3", scale=1.15)],
        "tree.spread": [q("NormalTree_4", scale=1.15), q("NormalTree_3", scale=1.15)],
        "tree.dark": [q("NormalTree_1", "qs-dark", scale=1.2), q("NormalTree_4", "qs-dark", scale=1.15)],
        "tree.tall": [q("NormalTree_2", scale=1.25), q("NormalTree_1", scale=1.25)],
        "tree.poplar": [q("BirchTree_3", "qs-birch"), q("BirchTree_1", "qs-birch"), q("BirchTree_4", "qs-birch")],
        "flowers": FLOWERS, "grass": GRASS, "reeds": [q("Grass_Large_Extruded"), q("Grass_Large")],
        "roses": [q("Bush_Flowers"), q("Bush_Large_Flowers"), q("Bush_Small_Flowers")],
        "bush": [q("Bush"), q("Bush_Large")],
        "rock": [q("Rock_2"), q("Rock_1"), q("Rock_5"), q("Rock_3")],
        "bridge": [kn("nature/bridge_wood", "kn-warm")],
        "stepping-stones": [kn("nature/path_stone", "kn-warm"), kn("nature/path_stoneCircle", "kn-warm")],
        "fence": [kn("nature/fence_simple", "kn-warm", lengthAxis="x")],
        "gate": [kn("nature/fence_gate", "kn-warm")],
        "fountain": [kn("fantasy-town/fountain-square")],
        "pergola": [kn("survival/structure-roof")],
        "lantern": [kn("fantasy-town/lantern")],
        "mill": [{"parts": [kn("pirate/structure-fence-sides"),
                            kn("fantasy-town/watermill-wide", pos=[1.55, 0.0, 0.0], yaw=90, scale=1.15)]}],
        "carpet": [kn("furniture/rugRectangle")],
        "cushion": [kn("furniture/pillow"), kn("furniture/pillowBlue")],
        "lectern": [LECTERN],
        "bench": [kn("graveyard/bench")],
        "boat": [kn("pirate/boat-row-small")],
        "lily": LILY,
        "crate": [kn("pirate/crate")],
    }
    g = Garden(
        3, "waterside-orchard", "Verger au bord de l'eau",
        "Une rivière traverse le terrain. Un chemin la franchit par un pont de bois ; de part et d'autre, "
        "des arbres fruitiers en rangs, des peupliers le long de l'eau, des prés fleuris, et un moulin sur "
        "la berge.",
        {"shape": "square", "half": 9.0, "slab": 0.7, "top": EARTH, "side": SIDE,
         "border": {"w": 0.3, "h": 0.2, "color": BORDER}},
        roles, colors={"water": "#5bb8d0", "waterLow": "#7fb0b8", "dryBed": "#bda98a", "lawnDry": MEADOW_DRY})
    river = smooth([(10.0, -4.2), (6.4, -4.0), (3.4, -2.3), (0.5, -0.1), (-2.2, 2.8), (-4.2, 6.0), (-4.5, 10.0)], 10)
    B = min(river, key=lambda p: abs(p[0] - p[1]))
    B = ((B[0] + B[1]) / 2, (B[0] + B[1]) / 2)
    L = 0.05

    g.label("channels", "La rivière, d'un bord à l'autre du terrain")
    g.shape("channels", "poly", points=clip_square(band(river, 3.1), IN), y=0, h=0.055, color=BANK)
    g.shape("channels", "poly", points=clip_square(band(river, 2.3), IN), y=0.055, h=0.012, color="#5bb8d0",
            water=True)
    g.label("paving", "Le chemin du verger et son pont de bois")
    d = 1.9 / S2
    path = [(-6.6, -6.6), (B[0] - d, B[1] - d), (B[0] + d, B[1] + d), (8.4, 8.4)]
    g.shape("paving", "poly", points=band(path[:2], 1.2), y=0, h=0.066, color=PATH)
    g.shape("paving", "poly", points=band(path[2:], 1.2), y=0, h=0.066, color=PATH)
    g.put("paving", "bridge", B[0], B[1], {"w": 1.5}, y=0.0, yaw=-45, stretch=[2.15, 1, 1])
    back = clip_square(list(river) + [(-IN - 4, IN + 4), (-IN - 4, -IN - 4), (IN + 4, -IN - 4)], IN)
    front = clip_square(list(river) + [(IN + 4, IN + 4)], IN)
    halves = [("bed-1", "Le pré du fond, côté est", back, (-1, 1)), ("bed-2", "Le pré de devant, côté est", front, (-1, 1)),
              ("bed-3", "Le pré du fond, côté ouest", back, (1, -1)), ("bed-4", "Le pré de devant, côté ouest", front, (1, -1))]
    for el, text, poly, (a, b) in halves:
        g.label(el, text)
        g.shape(el, "poly", points=clip_half(poly, a, b, 0), y=0, h=L, color=MEADOW, lawn=True, dryColor=MEADOW_DRY)

    def free(x, z, gap=2.2):
        return (dist_to_line(x, z, river) > gap and dist_to_line(x, z, [(-7, -7), (9, 9)]) > 1.3
                and max(abs(x), abs(z)) < 7.8)

    rows = []
    for dist in (3.1, 5.0, 6.9, 8.8, -3.1, -5.0, -6.9, -8.8):
        row = []
        for k in range(-9, 10):
            x, z = uv(k * 1.95, -dist, B)
            taken = [(-3.0, -4.9, 1.3), (-5.6, -1.6, 1.4), (5.0, 3.0, 1.0)]
            if free(x, z, 2.05) and all(math.hypot(x - a, z - b) > r for a, b, r in taken):
                row.append((x, z))
        rows.append(row)
    fruit = []
    for i in range(max(len(r) for r in rows)):
        for row in rows:
            if i < len(row):
                fruit.append(row[i])
    poplars = [river[i] for i in (6, 22, 36, 48, 56)]
    poplar_spots = []
    for i, p in enumerate(poplars):
        idx = river.index(p)
        nxt = river[min(idx + 1, len(river) - 1)]
        nx, nz = -(nxt[1] - p[1]), nxt[0] - p[0]
        n = math.hypot(nx, nz) or 1
        side = 1 if i % 2 == 0 else -1
        poplar_spots.append((p[0] + side * nx / n * 2.0, p[1] + side * nz / n * 2.0))
    roles_by = {"pomegranate": "tree.round", "fig": "tree.spread", "olive": "tree.dark", "orange": "tree.round",
                "date-palm": "tree.tall"}
    names = {"pomegranate": "Grenadier", "fig": "Figuier", "olive": "Olivier", "orange": "Oranger",
             "date-palm": "Noyer, le grand arbre du verger", "cypress": "Peuplier au bord de l'eau"}
    fi, pi = iter(fruit), iter(poplar_spots)
    for k, (el, species) in enumerate(trees_by_slot(g)):
        g.label(el, names[species])
        if species == "cypress":
            x, z = next(pi)
            g.put(el, "tree.poplar", x, z, {"h": 4.0, "wmax": 1.7}, y=L, variant=k)
        else:
            x, z = next(fi)
            size = {"h": 3.3, "wmax": 2.6} if species == "date-palm" else {"h": 2.5, "wmax": 2.2}
            g.put(el, roles_by[species], x, z, size, y=L, variant=k)

    g.label("stepping-stones", "Un gué de pierres plates, en aval")
    a, b = river[44], river[45]
    nx, nz = -(b[1] - a[1]), b[0] - a[0]
    n = math.hypot(nx, nz)
    for k, t in enumerate((-0.85, 0, 0.85)):
        g.put("stepping-stones", "stepping-stones", a[0] + nx / n * t, a[1] + nz / n * t, {"w": 0.62},
              y=0.06, variant=k)
    meadows = {"flowers-1": (-6.2, 1.6), "flowers-2": (5.9, -6.6), "flowers-3": (1.4, 6.6), "flowers-4": (6.8, 1.4)}
    texts = {"flowers-1": "Des fleurs des prés, à l'ouest", "flowers-2": "Des fleurs des prés, au fond",
             "flowers-3": "Des fleurs des prés, devant", "flowers-4": "Des fleurs des prés, à l'est"}
    for i, (el, (x0, z0)) in enumerate(meadows.items()):
        g.label(el, texts[el])
        rnd = lcg(31 + i)
        for k in range(9):
            a_, r_ = next(rnd) * 2 * math.pi, 1.5 * math.sqrt(next(rnd))
            g.put(el, "flowers", x0 + r_ * math.cos(a_), z0 + r_ * math.sin(a_), {"h": 0.55, "wmax": 0.7}, y=L)
    g.label("fountain", "L'abreuvoir de pierre près du chemin")
    g.put("fountain", "fountain", 5.0, 3.0, {"w": 1.5}, y=L, yaw=45)
    g.label("springs", "Les sources qui grossissent la rivière")
    for (x, z) in [(-7.4, 3.6), (7.0, -6.0)]:
        g.shape("springs", "cyl", at=[x, 0, z], r=0.6, h=0.11, color=BANK)
        g.shape("springs", "disc", at=[x, 0.112, z], r=0.44, color="#5bb8d0", water=True)
        for k, (dx, dz, w) in enumerate([(-0.6, -0.5, 0.7), (0.5, -0.55, 0.55), (-0.7, 0.35, 0.5)]):
            g.put("springs", "rock", x + dx, z + dz, {"w": w}, y=L, variant=k)
    for el in ("birds-1", "birds-2", "birds-3"):
        g.label(el, "Des oiseaux (aucun modèle)")
    g.label("butterflies", "Des papillons (aucun modèle)")
    g.label("wall-north", "La barrière de bois du nord")
    g.line("wall-north", "fence", (-8.4, -8.4), (8.4, -8.4), {"h": 0.75}, y=L, gap={"at": [1.5, -8.4], "width": 1.0})
    g.label("wall-west", "La barrière de bois de l'ouest")
    g.line("wall-west", "fence", (-8.4, 8.4), (-8.4, -8.4), {"h": 0.75}, y=L, gap={"at": [-8.4, -1.5], "width": 1.0})
    g.label("gate-north", "Le portillon du nord")
    g.put("gate-north", "gate", 1.5, -8.4, {"w": 1.0}, y=L, yaw=0)
    g.label("gate-west", "Le portillon de l'ouest")
    g.put("gate-west", "gate", -8.4, -1.5, {"w": 1.0}, y=L, yaw=90)
    g.label("trellis", "La pergola où grimpe la vigne")
    g.put("trellis", "pergola", -5.6, -1.6, {"w": 2.6, "hmax": 2.4}, y=L, yaw=15)
    g.label("lanterns", "Des lanternes aux deux bouts du pont et sur le chemin")
    for s in (-1, 1):
        x, z = uv(0.95 * s, 2.2 * s, B)
        g.put("lanterns", "lantern", x, z, {"h": 1.45}, y=0.066, yaw=0)
    for x, z in [(-5.2, -4.6), (6.6, 7.4)]:
        g.put("lanterns", "lantern", x, z, {"h": 1.45}, y=0.066, yaw=0)
    g.label("pavilion", "Le moulin et sa roue, sur la berge")
    p, nxt = river[17], river[18]
    nx, nz = (nxt[1] - p[1]), -(nxt[0] - p[0])  # the normal toward the back bank
    n = math.hypot(nx, nz)
    nx, nz = nx / n, nz / n
    if nx + nz > 0:
        nx, nz = -nx, -nz
    g.put("pavilion", "mill", p[0] + nx * 2.75, p[1] + nz * 2.75, {"w": 3.2, "hmax": 2.6}, y=L,
          yaw=round(math.degrees(math.atan2(nz, -nx)), 1))
    g.label("carpets", "Une couverture de pique-nique sous les arbres")
    g.put("carpets", "carpet", -3.0, -4.9, {"w": 1.8}, y=L, yaw=30)
    g.label("cushions", "Des coussins sur la couverture")
    for k, (dx, dz, yaw) in enumerate([(-0.5, -0.1, 20), (0.45, 0.2, 80)]):
        g.put("cushions", "cushion", -3.0 + dx, -4.9 + dz, {"w": 0.5}, y=L + 0.012, yaw=yaw, variant=k)
    g.label("lectern", "Une petite table et ses livres, face à la rivière")
    g.put("lectern", "lectern", -2.2, -4.3, {"w": 0.6, "hmax": 0.55}, y=L, yaw=-20)
    g.label("roses", "Des buissons en fleurs le long des barrières")
    for k, (x, z) in enumerate([(-6.4, -7.7), (4.4, -7.7), (-7.7, -6.0), (-7.7, 6.4), (-3.6, -7.7)]):
        g.put("roses", "roses", x, z, {"h": 0.85, "wmax": 1.1}, y=L, variant=k)
    g.label("waterfall", "Le seuil de pierre où la rivière cascade")
    a, b = river[8], river[9]
    nx, nz = -(b[1] - a[1]), b[0] - a[0]
    n = math.hypot(nx, nz)
    for k, t in enumerate((-1.45, -0.9, 0.9, 1.45)):
        g.put("waterfall", "rock", a[0] + nx / n * t, a[1] + nz / n * t, {"w": 0.75 if abs(t) > 1 else 0.6},
              y=0.04, variant=k)
    yaw = math.degrees(math.atan2(nz, nx))
    g.shape("waterfall", "box", at=[a[0], 0.0, a[1]], size=[2.0, 0.24, 0.32], yaw=-yaw, color="#b7ad98")
    g.shape("waterfall", "sheet", at=[a[0] + (b[0] - a[0]) * 0.45, 0.17, a[1] + (b[1] - a[1]) * 0.45],
            size=[1.7, 0.2], yaw=-yaw + 90, color="#86d3e0", water=True)
    g.label("full-bloom", "La pleine floraison : herbes, roseaux, nénuphars, la barque et la récolte")
    for k, i in enumerate((12, 20, 30, 40, 52, 58)):
        p, nxt = river[i], river[i + 1]
        nx, nz = -(nxt[1] - p[1]), nxt[0] - p[0]
        n = math.hypot(nx, nz)
        s = 1 if k % 2 else -1
        for j in range(3):
            x = p[0] + s * nx / n * (1.35 + 0.15 * j) + (nxt[0] - p[0]) * j
            z = p[1] + s * nz / n * (1.35 + 0.15 * j) + (nxt[1] - p[1]) * j
            if max(abs(x), abs(z)) < IN - 0.3:
                g.put("full-bloom", "reeds", x, z, {"h": 0.65, "wmax": 0.8}, y=L)
    for k, i in enumerate((26, 34, 46)):
        p = river[i]
        g.put("full-bloom", "lily", p[0] + 0.35, p[1] + 0.2, {"w": 0.55}, y=0.068, onWater=True, variant=k)
    p, nxt = river[52], river[53]
    g.put("full-bloom", "boat", p[0] + 0.2, p[1], {"w": 2.0}, y=0.05, onWater=True,
          yaw=math.degrees(math.atan2(-(nxt[1] - p[1]), nxt[0] - p[0])) + 90)
    for k, (x, z) in enumerate([(4.2, 5.4), (4.9, 5.9)]):
        g.put("full-bloom", "crate", x, z, {"w": 0.75}, y=L, yaw=15, variant=k)
    rnd = lcg(7)
    for k in range(34):
        x, z = (next(rnd) * 2 - 1) * 7.6, (next(rnd) * 2 - 1) * 7.6
        if dist_to_line(x, z, river) > 1.8 and dist_to_line(x, z, [(-7, -7), (9, 9)]) > 0.9:
            g.put("full-bloom", "grass", x, z, {"h": 0.42, "wmax": 0.6}, y=L, variant=k)
    g.write()


# =============================================================================================
# Level 4. Mountain garden: terraces rising to the far corner, pines, a stream that falls.
# =============================================================================================
def mountain():
    ROCK, ROCK_SIDE, EARTH = "#a39a8c", "#8f8577", "#a89272"
    LAWN, LAWN_DRY, BANK, STONE = "#93b268", "#c9b57c", "#b8ae9c", "#c9c2b5"
    roles = {
        "tree.pine": [q("PineTree_1"), q("PineTree_2"), q("PineTree_5")],
        "tree.pine-small": [q("PineTree_3")],
        "tree.birch": [q("BirchTree_1"), q("BirchTree_4"), q("BirchTree_3")],
        "tree.maple": [q("MapleTree_4"), q("MapleTree_1")],
        "flowers": [q("Flower_3_Clump"), q("Flower_5_Clump"), q("Flower_1_Clump"), q("Flower_4_Clump")],
        "grass": GRASS, "bush": [q("Bush"), q("Bush_Large"), q("Bush_Small")],
        "roses": [q("Bush_Flowers"), q("Bush_Small_Flowers")],
        "rock": [q("Rock_2"), q("Rock_1"), q("Rock_5"), q("Rock_3")],
        "rock-tall": [q("Rock_4"), q("Rock_3")],
        "stairs": [kn("nature/cliff_steps_stone", "kn-grey")],
        "stepping-stones": [kn("nature/path_stone", "kn-grey"), kn("nature/path_stoneCircle", "kn-grey")],
        "fountain": [kn("fantasy-town/fountain-round")],
        "stone-wall": [kn("graveyard/stone-wall", lengthAxis="x")],
        "gateposts": [{"parts": [kn("graveyard/stone-wall-column", pos=[-0.75, 0, 0]),
                                 kn("graveyard/stone-wall-column", pos=[0.75, 0, 0])]}],
        "railing": [kn("nature/fence_simple", "kn-grey", lengthAxis="x")],
        "lantern": [kn("graveyard/lantern-candle", "stone-lantern")],
        "pavilion": [kn("pirate/structure")],
        "carpet": [kn("furniture/rugRound")],
        "cushion": [kn("furniture/pillow"), kn("furniture/pillowBlue")],
        "lectern": [LECTERN],
        "lily": LILY,
        "logs": [kn("nature/log_stack", "kn-grey")],
        "mushroom": [kn("nature/mushroom_tanGroup", "kn-grey")],
    }
    g = Garden(
        4, "mountain-garden", "Jardin de montagne",
        "Trois terrasses de pierre montent vers le coin du fond. Une source naît au sommet, descend de "
        "terrasse en terrasse jusqu'à un étang ; des pins, des bouleaux dorés et des érables rouges, et "
        "un abri de bois au sommet.",
        {"shape": "square", "half": 9.0, "slab": 0.9, "top": EARTH, "side": ROCK_SIDE,
         "border": {"w": 0.3, "h": 0.22, "color": "#bdb4a5"}},
        roles, colors={"water": "#62bcd2", "waterLow": "#83b2bb", "dryBed": "#b2a68f", "lawnDry": LAWN_DRY})
    H1, H2, H3 = 0.5, 1.0, 1.5
    E1, E2, E3 = 2.6, -1.4, -5.0
    for edge, h in ((E1, H1), (E2, H2), (E3, H3)):
        size = edge + IN
        g.shape(None, "box", at=[(edge - IN) / 2, 0, (edge - IN) / 2], size=[size, h, size], color=ROCK)

    def level(x, z):
        if x <= E3 and z <= E3:
            return H3
        if x <= E2 and z <= E2:
            return H2
        if x <= E1 and z <= E1:
            return H1
        return 0.0

    G = 0.03
    SRC = (-6.6, -6.6)
    s3 = [SRC, (-5.8, -5.4), (E3 + 0.02, -4.4)]
    s2 = smooth([(E3, -4.4), (-3.4, -3.6), (E2 + 0.02, -2.6)], 5)
    s1 = smooth([(E2, -2.6), (-0.2, -1.0), (0.4, 1.2), (0.5, E1 + 0.02)], 6)
    POND = (1.6, 4.9)
    brook = smooth([(2.4, 5.8), (3.1, 7.2), (3.3, IN)], 5)
    # Rocks along the foot of each terrace: the mountain itself, there from the first page.
    rnd = lcg(3)
    for edge, base in ((E1, 0.0), (E2, H1), (E3, H2)):
        for k in range(9):
            t = -IN + 0.8 + (edge + IN - 1.2) * (k + next(rnd) * 0.6) / 9
            for x, z in ((edge + 0.35, t), (t, edge + 0.35)):
                if dist_to_line(x, z, s1 + s2 + s3) > 0.9 and abs(x - z) > 0.2 and next(rnd) < 0.62:
                    g.put(None, "rock", x, z, {"w": 0.5 + next(rnd) * 0.35, "hmax": 0.45}, y=base - 0.05)
    g.label("channels", "La source du sommet et son ruisseau, de terrasse en terrasse, jusqu'à l'étang")
    g.shape("channels", "cyl", at=[SRC[0], H3, SRC[1]], r=0.85, h=0.12, color=STONE)
    g.shape("channels", "disc", at=[SRC[0], H3 + 0.122, SRC[1]], r=0.65, color="#62bcd2", water=True)
    for line, h in ((s3, H3), (s2, H2), (s1, H1)):
        g.shape("channels", "poly", points=band(line, 0.95), y=h, h=G + 0.01, color=BANK)
        g.shape("channels", "poly", points=band(line, 0.55), y=h + G + 0.01, h=0.01, color="#62bcd2", water=True)
    g.shape("channels", "sheet", at=[E3 + 0.03, (H2 + H3) / 2 + 0.03, -4.4], size=[0.5, H3 - H2 + 0.08], yaw=90,
            color="#86d0de", water=True)
    g.shape("channels", "sheet", at=[E2 + 0.03, (H1 + H2) / 2 + 0.03, -2.6], size=[0.5, H2 - H1 + 0.08], yaw=90,
            color="#86d0de", water=True)
    g.shape("channels", "sheet", at=[0.5, H1 / 2 + 0.03, E1 + 0.03], size=[0.5, H1 + 0.08], yaw=0,
            color="#86d0de", water=True)
    g.shape("channels", "poly", points=ellipse(POND[0], POND[1], 2.6, 1.9, 45), y=0, h=0.045, color=BANK)
    g.shape("channels", "poly", points=clip_square(band(brook, 1.1), IN), y=0, h=0.045, color=BANK)
    g.shape("channels", "poly", points=ellipse(POND[0], POND[1], 2.35, 1.65, 45), y=0.045, h=0.012,
            color="#62bcd2", water=True)
    g.shape("channels", "poly", points=clip_square(band(brook, 0.6), IN), y=0.045, h=0.012, color="#62bcd2",
            water=True)
    g.label("paving", "Les escaliers de pierre qui relient les terrasses")
    for x, z, rise, base, yaw in [(E1 + 0.5, -0.4, H1, 0, 270), (-6.0, E2 + 0.5, H2 - H1, H1, 0),
                                  (E3 + 0.5, -7.2, H3 - H2, H2, 270)]:
        g.put("paving", "stairs", x, z, {"h": rise + 0.02}, y=base, yaw=yaw, stretch=[1.0, 1, 1.0])
    g.shape("paving", "poly", points=band([(8.2, 8.2), (6.6, 4.4), (4.4, 1.4), (E1 + 1.0, -0.4)], 1.0), y=0,
            h=0.05, color="#cbbfa8")
    lawns = [("bed-1", "L'herbe du bas, autour de l'étang",
              [[(E1 + 0.02, IN, -IN, IN)], [(-IN, E1 + 0.02, E1 + 0.02, IN)]], 0.0),
             ("bed-2", "L'herbe de la première terrasse",
              [[(E2, E1 - 0.25, -IN + 0.25, E1 - 0.25)], [(-IN + 0.25, E2, E2, E1 - 0.25)]], H1),
             ("bed-3", "L'herbe de la deuxième terrasse",
              [[(E3, E2 - 0.25, -IN + 0.25, E2 - 0.25)], [(-IN + 0.25, E3, E3, E2 - 0.25)]], H2),
             ("bed-4", "L'herbe du sommet", [[(-IN + 0.25, E3 - 0.25, -IN + 0.25, E3 - 0.25)]], H3)]
    for el, text, rect_lists, h in lawns:
        g.label(el, text)
        for rects in rect_lists:
            for (x0, x1, z0, z1) in rects:
                g.shape(el, "poly", points=[[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y=h, h=G, color=LAWN,
                        lawn=True, dryColor=LAWN_DRY)

    pines = [(5.8, -7.0, 3.4), (-7.0, 5.8, 3.3), (1.4, -7.3, 3.2), (-7.3, 1.4, 3.2), (-2.9, -7.6, 2.8),
             (-7.6, -2.9, 2.8), (7.6, -4.3, 3.0), (-4.3, 7.4, 3.1), (1.4, -4.8, 2.9), (-4.8, 1.2, 2.9),
             (-3.2, -5.9, 2.6), (7.5, 2.6, 3.0), (-7.6, 7.6, 2.8), (1.6, 1.4, 2.6), (-6.0, -3.1, 2.6)]
    birches = [(-2.2, 5.2), (5.6, 5.4), (-2.6, 0.9), (4.4, -3.0), (-5.6, 3.4)]
    maples = [(4.8, 7.4), (-0.6, -6.2), (6.6, -1.4), (-6.4, -0.4), (2.9, 2.4)]
    small = [(-6.6, -7.8), (-7.8, -6.0), (0.0, 7.6), (7.7, 0.6), (-1.0, 2.0)]
    names = {"cypress": "Pin", "date-palm": "Grand pin", "olive": "Pin", "fig": "Bouleau au feuillage doré",
             "orange": "Érable rouge", "pomegranate": "Jeune pin"}
    pi, bi, mi, si = iter(pines), iter(birches), iter(maples), iter(small)
    for k, (el, species) in enumerate(trees_by_slot(g)):
        g.label(el, names[species])
        if species in ("cypress", "date-palm", "olive"):
            x, z, h = next(pi)
            base = level(x, z)
            g.put(el, "tree.pine", x, z, {"h": h if base < H3 else min(h, 2.4), "wmax": 2.2}, y=base + G, variant=k)
        elif species == "fig":
            x, z = next(bi)
            g.put(el, "tree.birch", x, z, {"h": 2.9, "wmax": 2.0}, y=level(x, z) + G, variant=k)
        elif species == "orange":
            x, z = next(mi)
            g.put(el, "tree.maple", x, z, {"h": 1.9, "wmax": 2.6}, y=level(x, z) + G, variant=k)
        else:
            x, z = next(si)
            g.put(el, "tree.pine-small", x, z, {"h": 1.7, "wmax": 1.4}, y=level(x, z) + G, variant=k)

    g.label("stepping-stones", "Des pierres pour passer le ruisseau de l'étang")
    for k, t in enumerate((0.25, 0.5, 0.75)):
        i = int(t * (len(brook) - 1))
        g.put("stepping-stones", "stepping-stones", brook[i][0], brook[i][1], {"w": 0.55}, y=0.058, variant=k)
    blooms = {"flowers-1": (3.8, -6.4, 0.0), "flowers-2": (-6.2, 3.6, 0.0), "flowers-3": (0.6, -3.4, H1),
              "flowers-4": (-6.8, -5.8, H2)}
    texts = {"flowers-1": "Des fleurs de montagne, en bas", "flowers-2": "Des fleurs de montagne, à l'ouest",
             "flowers-3": "Des fleurs sur la première terrasse", "flowers-4": "Des fleurs sur la deuxième terrasse"}
    for el, (x, z, base) in blooms.items():
        g.label(el, texts[el])
        for dx, dz in [(0, 0), (0.6, 0.3), (-0.2, 0.7), (0.5, -0.5)]:
            g.put(el, "flowers", x + dx, z + dz, {"h": 0.5, "wmax": 0.65}, y=base + G)
    g.label("fountain", "La vasque de pierre de la première terrasse")
    g.put("fountain", "fountain", -6.8, 0.9, {"w": 1.3}, y=H1 + G, yaw=0)
    g.label("springs", "Deux sources qui suintent du rocher")
    for (x, z, base) in [(-3.6, -1.9, H2), (0.9, -5.6, H2)]:
        g.shape("springs", "cyl", at=[x, base, z], r=0.55, h=0.1, color=STONE)
        g.shape("springs", "disc", at=[x, base + 0.102, z], r=0.4, color="#62bcd2", water=True)
        for k, (dx, dz, w) in enumerate([(-0.55, -0.45, 0.7), (0.4, -0.6, 0.55)]):
            g.put("springs", "rock", x + dx, z + dz, {"w": w}, y=base, variant=k)
    for el in ("birds-1", "birds-2", "birds-3"):
        g.label(el, "Des oiseaux (aucun modèle)")
    g.label("butterflies", "Des papillons (aucun modèle)")
    g.label("wall-north", "Le muret de pierres sèches du nord, de terrasse en terrasse")
    W = -8.45
    for a_, b_, h in [(-8.6, E3, H3), (E3, E2, H2), (E2, E1, H1)]:
        g.line("wall-north", "stone-wall", (a_ + 0.1, W), (b_ - 0.1, W), {"h": 0.6}, y=h)
    g.line("wall-north", "stone-wall", (E1 + 0.1, W), (8.6, W), {"h": 0.6}, y=0, gap={"at": [5.6, W], "width": 1.6})
    g.label("wall-west", "Le muret de pierres sèches de l'ouest")
    for a_, b_, h in [(-8.6, E3, H3), (E3, E2, H2), (E2, E1, H1)]:
        g.line("wall-west", "stone-wall", (W, a_ + 0.1), (W, b_ - 0.1), {"h": 0.6}, y=h)
    g.line("wall-west", "stone-wall", (W, E1 + 0.1), (W, 8.6), {"h": 0.6}, y=0, gap={"at": [W, 5.6], "width": 1.6})
    g.label("gate-north", "Les piliers de l'entrée du nord")
    g.put("gate-north", "gateposts", 5.6, W, {"w": 1.9}, y=0, yaw=0)
    g.label("gate-west", "Les piliers de l'entrée de l'ouest")
    g.put("gate-west", "gateposts", W, 5.6, {"w": 1.9}, y=0, yaw=90)
    g.label("trellis", "Le garde-corps de bois au bord des terrasses")
    g.line("trellis", "railing", (-8.4, E3 - 0.12), (E3 - 0.12, E3 - 0.12), {"h": 0.55}, y=H3)
    g.line("trellis", "railing", (E3 - 0.12, E3 - 0.12), (E3 - 0.12, -8.4), {"h": 0.55}, y=H3)
    g.line("trellis", "railing", (-5.0, E2 - 0.12), (E2 - 0.12, E2 - 0.12), {"h": 0.55}, y=H2)
    g.line("trellis", "railing", (E2 - 0.12, E2 - 0.12), (E2 - 0.12, -5.0), {"h": 0.55}, y=H2)
    g.label("lanterns", "Des lanternes de pierre au pied des escaliers")
    for x, z, base in [(E1 + 1.3, 0.6, 0), (-7.1, E2 + 1.2, H1), (E3 + 1.2, -8.0, H2), (3.6, 3.0, 0)]:
        g.put("lanterns", "lantern", x, z, {"h": 0.75}, y=base + G, yaw=45)
    g.label("pavilion", "L'abri de bois du sommet")
    PV = (-6.5, -6.5)
    g.put("pavilion", "pavilion", PV[0], PV[1], {"w": 2.1, "hmax": 1.85}, y=H3 + G, yaw=0)
    g.label("carpets", "Un tapis rond sous l'abri")
    g.put("carpets", "carpet", PV[0], PV[1], {"w": 1.4}, y=H3 + G, yaw=0)
    g.label("cushions", "Des coussins sur le tapis")
    for k, (dx, dz, yaw) in enumerate([(-0.35, 0.2, 20), (0.2, -0.35, 70)]):
        g.put("cushions", "cushion", PV[0] + dx, PV[1] + dz, {"w": 0.42}, y=H3 + G + 0.012, yaw=yaw, variant=k)
    g.label("lectern", "Une petite table et ses livres, face à la vallée")
    g.put("lectern", "lectern", PV[0] + 0.5, PV[1] + 0.45, {"w": 0.5, "hmax": 0.45}, y=H3 + G, yaw=45)
    g.label("roses", "Des buissons en fleurs sur les terrasses")
    for k, (x, z, base) in enumerate([(-1.0, -7.8, H2), (-7.8, -1.0, H2), (2.0, -7.9, H1), (-7.9, 2.0, H1),
                                      (7.9, -7.9, 0)]):
        g.put("roses", "roses", x, z, {"h": 0.8, "wmax": 1.1}, y=base + G, variant=k)
    g.label("waterfall", "La grande cascade du rocher de l'est")
    CX, CZ = 6.3, -6.6
    g.put("waterfall", "rock-tall", CX - 0.7, CZ - 0.2, {"h": 2.4, "wmax": 1.6}, y=0, yaw=20)
    g.put("waterfall", "rock-tall", CX + 0.75, CZ - 0.35, {"h": 2.1, "wmax": 1.5}, y=0, yaw=200, variant=1)
    g.put("waterfall", "rock", CX, CZ - 0.9, {"w": 1.4}, y=1.2, yaw=60)
    g.shape("waterfall", "sheet", at=[CX + 0.02, 1.05, CZ + 0.35], size=[0.55, 2.0], yaw=45, color="#86d0de",
            water=True)
    g.shape("waterfall", "cyl", at=[CX + 0.4, 0, CZ + 1.0], r=0.85, h=0.1, color=STONE)
    g.shape("waterfall", "disc", at=[CX + 0.4, 0.102, CZ + 1.0], r=0.68, color="#62bcd2", water=True)
    g.label("full-bloom", "La pleine floraison : herbes, buissons, champignons, nénuphars, bois coupé")
    for k, (x, z) in enumerate([(6.9, -2.6), (-2.6, 7.0), (-5.4, -1.2), (2.2, -1.8), (-4.0, -2.8), (5.0, 3.6),
                                (-6.4, -5.0), (3.6, 7.6)]):
        g.put("full-bloom", "grass", x, z, {"h": 0.42, "wmax": 0.6}, y=level(x, z) + G, variant=k)
    for k, (x, z) in enumerate([(4.6, -5.0), (-4.9, 5.0), (-2.0, -3.2), (6.5, 6.6)]):
        g.put("full-bloom", "bush", x, z, {"h": 0.7, "wmax": 1.1}, y=level(x, z) + G, variant=k)
    for k, (u, v) in enumerate([(-1.1, 0.3), (0.9, -0.4), (0.1, 0.8)]):
        x, z = uv(u, v, POND)
        g.put("full-bloom", "lily", x, z, {"w": 0.5}, y=0.057, onWater=True, variant=k)
    for k, (x, z, base) in enumerate([(-1.4, 6.6, 0), (-7.4, -4.4, H2), (7.0, 4.6, 0)]):
        g.put("full-bloom", "mushroom", x, z, {"w": 0.4}, y=base + G, variant=k)
    g.put("full-bloom", "logs", 7.6, -0.4, {"w": 1.2}, y=G, yaw=90)
    g.write()


# =============================================================================================
# Level 5. Cherry blossoms: a pond and its island, an arched bridge, pink trees, stone lanterns.
# =============================================================================================
def cherry():
    EARTH, SIDE, BORDER = "#c3b294", "#a8977a", "#8f8a82"
    MOSS, MOSS_DRY, BANK, GRAVEL = "#9cb86e", "#cdb983", "#b8b0a0", "#e2ded4"
    roles = {
        "tree.blossom": [q("MapleTree_4", "qs-pink"), q("MapleTree_1", "qs-pink"), q("NormalTree_3", "qs-pink")],
        "tree.blossom-pale": [q("NormalTree_5", "qs-pale", scale=1.15), q("MapleTree_3", "qs-pale"),
                              q("NormalTree_4", "qs-pale", scale=1.15)],
        "tree.blossom-white": [q("NormalTree_3", "qs-white", scale=1.15), q("MapleTree_4", "qs-white")],
        "tree.maple": [q("MapleTree_4"), q("MapleTree_1")],
        "tree.pine": [q("PineTree_4", "qs-pine-dark"), q("PineTree_3", "qs-pine-dark")],
        "flowers": [q("Flower_4_Clump"), q("Flower_5_Clump"), q("Flower_4_Clump", yaw=90)],
        "roses": [q("Bush_Flowers"), q("Bush_Small_Flowers"), q("Bush_Large_Flowers")],
        "reeds": GRASS, "petals": [q("Petals_3"), q("Petals_2"), q("Petals_1")],
        "rock": [q("Rock_2"), q("Rock_1"), q("Rock_5"), q("Rock_3")],
        "bridge": [kn("nature/bridge_woodRound", "kn-lacquer")],
        "stepping-stones": [kn("nature/path_stone", "kn-grey"), kn("nature/path_stoneCircle", "kn-grey")],
        "basin": [kn("fantasy-town/fountain-round", "stone-lantern")],
        "hedge": [kn("fantasy-town/hedge-large", "dark-hedge", lengthAxis="x")],
        "hedge-gate": [kn("fantasy-town/hedge-large-gate", "dark-hedge")],
        "arbor": [kn("survival/structure-roof", "flat-lacquer")],
        "lantern": [kn("graveyard/lantern-candle", "stone-lantern")],
        "pavilion": [GAZEBO("pillar-wood", "slate-roof")],
        "carpet": [kn("furniture/rugSquare")],
        "cushion": [kn("furniture/pillow"), kn("furniture/pillowBlue")],
        "lectern": [LECTERN],
        "lily": LILY,
    }
    g = Garden(
        5, "cherry-blossoms", "Cerisiers en fleurs",
        "Un étang et son île, que l'on gagne par un pont laqué en arc. Une allée de gravier fait le tour de "
        "l'eau ; des cerisiers roses et blancs, quelques pins taillés et des érables rouges, des lanternes de "
        "pierre, et des pétales qui tombent.",
        {"shape": "square", "half": 9.0, "slab": 0.7, "top": EARTH, "side": SIDE,
         "border": {"w": 0.34, "h": 0.2, "color": BORDER}},
        roles, colors={"water": "#64b4c4", "waterLow": "#84aeb2", "dryBed": "#b9ad97", "lawnDry": MOSS_DRY})
    A = (0.2, 0.9, 4.6, 2.8, 45)
    BAY = (-3.0, 3.8, 2.2, 2.0, 0)
    ISLAND = (0.9, 0.4, 1.55, 1.25, 45)
    L, TOP = 0.05, 0.16

    def in_pond(x, z, grow=0.0):
        return in_ellipse(x, z, *A, grow=grow) or in_ellipse(x, z, *BAY, grow=grow)

    g.label("channels", "L'étang et sa baie")
    for ell in (A, BAY):
        g.shape("channels", "poly", points=ellipse(ell[0], ell[1], ell[2] + 0.3, ell[3] + 0.3, ell[4]), y=0,
                h=0.065, color=BANK)
    for ell in (A, BAY):
        g.shape("channels", "poly", points=ellipse(*ell), y=0.065, h=0.012, color="#64b4c4", water=True)
    g.shape("channels", "poly", points=ellipse(ISLAND[0], ISLAND[1], ISLAND[2] + 0.12, ISLAND[3] + 0.12, 45), y=0,
            h=0.12, color=BANK)
    path = smooth([(8.2, 8.2), (6.9, 4.4), (6.3, 0.4), (5.3, -3.0), (3.2, -4.4), (1.0, -3.9), (0.0, -2.8)], 8)
    path2 = smooth([(6.6, 2.2), (4.0, 4.6), (1.0, 5.6), (-2.0, 6.6), (-4.6, 7.4), (-7.0, 6.4)], 8)
    g.label("paving", "L'allée de gravier et le pont laqué vers l'île")
    g.shape("paving", "poly", points=band(path, 1.1), y=0, h=0.07, color=GRAVEL)
    g.shape("paving", "poly", points=band(path2, 0.9), y=0, h=0.07, color=GRAVEL)
    bx, bz = on_ellipse(270 + 45, *A[:4], 45)
    g.put("paving", "bridge", 0.42, -1.75, {"w": 1.3}, y=0.02, yaw=-69, stretch=[1.95, 1, 1])
    back = [[-IN, IN], [-IN, -IN], [IN, -IN]]
    front = [[IN, -IN], [IN, IN], [-IN, IN]]
    moss = [("bed-1", "La mousse du fond, côté est", clip_half(back, -1, 1, 0)),
            ("bed-2", "La mousse du fond, côté ouest", clip_half(back, 1, -1, 0)),
            ("bed-3", "La mousse de devant", front),
            ("bed-4", "La mousse de l'île", ellipse(*ISLAND))]
    for el, text, poly in moss:
        g.label(el, text)
        y, h = (0, TOP) if el == "bed-4" else (0, L)
        g.shape(el, "poly", points=poly, y=y, h=h, color=MOSS, lawn=True, dryColor=MOSS_DRY)

    spots = [(-7.0, -6.8), (5.4, -7.2), (-7.2, -1.8), (0.4, -7.2), (-4.9, -4.9), (7.4, -3.6), (-7.3, 3.6),
             (-2.0, -7.0), (3.0, -6.9), (-7.4, -4.4), (7.6, -0.9), (-2.8, -4.6), (-7.0, 6.4), (7.4, -6.4),
             (-4.6, -7.3), (-5.0, -2.3), (1.3, 0.6), (-7.4, 0.9), (7.7, 2.4), (-5.6, 0.4), (-5.1, 7.6),
             (2.8, -5.6), (-2.2, 7.6), (1.4, 7.6), (4.6, 6.6), (-0.6, -5.2), (6.4, 6.0), (-3.6, -6.0),
             (4.6, -5.4), (-6.0, 5.0)]
    names = {"pomegranate": "Cerisier en fleurs roses", "orange": "Cerisier en fleurs roses",
             "fig": "Cerisier en fleurs rose pâle", "olive": "Cerisier en fleurs blanches",
             "date-palm": "Érable rouge", "cypress": "Pin taillé"}
    role = {"pomegranate": "tree.blossom", "orange": "tree.blossom", "fig": "tree.blossom-pale",
            "olive": "tree.blossom-white", "date-palm": "tree.maple", "cypress": "tree.pine"}
    for k, ((el, species), (x, z)) in enumerate(zip(trees_by_slot(g), spots)):
        on_island = in_ellipse(x, z, *ISLAND)
        assert on_island or not in_pond(x, z, 0.7), (x, z)
        g.label(el, names[species] + (" sur l'île" if on_island else ""))
        big = species in ("pomegranate", "orange", "fig")
        size = {"h": 2.0 if on_island else (2.6 if big else 2.4), "wmax": 2.9 if big else 2.4}
        if species == "cypress":
            size = {"h": 2.3, "wmax": 2.2}
        g.put(el, role[species], x, z, size, y=TOP if on_island else L, variant=k)

    g.label("stepping-stones", "Des pierres de gué entre l'île et la baie")
    for k, (x, z) in enumerate([(-0.8, 1.6), (-1.5, 2.2), (-2.2, 2.7)]):
        g.put("stepping-stones", "stepping-stones", x, z, {"w": 0.6}, y=0.075, variant=k)
    blooms = {"flowers-1": (2.6, -3.0), "flowers-2": (-4.6, 2.0), "flowers-3": (5.0, 0.8), "flowers-4": (-1.0, 6.4)}
    texts = {"flowers-1": "Des azalées au bord de l'eau", "flowers-2": "Des azalées sur la rive ouest",
             "flowers-3": "Des azalées le long de l'allée", "flowers-4": "Des azalées sur la rive de devant"}
    for el, (x, z) in blooms.items():
        g.label(el, texts[el])
        for dx, dz in [(0, 0), (0.6, 0.25), (-0.25, 0.65)]:
            g.put(el, "flowers", x + dx, z + dz, {"h": 0.5, "wmax": 0.65}, y=L)
    g.label("fountain", "La vasque de pierre où l'on se rafraîchit")
    g.put("fountain", "basin", 5.6, 4.2, {"w": 1.1}, y=L, yaw=0)
    g.label("springs", "La source entre les rochers du fond")
    for k, (x, z, w) in enumerate([(-3.9, -2.4, 0.9), (-3.0, -3.2, 0.75), (-4.6, -3.2, 0.6)]):
        g.put("springs", "rock", x, z, {"w": w}, y=L, variant=k)
    g.shape("springs", "disc", at=[-3.75, 0.072, -2.95], r=0.42, color="#64b4c4", water=True)
    for el in ("birds-1", "birds-2", "birds-3"):
        g.label(el, "Des oiseaux (aucun modèle)")
    g.label("butterflies", "Des papillons (aucun modèle)")
    g.label("wall-north", "La haie taillée du nord")
    g.line("wall-north", "hedge", (-8.4, -8.45), (8.4, -8.45), {"h": 0.9}, y=L, gap={"at": [2.0, -8.45], "width": 1.6})
    g.label("wall-west", "La haie taillée de l'ouest")
    g.line("wall-west", "hedge", (-8.45, 8.4), (-8.45, -8.4), {"h": 0.9}, y=L, gap={"at": [-8.45, 2.0], "width": 1.6})
    g.label("gate-north", "Le passage dans la haie du nord")
    g.put("gate-north", "hedge-gate", 2.0, -8.45, {"w": 1.6, "hmax": 1.0}, y=L, yaw=0)
    g.label("gate-west", "Le passage dans la haie de l'ouest")
    g.put("gate-west", "hedge-gate", -8.45, 2.0, {"w": 1.6, "hmax": 1.0}, y=L, yaw=90)
    g.label("trellis", "La tonnelle de glycine")
    g.put("trellis", "arbor", 6.4, -1.8, {"w": 2.0, "hmax": 2.2}, y=L, yaw=10)
    g.label("lanterns", "Les lanternes de pierre")
    for x, z, y in [(-0.6, -3.0, L), (0.9, 0.2, TOP), (7.6, 6.8, L), (5.5, -2.0, L), (-5.0, 6.8, L)]:
        g.put("lanterns", "lantern", x, z, {"h": 0.85}, y=y, yaw=45)
    g.label("pavilion", "Le pavillon de thé, au fond")
    TEA = (-6.4, -6.4)
    g.shape("pavilion", "box", at=[TEA[0], 0, TEA[1]], size=[2.6, 0.18, 2.6], color="#a58a6a")
    g.put("pavilion", "pavilion", TEA[0], TEA[1], {"w": 2.2, "hmax": 2.9}, y=0.18, yaw=0)
    g.label("carpets", "Un tatami dans le pavillon")
    g.put("carpets", "carpet", TEA[0], TEA[1], {"w": 1.5}, y=0.18, yaw=0)
    g.label("cushions", "Des coussins sur le tatami")
    for k, (dx, dz, yaw) in enumerate([(-0.35, 0.25, 0), (0.3, -0.3, 90)]):
        g.put("cushions", "cushion", TEA[0] + dx, TEA[1] + dz, {"w": 0.45}, y=0.192, yaw=yaw, variant=k)
    g.label("lectern", "Une petite table et ses livres, dans le pavillon")
    g.put("lectern", "lectern", TEA[0] + 0.3, TEA[1] + 0.35, {"w": 0.5, "hmax": 0.45}, y=0.18, yaw=45)
    g.label("roses", "Des buissons fleuris de rose")
    for k, (x, z) in enumerate([(4.0, -5.8), (-4.0, -2.0), (6.9, 2.0), (-6.0, 4.0), (0.1, -4.6), (4.6, 5.2)]):
        g.put("roses", "roses", x, z, {"h": 0.8, "wmax": 1.1}, y=L, variant=k)
    g.label("waterfall", "La petite cascade qui tombe dans la baie")
    WX, WZ = -4.9, 2.4
    for k, (dx, dz, h, w) in enumerate([(-0.5, -0.4, 1.3, 1.0), (0.45, -0.55, 1.0, 0.9)]):
        g.put("waterfall", "rock", WX + dx, WZ + dz, {"h": h, "wmax": w}, y=L, variant=k)
    g.shape("waterfall", "sheet", at=[WX + 0.05, 0.5, WZ + 0.05], size=[0.4, 0.95], yaw=45, color="#88cfdb",
            water=True)
    g.label("full-bloom", "La pleine floraison : pétales sur l'herbe et sur l'eau, nénuphars, herbes hautes")
    rnd = lcg(5)
    k = 0
    while k < 26:
        x, z = (next(rnd) * 2 - 1) * 7.8, (next(rnd) * 2 - 1) * 7.8
        wet = in_pond(x, z, -0.4) and not in_ellipse(x, z, *ISLAND, grow=0.3)
        if not wet and in_pond(x, z, 0.4):
            continue
        g.put("full-bloom", "petals", x, z, {"w": 0.4}, y=(0.078 if wet else L + 0.005), onWater=wet, variant=k)
        k += 1
    for k, (x, z) in enumerate([(-2.6, 3.4), (-3.4, 4.6), (2.4, 2.4), (-1.2, -0.2)]):
        g.put("full-bloom", "lily", x, z, {"w": 0.55}, y=0.078, onWater=True, variant=k)
    for k, (x, z) in enumerate([(-4.6, 5.4), (4.0, -2.6), (2.6, 4.2), (-3.4, 0.6)]):
        g.put("full-bloom", "reeds", x, z, {"h": 0.55, "wmax": 0.7}, y=L, variant=k)
    g.write()


# =============================================================================================
# Level 6. Pine clearing: a forest around a sunny clearing, a stream, a camp.
# =============================================================================================
def pines():
    EARTH, SIDE = "#8d7152", "#6f5640"
    FLOOR, FLOOR_DRY, MEADOW, MEADOW_DRY = "#7f9a58", "#b5a273", "#a9c27a", "#d2bd82"
    BANK, PATH = "#a7987f", "#b39572"
    roles = {
        "tree.pine": [q("PineTree_1"), q("PineTree_2"), q("PineTree_5")],
        "tree.pine-wide": [q("PineTree_4")],
        "tree.pine-young": [q("PineTree_3")],
        "tree.birch": [q("BirchTree_1", "qs-birch"), q("BirchTree_4", "qs-birch"), q("BirchTree_2", "qs-birch")],
        "flowers": [q("Flower_2_Clump"), q("Flower_1_Clump"), q("Flower_3_Clump"), q("Plant_Flowers")],
        "fern": [q("Plant_2"), q("Plant_1")],
        "grass": GRASS, "bush": [q("Bush"), q("Bush_Large"), q("Bush_Small")],
        "roses": [q("Bush_Flowers"), q("Bush_Large_Flowers")],
        "rock": [q("Rock_2"), q("Rock_1"), q("Rock_5"), q("Rock_3")],
        "rock-tall": [q("Rock_4"), q("Rock_3")],
        "bridge": [kn("nature/bridge_woodNarrow", "kn-forest")],
        "stepping-stones": [kn("nature/path_stone", "kn-forest"), kn("nature/path_stoneCircle", "kn-forest")],
        "fountain": [kn("fantasy-town/fountain-round", "stone-lantern")],
        "fence": [kn("nature/fence_simple", "kn-forest", lengthAxis="x")],
        "gate": [kn("nature/fence_gate", "kn-forest")],
        "shelter": [kn("survival/structure-roof", "flat-wood")],
        "lantern": [kn("holiday/lantern-hanging")],
        "lantern-post": [{"parts": [kn("fantasy-town/pillar-wood", scale=1.3),
                                    kn("holiday/lantern-hanging", pos=[0.18, 0.72, 0], scale=0.85)]}],
        "tent": [kn("nature/tent_detailedOpen", "kn-canvas")],
        "campfire": [kn("nature/campfire_stones", "kn-forest")],
        "bedroll": [kn("survival/bedroll")],
        "cushion": [kn("furniture/pillow"), kn("furniture/pillowBlue")],
        "lectern": [{"parts": [kn("nature/stump_roundDetailed", "kn-forest"),
                               kn("furniture/books", pos=[0, 0.206, 0], yaw=30, scale=1.2)]}],
        "logs": [kn("nature/log_large", "kn-forest"), kn("nature/log_stack", "kn-forest")],
        "mushroom": [kn("nature/mushroom_redGroup", "kn-forest"), kn("nature/mushroom_tanGroup", "kn-forest")],
        "lily": LILY,
    }
    g = Garden(
        6, "pine-clearing", "Pinède et clairière",
        "Une forêt de pins autour d'une clairière ensoleillée. Un ruisseau traverse le bois, un sentier de "
        "terre le franchit par une passerelle ; au bout, un campement : la tente, le feu, le bois coupé.",
        {"shape": "square", "half": 9.0, "slab": 0.75, "top": EARTH, "side": SIDE, "border": None},
        roles, colors={"water": "#5aaec4", "waterLow": "#7aa7ad", "dryBed": "#9a8a70", "lawnDry": FLOOR_DRY})
    stream = smooth([(9.2, -3.2), (6.2, -2.4), (4.4, 0.8), (2.6, 4.2), (-1.0, 5.6), (-4.6, 5.2), (-9.2, 6.6)], 10)
    CL = (-0.6, -0.8)
    trail = smooth([(8.6, 8.6), (6.0, 6.6), (3.6, 4.4), (1.4, 2.0), (CL[0] + 1.2, CL[1] + 1.2)], 8)
    g.label("channels", "Le ruisseau qui traverse le bois")
    g.shape("channels", "poly", points=clip_square(band(stream, 1.9), 9.0), y=0, h=0.05, color=BANK)
    g.shape("channels", "poly", points=clip_square(band(stream, 1.15), 9.0), y=0.05, h=0.012, color="#5aaec4",
            water=True)
    g.label("paving", "Le sentier de terre et sa passerelle")
    cross = min(range(len(trail)), key=lambda i: dist_to_line(trail[i][0], trail[i][1], stream))
    before, after = trail[:max(cross - 3, 2)], trail[cross + 3:]
    g.shape("paving", "poly", points=band(before, 1.05), y=0, h=0.06, color=PATH)
    g.shape("paving", "poly", points=band(after, 1.05), y=0, h=0.06, color=PATH)
    bx, bz = trail[cross]
    p, nxt = trail[cross - 1], trail[cross + 1]
    g.put("paving", "bridge", bx, bz, {"w": 2.6}, y=0.0, yaw=math.degrees(math.atan2(-(nxt[1] - p[1]), nxt[0] - p[0])) + 90)
    plot = [[-9, -9], [9, -9], [9, 9], [-9, 9]]
    north = clip_square(list(stream) + [(-10, -10), (10, -10)], 9.0)
    south = clip_square(list(stream) + [(-10, 10), (10, 10)], 9.0)
    g.label("bed-1", "Le sol de mousse du bois, au nord")
    g.shape("bed-1", "poly", points=clip_half(north, -1, 1, 0), y=0, h=0.03, color=FLOOR, lawn=True, dryColor=FLOOR_DRY)
    g.label("bed-2", "Le sol de mousse du bois, à l'est")
    g.shape("bed-2", "poly", points=clip_half(north, 1, -1, 0), y=0, h=0.03, color=FLOOR, lawn=True, dryColor=FLOOR_DRY)
    g.label("bed-3", "Le sol de mousse au-delà du ruisseau")
    g.shape("bed-3", "poly", points=south, y=0, h=0.03, color=FLOOR, lawn=True, dryColor=FLOOR_DRY)
    g.label("bed-4", "L'herbe claire de la clairière")
    g.shape("bed-4", "poly", points=ellipse(CL[0], CL[1], 3.9, 3.3, 30), y=0.03, h=0.012, color=MEADOW, lawn=True,
            dryColor=MEADOW_DRY)
    del plot

    def ok(x, z, r=0.0):
        return (not in_ellipse(x, z, CL[0], CL[1], 3.9, 3.3, 30, grow=0.4 + r)
                and dist_to_line(x, z, stream) > 1.5 and dist_to_line(x, z, trail) > 1.2)

    rnd = lcg(19)
    spots = []
    while len(spots) < 30:
        x, z = (next(rnd) * 2 - 1) * 8.0, (next(rnd) * 2 - 1) * 8.0
        edge = max(abs(x), abs(z)) > 5.2 or not in_ellipse(x, z, CL[0], CL[1], 3.9, 3.3, 30, grow=2.6)
        if ok(x, z) and edge and all(math.hypot(x - a, z - b) > 1.6 for a, b in spots):
            spots.append((x, z))
    # The tallest pines at the back, the young ones in front.
    spots.sort(key=lambda p: p[0] + p[1])
    names = {"cypress": "Pin", "date-palm": "Grand pin", "olive": "Pin", "fig": "Bouleau",
             "orange": "Pin parasol", "pomegranate": "Jeune pin"}
    roles_by = {"cypress": "tree.pine", "date-palm": "tree.pine", "olive": "tree.pine", "fig": "tree.birch",
                "orange": "tree.pine-wide", "pomegranate": "tree.pine-young"}
    order = sorted(range(30), key=lambda i: (i * 11) % 30)
    for k, (el, species) in enumerate(trees_by_slot(g)):
        x, z = spots[order[k]]
        depth = (x + z) / 18  # -1 at the back, 1 in front
        g.label(el, names[species])
        h = {"tree.pine": 3.6 - 0.7 * depth, "tree.pine-wide": 2.6, "tree.pine-young": 1.8,
             "tree.birch": 3.0}[roles_by[species]]
        if screen_height(x, h, z) > FRAME_TOP - 0.2:
            h = 1.5 + (FRAME_TOP - 0.2 - screen_height(x, 1.5, z)) / CAM_UP[1]
        g.put(el, roles_by[species], x, z, {"h": round(h, 2), "wmax": 2.2}, y=0.03, variant=k)

    g.label("stepping-stones", "Des pierres pour passer le ruisseau, en amont")
    i = 18
    p, nxt = stream[i], stream[i + 1]
    nx, nz = -(nxt[1] - p[1]), nxt[0] - p[0]
    n = math.hypot(nx, nz)
    for k, t in enumerate((-0.5, 0.0, 0.5)):
        g.put("stepping-stones", "stepping-stones", p[0] + nx / n * t, p[1] + nz / n * t, {"w": 0.5}, y=0.065,
              variant=k)
    patches = {"flowers-1": (CL[0] - 1.6, CL[1] + 1.0), "flowers-2": (CL[0] + 1.4, CL[1] - 1.6),
               "flowers-3": (CL[0] - 1.8, CL[1] - 1.4), "flowers-4": (CL[0] + 2.0, CL[1] + 1.2)}
    texts = {"flowers-1": "Des fleurs sauvages dans la clairière", "flowers-2": "Des fleurs sauvages au soleil",
             "flowers-3": "Des fleurs sauvages au bord du bois", "flowers-4": "Des fleurs sauvages près du sentier"}
    for el, (x, z) in patches.items():
        g.label(el, texts[el])
        for dx, dz in [(0, 0), (0.55, 0.3), (-0.3, 0.6), (0.4, -0.45)]:
            g.put(el, "flowers", x + dx, z + dz, {"h": 0.5, "wmax": 0.65}, y=0.042)
    g.label("fountain", "La vasque de pierre de la source du bois")
    g.put("fountain", "fountain", 5.0, -5.6, {"w": 1.2}, y=0.03, yaw=0)
    g.label("springs", "Les sources entre les rochers, en amont du ruisseau")
    for (x, z) in [(7.4, -5.6), (3.6, -7.4)]:
        g.shape("springs", "cyl", at=[x, 0, z], r=0.55, h=0.1, color=BANK)
        g.shape("springs", "disc", at=[x, 0.102, z], r=0.4, color="#5aaec4", water=True)
        for k, (dx, dz, w) in enumerate([(-0.55, -0.45, 0.7), (0.45, -0.55, 0.55)]):
            g.put("springs", "rock", x + dx, z + dz, {"w": w}, y=0.03, variant=k)
    for el in ("birds-1", "birds-2", "birds-3"):
        g.label(el, "Des oiseaux (aucun modèle)")
    g.label("butterflies", "Des papillons (aucun modèle)")
    g.label("wall-north", "La clôture de bois du nord")
    g.line("wall-north", "fence", (-8.6, -8.6), (8.6, -8.6), {"h": 0.7}, y=0.03, gap={"at": [-2.0, -8.6], "width": 1.0})
    g.label("wall-west", "La clôture de bois de l'ouest")
    g.line("wall-west", "fence", (-8.6, 8.6), (-8.6, -8.6), {"h": 0.7}, y=0.03, gap={"at": [-8.6, -2.0], "width": 1.0})
    g.label("gate-north", "Le portillon du nord")
    g.put("gate-north", "gate", -2.0, -8.6, {"w": 1.0}, y=0.03, yaw=0)
    g.label("gate-west", "Le portillon de l'ouest")
    g.put("gate-west", "gate", -8.6, -2.0, {"w": 1.0}, y=0.03, yaw=90)
    CAMP = (CL[0] - 1.4, CL[1] - 0.6)
    g.label("trellis", "L'appentis où sèche le bois")
    g.put("trellis", "shelter", CL[0] + 2.4, CL[1] - 2.0, {"w": 2.0, "hmax": 2.0}, y=0.03, yaw=30)
    g.label("lanterns", "Des lanternes le long du sentier")
    for x, z in [(6.6, 7.6), (4.6, 4.6), (2.4, 3.6), (CL[0] + 1.9, CL[1] + 2.4)]:
        g.put("lanterns", "lantern-post", x, z, {"h": 1.4}, y=0.06, yaw=45)
    g.label("pavilion", "La tente du campement")
    g.put("pavilion", "tent", CAMP[0] - 0.9, CAMP[1] - 0.9, {"w": 2.2}, y=0.042, yaw=45)
    g.label("carpets", "Le feu de camp et une natte")
    g.put("carpets", "campfire", CL[0] + 0.4, CL[1] + 0.4, {"w": 0.8}, y=0.042, yaw=0)
    g.put("carpets", "bedroll", CAMP[0] + 0.5, CAMP[1] + 0.9, {"w": 1.1}, y=0.042, yaw=-30)
    g.label("cushions", "Des coussins autour du feu")
    for k, (dx, dz, yaw) in enumerate([(1.0, 0.1, 20), (0.0, 1.1, 75), (-0.6, -0.6, 140)]):
        g.put("cushions", "cushion", CL[0] + 0.4 + dx, CL[1] + 0.4 + dz, {"w": 0.45}, y=0.042, yaw=yaw, variant=k)
    g.label("lectern", "Une souche et ses livres, près de la tente")
    g.put("lectern", "lectern", CAMP[0] + 1.0, CAMP[1] - 0.5, {"w": 0.5, "hmax": 0.5}, y=0.042, yaw=0)
    g.label("roses", "Des buissons en fleurs à la lisière")
    for k, (x, z) in enumerate([(CL[0] - 3.4, CL[1] + 2.4), (CL[0] + 3.4, CL[1] - 2.2), (CL[0] - 2.4, CL[1] - 3.0),
                                (CL[0] + 2.8, CL[1] + 2.6), (-7.6, 7.6)]):
        g.put("roses", "roses", x, z, {"h": 0.8, "wmax": 1.1}, y=0.03, variant=k)
    g.label("waterfall", "La cascade entre les rochers, où le ruisseau entre dans le bois")
    p, nxt = stream[4], stream[5]
    nx, nz = -(nxt[1] - p[1]), nxt[0] - p[0]
    n = math.hypot(nx, nz)
    g.put("waterfall", "rock-tall", p[0] + nx / n * 1.05, p[1] + nz / n * 1.05, {"h": 1.7, "wmax": 1.2}, y=0, yaw=30)
    g.put("waterfall", "rock-tall", p[0] - nx / n * 1.05, p[1] - nz / n * 1.05, {"h": 1.5, "wmax": 1.2}, y=0, yaw=210,
          variant=1)
    g.put("waterfall", "rock", p[0], p[1], {"w": 1.4, "hmax": 0.7}, y=0, yaw=0)
    yaw = math.degrees(math.atan2(nz, nx))
    g.shape("waterfall", "sheet", at=[p[0] + (nxt[0] - p[0]) * 0.9, 0.36, p[1] + (nxt[1] - p[1]) * 0.9],
            size=[0.9, 0.62], yaw=-yaw + 90, color="#86c9da", water=True)
    g.label("full-bloom", "La pleine floraison : fougères, champignons, herbes, bois coupé, nénuphars")
    rnd = lcg(23)
    k = 0
    while k < 22:
        x, z = (next(rnd) * 2 - 1) * 8.2, (next(rnd) * 2 - 1) * 8.2
        if dist_to_line(x, z, stream) < 1.2 or dist_to_line(x, z, trail) < 0.8:
            continue
        role = ["fern", "fern", "grass", "mushroom", "bush"][k % 5]
        size = {"fern": {"w": 0.8}, "grass": {"h": 0.42, "wmax": 0.6}, "mushroom": {"w": 0.38},
                "bush": {"h": 0.6, "wmax": 0.9}}[role]
        g.put("full-bloom", role, x, z, size, y=0.03, variant=k)
        k += 1
    rnd = lcg(29)
    young = []
    while len(young) < 14:
        x, z = (next(rnd) * 2 - 1) * 8.2, (next(rnd) * 2 - 1) * 8.2
        if ok(x, z, 0.3) and all(math.hypot(x - a, z - b) > 1.2 for a, b in spots + young):
            young.append((x, z))
    for k, (x, z) in enumerate(young):
        g.put("full-bloom", "tree.pine-young", x, z, {"h": 1.3 + 0.4 * (k % 3) / 2, "wmax": 1.2}, y=0.03, variant=k)
    g.put("full-bloom", "logs", CAMP[0] - 1.6, CAMP[1] + 1.2, {"w": 1.4}, y=0.03, yaw=60, variant=0)
    g.put("full-bloom", "logs", CL[0] + 2.4, CL[1] - 2.0, {"w": 0.9}, y=0.03, yaw=30, variant=1)
    for k, i in enumerate((40, 52)):
        p = stream[i]
        g.put("full-bloom", "lily", p[0], p[1] + 0.2, {"w": 0.45}, y=0.062, onWater=True, variant=k)
    g.write()


# =============================================================================================
# Level 7. Night garden: a moonlit canal, glowing lanterns, white flowers that open at night.
# =============================================================================================
def night():
    EARTH, SIDE, BORDER = "#7d7487", "#5f5869", "#d8d3e0"
    LAWN, LAWN_DRY, STONE, GRAVEL = "#5f8c6c", "#a99f80", "#d6d0dc", "#d9d4e2"
    WATER = "#34597c"
    roles = {
        "tree.cypress": [q("PineTree_2", "qs-moon"), q("PineTree_1", "qs-moon")],
        "tree.palm": [q("PalmTree_3"), q("PalmTree_1")],
        "tree.dark": [q("NormalTree_4", "qs-dark", scale=1.15), q("NormalTree_1", "qs-dark", scale=1.2)],
        "tree.moon": [q("NormalTree_3", "qs-moon", scale=1.15), q("NormalTree_5", "qs-moon", scale=1.15)],
        "flowers": [q("Flower_2_Clump", "qs-moon"), q("Flower_1_Clump", "qs-moon"), q("Flower_5_Clump", "qs-moon")],
        "roses": [q("Bush_Flowers", "qs-moon"), q("Bush_Small_Flowers", "qs-moon")],
        "grass": GRASS,
        "rock": [q("Rock_2"), q("Rock_1"), q("Rock_5")],
        "stepping-stones": [kn("nature/path_stone", "kn-night"), kn("nature/path_stoneCircle", "kn-night")],
        "fountain": [kn("fantasy-town/fountain-square-detail")],
        "hedge": [kn("fantasy-town/hedge-large", "night-hedge", lengthAxis="x")],
        "hedge-gate": [kn("fantasy-town/hedge-large-gate", "night-hedge")],
        "pergola": [kn("survival/structure-roof", "flat-night")],
        "lamp": [kn("holiday/lantern", "lamp-glow")],
        "lantern-small": [kn("graveyard/lantern-glass", "lamp-glow")],
        "pavilion": [GAZEBO("pillar-stone", "night-roof")],
        "carpet": [kn("furniture/rugRound")],
        "cushion": [kn("furniture/pillow"), kn("furniture/pillowBlue")],
        "lectern": [LECTERN],
        "candles": [kn("graveyard/candle-multiple", "lamp-glow")],
        "lily": [kn("nature/lily_large", "kn-night"), kn("nature/lily_small", "kn-night")],
        "cascade": [kn("nature/cliff_waterfallTop_stone", "kn-night")],
    }
    g = Garden(
        7, "night-garden", "Jardin de nuit",
        "Un jardin sous la lune : un long canal d'eau sombre mène à un bassin rond, des allées de pierre "
        "pâle, des haies et des cyprès en silhouette ; les lanternes s'allument, les fleurs blanches qui "
        "s'ouvrent la nuit luisent doucement.",
        {"shape": "square", "half": 9.0, "slab": 0.7, "top": EARTH, "topDry": "#7a7177", "side": SIDE,
         "border": {"w": 0.32, "h": 0.24, "color": BORDER}},
        roles, colors={"water": WATER, "waterLow": "#4a6378", "dryBed": "#8a8394", "lawnDry": LAWN_DRY},
        light={"sky": {"color": 0x9db0dc, "ground": 0x2c3048, "intensity": 1.05},
               "sun": {"color": 0xc9d8ff, "intensity": 1.05, "position": [18, 30, -8]},
               "shadowIntensity": 0.62})
    P = (0.0, 0.0)
    g.label("channels", "Le canal d'eau sombre et son bassin rond, sous la lune")
    g.shape("channels", "cyl", at=[0, 0, 0], r=2.25, h=0.16, color=STONE, segments=56)
    g.shape("channels", "disc", at=[0, 0.162, 0], r=1.95, color=WATER, water=True, segments=56)
    # The moon on the water: a pale gleam, gone with the water.
    g.shape("channels", "poly", points=ellipse(-0.35, -0.35, 0.75, 0.32, 45), y=0.164, h=0.002, color="#c9d8f0",
            opacity=0.55, emissive="#8fa6cc", emissiveIntensity=0.8, onlyWet=True, cast=False)
    for s in (-1, 1):
        a, b = 2.0, 8.3
        mid = (a + b) / 2 * s
        g.shape("channels", "box", at=[mid / S2, 0, mid / S2], size=[0.4 + 0.9 * 2, 0.14, b - a], yaw=45, color=STONE)
        g.shape("channels", "box", at=[mid / S2, 0.14, mid / S2], size=[0.9, 0.012, b - a + 0.05], yaw=45, color=WATER,
                water=True)
    g.label("paving", "Les allées de pierre pâle le long du canal")
    for s in (-1, 1):
        for side in (-1, 1):
            line = [uv(side * 1.75, s * 2.4), uv(side * 1.75, s * 8.2)]
            g.shape("paving", "poly", points=band(line, 1.2), y=0, h=0.05, color=GRAVEL)
    g.shape("paving", "poly", points=ellipse(0, 0, 3.0, 3.0, 0, 56), y=0, h=0.045, color=GRAVEL)
    for s in (-1, 1):
        g.shape("paving", "poly", points=band([uv(s * 2.9, 0), uv(s * 8.4, 0)], 1.1), y=0, h=0.05, color=GRAVEL)
    quads = [("bed-1", "La pelouse de l'est", (1, -1)), ("bed-2", "La pelouse de devant", (1, 1)),
             ("bed-3", "La pelouse de l'ouest", (-1, 1)), ("bed-4", "La pelouse du fond", (-1, -1))]
    for el, text, (su, sv) in quads:
        g.label(el, text)
        u0, u1 = sorted((su * 2.45, su * 8.0))
        corners = [uv(u0, -0.0), uv(u1, 0.0)]
        poly = [uv(su * 2.4, sv * 0.5), uv(su * 2.4, sv * 12), uv(su * 12, sv * 12), uv(su * 12, sv * 0.5)]
        poly = clip_square([list(p) for p in poly], IN)
        poly = [p for p in poly]
        g.shape(el, "poly", points=poly, y=0, h=0.03, color=LAWN, lawn=True, dryColor=LAWN_DRY)
        del corners, u0, u1
    # Glow under the lamps arrives with them.
    trees = {"cypress": [], "other": []}
    for su in (-1, 1):
        for v in (-6.6, -3.6, 3.6, 6.6):
            trees["cypress"].append(uv(su * 2.95, v))
    cyp = [p for p in trees["cypress"] if (p[0] + p[1]) < 9.5]
    others = [uv(4.6, -4.8), uv(-4.6, -4.8), uv(4.6, 4.6), uv(-4.6, 4.6), uv(6.6, -2.0), uv(-6.6, -2.0),
              uv(6.4, 2.2), uv(-6.4, 2.2), uv(3.8, -2.0), uv(-3.8, -2.0), uv(5.4, 0.0), uv(-5.4, 0.0),
              uv(3.8, 2.0), uv(-3.8, 2.0), uv(4.6, -7.0), uv(-4.6, -7.0), uv(6.8, 4.8), uv(-6.8, 4.8),
              uv(7.4, -4.8), uv(-7.4, -4.8), uv(3.8, 6.4), uv(-3.8, 6.4), uv(7.8, 0.4), uv(-7.8, 0.4)]
    names = {"cypress": "Cyprès dans la nuit", "date-palm": "Palmier sous la lune", "olive": "Olivier sombre",
             "fig": "Figuier sombre", "pomegranate": "Arbre aux fleurs blanches", "orange": "Oranger en fleurs blanches"}
    role = {"cypress": "tree.cypress", "date-palm": "tree.palm", "olive": "tree.dark", "fig": "tree.dark",
            "pomegranate": "tree.moon", "orange": "tree.moon"}
    cypress_spots, pool = cyp[:5], list(others) + cyp[5:]
    for k, (el, species) in enumerate(trees_by_slot(g)):
        g.label(el, names[species])
        x, z = cypress_spots.pop(0) if species == "cypress" else pool.pop(0)
        size = {"tree.cypress": {"h": 3.2, "wmax": 1.4}, "tree.palm": {"h": 3.6, "wmax": 3.0},
                "tree.dark": {"h": 2.5, "wmax": 2.2}, "tree.moon": {"h": 2.4, "wmax": 2.2}}[role[species]]
        if screen_height(x, size["h"], z) > FRAME_TOP - 0.2:
            size = {**size, "h": round(1.5 + (FRAME_TOP - 0.2 - screen_height(x, 1.5, z)) / CAM_UP[1], 2)}
        g.put(el, role[species], x, z, size, y=0.03, variant=k)
    g.label("stepping-stones", "Des pas japonais dans la pelouse de devant")
    for k, (u, v) in enumerate([(3.0, 2.6), (3.6, 3.2), (4.2, 3.6), (4.9, 3.9)]):
        x, z = uv(u, v)
        g.put("stepping-stones", "stepping-stones", x, z, {"w": 0.6}, y=0.035, variant=k)
    beds = {"flowers-1": uv(3.4, -3.6), "flowers-2": uv(-3.4, 3.4), "flowers-3": uv(-3.4, -3.6), "flowers-4": uv(5.6, 5.6)}
    texts = {"flowers-1": "Des belles-de-nuit, à l'est", "flowers-2": "Des belles-de-nuit, à l'ouest",
             "flowers-3": "Des belles-de-nuit, au fond", "flowers-4": "Des belles-de-nuit, devant"}
    for el, (x, z) in beds.items():
        g.label(el, texts[el])
        for dx, dz in [(0, 0), (0.55, 0.3), (-0.3, 0.6), (0.45, -0.45)]:
            g.put(el, "flowers", x + dx, z + dz, {"h": 0.5, "wmax": 0.65}, y=0.03)
    g.label("fountain", "La fontaine au bout du canal")
    x, z = uv(0, -8.6)
    g.put("fountain", "fountain", -5.95, -5.95, {"w": 1.6}, y=0, yaw=45)
    g.label("springs", "Deux vasques d'eau dans les pelouses")
    for (x, z) in [uv(6.4, -1.0), uv(-6.4, 1.0)]:
        g.shape("springs", "cyl", at=[x, 0, z], r=0.55, h=0.12, color=STONE)
        g.shape("springs", "disc", at=[x, 0.122, z], r=0.42, color=WATER, water=True)
    for el in ("birds-1", "birds-2", "birds-3"):
        g.label(el, "Des oiseaux (aucun modèle)")
    g.label("butterflies", "Des papillons (aucun modèle)")
    g.label("wall-north", "La haie sombre du nord")
    g.line("wall-north", "hedge", (-8.4, -8.45), (8.4, -8.45), {"h": 1.0}, y=0.03, gap={"at": [3.5, -8.45], "width": 1.6})
    g.label("wall-west", "La haie sombre de l'ouest")
    g.line("wall-west", "hedge", (-8.45, 8.4), (-8.45, -8.4), {"h": 1.0}, y=0.03, gap={"at": [-8.45, 3.5], "width": 1.6})
    g.label("gate-north", "Le passage dans la haie du nord")
    g.put("gate-north", "hedge-gate", 3.5, -8.45, {"w": 1.6, "hmax": 1.1}, y=0.03, yaw=0)
    g.label("gate-west", "Le passage dans la haie de l'ouest")
    g.put("gate-west", "hedge-gate", -8.45, 3.5, {"w": 1.6, "hmax": 1.1}, y=0.03, yaw=90)
    g.label("trellis", "La pergola de jasmin")
    x, z = uv(5.8, -5.6)
    g.put("trellis", "pergola", x, z, {"w": 2.1, "hmax": 2.1}, y=0.03, yaw=45)
    g.label("lanterns", "Les lanternes allumées le long du canal, et leur lumière sur la pierre")
    lamps = [uv(s * 2.45, v) for s in (-1, 1) for v in (-5.0, -2.4, 2.4, 5.0)]
    for x, z in lamps:
        g.put("lanterns", "lamp", x, z, {"h": 1.5}, y=0.05, yaw=45)
        glow(g, "lanterns", x, 0.075, z, 1.2)
    g.label("pavilion", "Le pavillon de pierre, au fond du jardin")
    PV = uv(-5.6, -5.4)
    g.shape("pavilion", "box", at=[PV[0], 0, PV[1]], size=[2.6, 0.18, 2.6], yaw=45, color=STONE)
    g.put("pavilion", "pavilion", PV[0], PV[1], {"w": 2.1, "hmax": 2.8}, y=0.18, yaw=45)
    g.label("carpets", "Un tapis rond dans le pavillon")
    g.put("carpets", "carpet", PV[0], PV[1], {"w": 1.5}, y=0.18, yaw=0)
    g.label("cushions", "Des coussins et des bougies dans le pavillon")
    for k, (dx, dz, yaw) in enumerate([(-0.35, 0.25, 0), (0.3, -0.3, 90)]):
        g.put("cushions", "cushion", PV[0] + dx, PV[1] + dz, {"w": 0.45}, y=0.192, yaw=yaw, variant=k)
    g.put("cushions", "candles", PV[0] + 0.55, PV[1] + 0.55, {"w": 0.3}, y=0.18, yaw=0)
    glow(g, "cushions", PV[0] + 0.55, 0.19, PV[1] + 0.55, 0.75)
    g.label("lectern", "Une petite table et ses livres, à la lueur des bougies")
    g.put("lectern", "lectern", PV[0] + 0.25, PV[1] + 0.4, {"w": 0.5, "hmax": 0.45}, y=0.18, yaw=45)
    g.label("roses", "Des buissons aux fleurs blanches")
    for k, (u, v) in enumerate([(7.4, -6.6), (-7.4, -6.6), (7.6, 6.6), (-7.6, 6.6), (2.9, -8.0), (-2.9, -8.0)]):
        x, z = uv(u * 0.85, v * 0.85)
        g.put("roses", "roses", x, z, {"h": 0.8, "wmax": 1.0}, y=0.03, variant=k)
    g.label("waterfall", "La chute d'eau qui nourrit le canal")
    WX, WZ = -7.4, -7.4
    g.put("waterfall", "cascade", WX, WZ, {"w": 1.2, "hmax": 0.6}, y=0, yaw=45)
    g.put("waterfall", "rock", WX - 0.6, WZ + 0.5, {"w": 0.8}, y=0, variant=0)
    g.put("waterfall", "rock", WX + 0.5, WZ - 0.6, {"w": 0.7}, y=0, variant=1)
    g.shape("waterfall", "sheet", at=[WX + 0.42, 0.3, WZ + 0.42], size=[0.6, 0.55], yaw=45, color="#4d7aa0", water=True)
    g.label("full-bloom", "La pleine floraison : nénuphars sur le canal, herbes, petites lanternes au sol")
    for k, v in enumerate((-6.6, -4.4, 3.4, 5.6, 7.2)):
        x, z = uv(0.05 * (-1) ** k, v)
        g.put("full-bloom", "lily", x, z, {"w": 0.45}, y=0.152, onWater=True, variant=k)
    for k, (u, v) in enumerate([(1.2, 1.1), (-1.1, -1.2)]):
        x, z = uv(u * 0.9, v * 0.9)
        g.put("full-bloom", "lily", x, z, {"w": 0.45}, y=0.172, onWater=True, variant=k + 5)
    for k, (u, v) in enumerate([(4.2, -1.0), (-4.2, 1.0), (5.0, 5.8), (-5.0, 5.8)]):
        x, z = uv(u, v)
        g.put("full-bloom", "lantern-small", x, z, {"h": 0.4}, y=0.03, yaw=45)
        glow(g, "full-bloom", x, 0.05, z, 0.7)
    rnd = lcg(41)
    for k in range(10):
        u, v = (next(rnd) * 2 - 1) * 7.0, (next(rnd) * 2 - 1) * 7.0
        if abs(u) < 2.6:
            continue
        x, z = uv(u, v)
        if max(abs(x), abs(z)) < 8.2:
            g.put("full-bloom", "grass", x, z, {"h": 0.4, "wmax": 0.55}, y=0.03, variant=k)
    g.write()


def prettier():
    """The JSON as the repository's formatter writes it (npm run format:check)."""
    import subprocess
    files = [os.path.join(OUT, f"level-{n}", name) for n in range(2, 8) for name in ("layout.json", "pack.json")]
    subprocess.run([os.path.join(os.path.dirname(os.path.dirname(TOOL)), "node_modules", ".bin", "prettier"),
                    "--write", "--log-level", "warn", *files], check=True)


if __name__ == "__main__":
    oasis()
    orchard()
    mountain()
    cherry()
    pines()
    night()
    prettier()
