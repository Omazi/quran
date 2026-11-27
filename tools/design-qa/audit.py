"""The polish audit of a screen: measures, then lists what is off (docs/design/POLISH-CHECKLIST.md).

    python3 tools/design-qa/audit.py mockup <mockup folder> [shot names...] --out <folder>
    python3 tools/design-qa/audit.py app <web export folder> [routes...] --out <folder>
        [--scheme light|dark] [--locale fr-FR] [--settings '{"readerScript":"imlaei"}']

`mockup` drives the animated mockup with its own `tools/shoot.py` list, so each state audited is
the state photographed. `app` opens an `npx expo export --platform web` folder with the
introduction marked as done. For each screen it writes `<name>.png` and `<name>.json` in the output
folder, prints the findings, and ends with a non-zero status if a finding is a defect.

A finding first comes from the page's own measures (audit.js); each centring finding is then
measured again on the pixels (ink.py: the text shown, the text hidden, the difference) and the
pixel measure is the one reported.
"""

from __future__ import annotations

import contextlib
import functools
import http.server
import importlib.util
import io
import json
import sys
import threading
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import ink  # noqa: E402

VIEWPORT = {"width": 393, "height": 852}
SCALE = 2
CHROMIUM = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]

# The tolerances, in points (CSS pixels). See POLISH-CHECKLIST.md for where they come from.
OFF_CENTRE = 1.0
TIGHT_INK = 2.0
ICON_OFF = 1.0
BASELINE_NEAR_MISS = (0.75, 4.0)
TOUCH_TARGET = 44
# A pill, a button, a title frame: taller than this, a box is a card and its text is laid out, not centred.
FRAME_LIMIT = 96
MAX_PIXEL_CHECKS = 12


def overlap(a: tuple[float, float], b: tuple[float, float]) -> float:
    return max(0.0, min(a[1], b[1]) - max(a[0], b[0]))


def is_system_font(text: dict) -> bool:
    """The phone's own font, which this machine does not have: its place is read on an iOS photo."""
    return any(name in text["font"] for name in ("-apple-system", "system-ui", "BlinkMacSystemFont"))


def findings(report: dict) -> list[dict]:
    """What is off in one audited screen. Pure: `report` is what `designAudit()` returned."""
    found: list[dict] = []
    texts = report["texts"]
    # Icons are small pictures and the glyphs of an icon font; the second kind is measured by ink.
    icons = [dict(icon) for icon in report["icons"]] + [
        {"element": t["element"], "row": None, "rowBox": None, "box": t["ink"], "container": (t.get("container") or {}).get("box")}
        for t in texts if t.get("glyphIcon") and "ink" in t
    ]

    by_container: dict[tuple, list[dict]] = {}
    for text in texts:
        if text.get("truncated"):
            found.append({"rule": "tronqué", "defect": True, "text": text["text"], "where": text["element"],
                          "measure": f"il faut {text['truncated']['needs']} pt, il y en a {text['truncated']['has']}"})
        container = text.get("container")
        if container:
            by_container.setdefault((container["element"], tuple(container["box"])), []).append(text)

    for (name, box), group in by_container.items():
        height = box[3] - box[1]
        for text in group:
            if text.get("glyphIcon"):
                continue
            margins = text["container"]["inkMargins"]
            if min(margins["top"], margins["bottom"]) < -0.5:
                found.append({"rule": "déborde", "defect": True, "text": text["text"], "where": name, "index": text["index"], "container": list(box),
                              "measure": f"encre à {margins['top']:.1f} pt du haut et {margins['bottom']:.1f} pt du bas d'un cadre de {height:.0f} pt"})
            elif min(margins["top"], margins["bottom"]) < TIGHT_INK and text["container"]["sole"]:
                found.append({"rule": "serré", "defect": True, "text": text["text"], "where": name, "index": text["index"], "container": list(box),
                              "measure": f"encre à {margins['top']:.1f} pt du haut et {margins['bottom']:.1f} pt du bas"})
        stacks: dict[tuple, list[dict]] = {}
        for text in group:
            if text.get("column"):
                stacks.setdefault(tuple(text["column"]), []).append(text)
        for column, members in stacks.items():
            if not all(t.get("columnOfInk") for t in members):
                continue
            # An icon over its label, two lines in a pill: the stack is centred as one block, from
            # the top of its first piece to the baseline band of its last line.
            inside = [i for i in icons if column[0] - 1 <= i["box"][0] and i["box"][2] <= column[2] + 1 and column[1] - 1 <= i["box"][1] and i["box"][3] <= column[3] + 1]
            top = min([t["band"][0] for t in members] + [i["box"][1] for i in inside])
            bottom = max([t["band"][1] for t in members] + [i["box"][3] for i in inside])
            offset = (top + bottom) / 2 - (box[1] + box[3]) / 2
            if height <= FRAME_LIMIT and abs(offset) > OFF_CENTRE:
                found.append({"rule": "pile décentrée", "defect": not any(is_system_font(t) for t in members), "text": " / ".join(t["text"] for t in members), "where": name,
                              "measure": f"le bloc (icône et texte, ou deux lignes) est {abs(offset):.1f} pt trop {'bas' if offset > 0 else 'haut'} dans {height:.0f} pt"})
        group = [t for t in group if not t.get("column") and not t.get("glyphIcon")]
        # Texts on several rows of a card are laid out, not centred: only one row is measured.
        one_row = all(overlap((a["box"][1], a["box"][3]), (b["box"][1], b["box"][3])) > 0 for a in group for b in group)
        if not one_row:
            continue
        # Side by side on one baseline, the largest text is the one that is centred; a smaller one
        # beside it ("5 /8", the two A of a text-size button) follows its baseline.
        tallest = max((t["band"][1] - t["band"][0] for t in group), default=0)
        for text in group:
            if text["band"][1] - text["band"][0] < tallest - 0.5:
                continue
            offset = text["container"]["bandOffset"]
            if height <= FRAME_LIMIT and abs(offset) > OFF_CENTRE:
                found.append({"rule": "décentré", "defect": not is_system_font(text), "text": text["text"], "where": name, "index": text["index"], "container": list(box),
                              "measure": f"{abs(offset):.1f} pt trop {'bas' if offset > 0 else 'haut'} (bande {text['band'][2]}) dans {height:.0f} pt"})
            if text["container"]["sole"] and text["container"].get("pressable"):
                side = (text["container"]["inkMargins"]["left"] - text["container"]["inkMargins"]["right"]) / 2
                if abs(side) > 1.5 and box[2] - box[0] < 360:
                    found.append({"rule": "décentré (horizontal)", "defect": True, "text": text["text"], "where": name, "index": text["index"], "container": list(box),
                                  "measure": f"{abs(side):.1f} pt trop à {'droite' if side > 0 else 'gauche'}"})

    for icon in icons:
        row = icon.get("rowBox")
        middle = (icon["box"][1] + icon["box"][3]) / 2
        for text in texts:
            if not text["single"] or "band" not in text or text.get("glyphIcon"):
                continue
            shares = icon.get("container") is not None and icon["container"] == (text.get("container") or {}).get("box")
            inside = row is not None and row[0] - 1 <= text["box"][0] and text["box"][2] <= row[2] + 1 and row[1] - 1 <= text["box"][1] and text["box"][3] <= row[3] + 1
            beside = overlap((icon["box"][1], icon["box"][3]), (text["band"][0], text["band"][1])) > 0
            near = 0 <= max(text["box"][0], icon["box"][0]) - min(text["box"][2], icon["box"][2]) < 24
            if (inside or shares) and beside and near and not text.get("column"):
                offset = (text["band"][0] + text["band"][1]) / 2 - middle
                if abs(offset) > ICON_OFF:
                    found.append({"rule": "icône et texte", "defect": not is_system_font(text), "text": text["text"], "where": icon.get("row") or text["container"]["element"],
                                  "measure": f"le texte est {abs(offset):.1f} pt plus {'bas' if offset > 0 else 'haut'} que le milieu de l'icône"})

    singles = [t for t in texts if t["single"] and "baseline" in t and not t.get("glyphIcon")]
    for i, a in enumerate(singles):
        for b in singles[i + 1:]:
            same_row = a.get("container", {}).get("box") == b.get("container", {}).get("box") and a.get("container")
            gap = max(a["box"][0], b["box"][0]) - min(a["box"][2], b["box"][2])
            share = overlap((a["box"][1], a["box"][3]), (b["box"][1], b["box"][3])) > 0.5 * min(a["box"][3] - a["box"][1], b["box"][3] - b["box"][1])
            apart = abs(a["baseline"] - b["baseline"])
            if same_row and share and 0 <= gap < 12 and BASELINE_NEAR_MISS[0] <= apart <= BASELINE_NEAR_MISS[1]:
                found.append({"rule": "lignes de base", "defect": True, "text": f"{a['text']} | {b['text']}", "where": a["container"]["element"],
                              "measure": f"{apart:.1f} pt d'écart entre les deux lignes de base"})

    for target in report["targets"]:
        if min(target["width"], target["height"]) < TOUCH_TARGET - 0.5:
            found.append({"rule": "cible tactile", "defect": False, "text": target["label"], "where": target["element"],
                          "measure": f"{target['width']:.0f} × {target['height']:.0f} pt (44 demandés ; vérifier la zone élargie dans le code)"})
    return found


def confirm_on_pixels(page, finding: dict, offset: tuple[float, float] = (0, 0)) -> str | None:
    """Measures one centring finding again on two captures: its text shown, then hidden."""
    from PIL import Image

    box = finding.get("container")
    if box is None or "index" not in finding:
        return None
    pad = 12
    clip = {"x": box[0] - pad, "y": box[1] - pad, "width": box[2] - box[0] + 2 * pad, "height": box[3] - box[1] + 2 * pad}
    shown = Image.open(io.BytesIO(page.screenshot(clip=clip)))
    page.evaluate("(i) => designAuditInk(i, false)", finding["index"])
    hidden = Image.open(io.BytesIO(page.screenshot(clip=clip)))
    page.evaluate("(i) => designAuditInk(i, true)", finding["index"])
    found = ink.difference_box(shown, hidden)
    if found is None:
        return None
    scale = shown.width / clip["width"]
    container = (round(pad * scale), round(pad * scale), round(shown.width - pad * scale), round(shown.height - pad * scale))
    return ink.describe(ink.centring(container, found), scale)


def audit_page(page, name: str, out: Path, options: dict) -> list[dict]:
    page.add_script_tag(path=str(HERE / "audit.js"))
    report = page.evaluate("(o) => designAudit(o)", options)
    found = findings(report)
    # A 3D scene behind a glass would move between two captures (and is slow to draw): hidden
    # while the ink is measured.
    page.add_style_tag(content="html.design-audit-ink canvas, html.design-audit-ink video { visibility: hidden !important; }")
    page.evaluate("document.documentElement.classList.add('design-audit-ink')")
    for finding in [f for f in found if "container" in f][:MAX_PIXEL_CHECKS]:
        pixels = confirm_on_pixels(page, finding)
        if pixels:
            finding["pixels"] = pixels
    page.evaluate("document.documentElement.classList.remove('design-audit-ink')")
    out.mkdir(parents=True, exist_ok=True)
    (out / f"{name}.json").write_text(json.dumps({"report": report, "findings": found}, ensure_ascii=False, indent=1))
    defects = [f for f in found if f["defect"]]
    print(f"== {name}: {len(defects)} défaut(s), {len(found) - len(defects)} à vérifier", flush=True)
    for finding in found:
        mark = "DÉFAUT" if finding["defect"] else "à voir"
        print(f"   [{mark}] {finding['rule']} : « {finding['text']} » dans {finding['where']} : {finding['measure']}"
              + (f" || pixels : {finding['pixels']}" if finding.get("pixels") else ""), flush=True)
    return found


# ------------------------------------------------------------------------------------- the mockup

def load(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.path.insert(0, str(path.parent))
    spec.loader.exec_module(module)
    return module


NO_WEBGL = """(() => {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
    return /webgl/i.test(kind) ? null : original.call(this, kind, ...rest);
  };
})()"""


def audit_mockup(root: Path, only: list[str], out: Path, shoot_too: bool) -> int:
    from playwright.sync_api import sync_playwright

    shoot = load(root / "tools" / "shoot.py", "mockup_shoot")
    pump = shoot.pump
    defects = 0

    def one(browser, name, hour, setup, flow, at) -> int:
        page = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=SCALE)
        page.set_default_timeout(240000)
        if not shoot_too:
            # Measuring needs the page, not the 3D garden behind it, which is slow to draw without
            # a graphics card: the mockup runs without its garden when WebGL is refused.
            page.add_init_script(NO_WEBGL)
        page.goto((root / "index.html").as_uri() + f"?shot=1&t={hour}")
        page.wait_for_function("document.documentElement.dataset.ready")
        page.wait_for_timeout(1500)
        if not flow:
            page.evaluate("FX.setAnnot(false)")
        pump.start(page)
        if setup:
            pump.run(page, "(async () => { " + setup + " })()")
            pump.advance(page, 500)
        if flow:
            page.evaluate("() => { " + flow + " }")
            pump.advance(page, at, 50)
            page.wait_for_timeout(200)
        else:
            pump.advance(page, 1500, 250)
        if shoot_too:
            out.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(out / f"{name}.png"))
        found = audit_page(page, name, out, {"root": ".phone", "frame": ".phone"})
        page.close()
        return sum(1 for f in found if f["defect"])

    with sync_playwright() as p:
        browser = p.chromium.launch(args=shoot.ARGS)
        for name, hour, setup, flow, at in shoot.SHOTS:
            if only and not any(name.startswith(o) or o in name for o in only):
                continue
            if flow and isinstance(at, str):
                continue  # a drop caught in the air: nothing to align
            browser, count = with_retries(p, browser, shoot.ARGS, name, lambda b: one(b, name, hour, setup, flow, at))
            defects += count
        browser.close()
    return defects


def with_retries(playwright, browser, arguments, name, work, attempts: int = 3):
    """Runs `work(browser)`; a page can crash when the machine is loaded: new browser, again."""
    for attempt in range(attempts):
        try:
            return browser, work(browser)
        except Exception as error:  # noqa: BLE001 - whatever closed the page, the answer is to retry
            print(f"== {name}: nouvel essai {attempt + 1} ({str(error).splitlines()[0][:90]})", flush=True)
            with contextlib.suppress(Exception):
                browser.close()
            browser = playwright.chromium.launch(args=arguments)
    print(f"== {name}: ABANDONNÉ après {attempts} essais", flush=True)
    return browser, 0


# ---------------------------------------------------------------------------------------- the app

class SinglePage(http.server.SimpleHTTPRequestHandler):
    """A web export has one page: every address that is not a file is that page."""

    def log_message(self, *arguments):
        pass

    def send_head(self):
        if not Path(self.translate_path(self.path.split("?")[0])).is_file():
            self.path = "/index.html"
        return super().send_head()


@contextlib.contextmanager
def serve(root: Path):
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(SinglePage, directory=str(root)))
    server.handle_error = lambda *arguments: None  # a page closed while a file was being sent
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        yield f"http://127.0.0.1:{server.server_address[1]}"
    finally:
        server.shutdown()


def open_app(browser, base: str, scheme: str, locale: str, settings: dict):
    """A phone-sized page of the app whose introduction is done, with the settings asked."""
    context = browser.new_context(viewport=VIEWPORT, device_scale_factor=SCALE, color_scheme=scheme, locale=locale)
    page = context.new_page()
    page.set_default_timeout(120000)
    page.goto(base + "/")
    page.wait_for_function("localStorage.getItem('app-data') !== null")
    page.wait_for_timeout(1500)
    data = json.loads(page.evaluate("localStorage.getItem('app-data')"))
    data["settings"].update({"onboardingCompleted": True, "genderAsked": True, "gender": "male", **settings})
    text = json.dumps(data)
    context.add_init_script(
        "(() => { const t = %s; localStorage.setItem('app-data', t); localStorage.setItem('app-data-backup', t); })()"
        % json.dumps(text)
    )
    return page


def route_name(route: str) -> str:
    return route.strip("/").replace("(", "").replace(")", "").replace("/", "-").replace("?", "-").replace("=", "-") or "accueil"


def audit_app(dist: Path, routes: list[str], out: Path, scheme: str, locale: str, settings: dict, wait: int) -> int:
    from playwright.sync_api import sync_playwright

    defects = 0

    def one(browser, route: str, name: str) -> int:
        page = open_app(browser, base, scheme, locale, settings)
        page.goto(base + route)
        page.wait_for_timeout(wait)
        out.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(out / f"{name}.png"))
        found = audit_page(page, name, out, {})
        page.context.close()
        return sum(1 for f in found if f["defect"])

    with serve(dist) as base, sync_playwright() as p:
        browser = p.chromium.launch(args=CHROMIUM)
        for route in routes:
            name = f"{route_name(route)}-{locale[:2]}-{scheme}"
            browser, count = with_retries(p, browser, CHROMIUM, name, lambda b: one(b, route, name))
            defects += count
        browser.close()
    return defects


def option(argv: list[str], name: str, default: str) -> str:
    if name in argv:
        at = argv.index(name)
        value = argv[at + 1]
        del argv[at:at + 2]
        return value
    return default


def main(argv: list[str]) -> int:
    if len(argv) < 2 or argv[0] not in ("mockup", "app"):
        print(__doc__)
        return 2
    out = Path(option(argv, "--out", "design-qa-out"))
    scheme = option(argv, "--scheme", "light")
    locale = option(argv, "--locale", "fr-FR")
    settings = json.loads(option(argv, "--settings", "{}"))
    wait = int(option(argv, "--wait", "7000"))
    shoot_too = "--no-shots" not in argv
    argv = [a for a in argv if a != "--no-shots"]
    kind, root, names = argv[0], Path(argv[1]).resolve(), argv[2:]
    if kind == "mockup":
        defects = audit_mockup(root, names, out, shoot_too)
    else:
        defects = audit_app(root, names or ["/"], out, scheme, locale, settings, wait)
    print(f"\n{defects} défaut(s) au total")
    return 1 if defects else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
