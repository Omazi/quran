"""Tests of the polish tools. Run: python3 -m unittest discover -s tools/design-qa -p "test_*.py" """

import pathlib
import re
import sys
import unittest

from PIL import Image, ImageDraw, features

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))

import audit  # noqa: E402
import font_band  # noqa: E402
import ink  # noqa: E402

AMIRI_BOLD = ROOT / "node_modules" / "@expo-google-fonts" / "amiri" / "700Bold" / "Amiri_700Bold.ttf"


def picture(box, mark, background=(30, 28, 24), colour=(217, 164, 65)):
    image = Image.new("RGB", (200, 100), background)
    ImageDraw.Draw(image).rectangle([mark[0], mark[1], mark[2] - 1, mark[3] - 1], fill=colour)
    return image


class InkOnAPicture(unittest.TestCase):
    def test_finds_the_ink_and_how_far_it_is_from_the_middle(self):
        box = (20, 10, 180, 90)
        image = picture(box, (60, 40, 140, 70))
        found = ink.ink_box(image, box)
        self.assertEqual(found, (60, 40, 140, 70))
        measure = ink.centring(box, found)
        self.assertEqual((measure.top, measure.bottom, measure.left, measure.right), (30, 20, 40, 40))
        self.assertEqual(measure.dy, 5)  # five pixels low
        self.assertEqual(measure.dx, 0)
        self.assertFalse(measure.overflows)

    def test_sees_ink_that_leaves_its_box(self):
        box = (20, 30, 180, 60)
        image = picture(box, (60, 40, 140, 70))
        found = ink.ink_box(image, box, search=(20, 0, 180, 100), background=(30, 28, 24))
        self.assertTrue(ink.centring(box, found).overflows)

    def test_the_ink_of_one_text_is_what_changes_when_it_is_hidden(self):
        shown = picture(None, (60, 40, 140, 70))
        hidden = Image.new("RGB", (200, 100), (30, 28, 24))
        self.assertEqual(ink.difference_box(shown, hidden), (60, 40, 140, 70))

    def test_reads_the_box_of_a_button_and_the_baseline_of_its_label_on_a_photo(self):
        image = Image.new("RGB", (300, 120), (250, 244, 232))
        draw = ImageDraw.Draw(image)
        draw.rounded_rectangle([40, 30, 259, 89], radius=30, fill=(31, 92, 69))
        for x in range(100, 200, 12):  # letters standing on the row 70
            draw.rectangle([x, 50, x + 7, 69], fill=(255, 255, 255))
        draw.rectangle([124, 50, 131, 77], fill=(255, 255, 255))  # one descender
        box = ink.container_at(image, (60, 60))
        self.assertEqual(box, (40, 30, 260, 90))
        found, baseline = ink.band_of_label(image, box)
        self.assertEqual((found[1], found[3]), (50, 78))
        self.assertEqual(baseline, 70)


def text(label, band, box, container, **more):
    entry = {
        "index": 0, "text": label, "element": "span", "font": "700 30px Amiri Quran", "single": True,
        "box": box, "band": [band[0], band[1], "arabic"], "ink": [box[0], band[0] - 4, box[2], band[1] + 6],
        "baseline": band[1],
        "container": {
            "element": "div.frame", "box": container, "sole": True, "pressable": False,
            "bandOffset": (band[0] + band[1]) / 2 - (container[1] + container[3]) / 2,
            "inkMargins": {"top": band[0] - 4 - container[1], "bottom": container[3] - band[1] - 6,
                           "left": box[0] - container[0], "right": container[2] - box[2]},
        },
    }
    entry.update(more)
    return entry


def report(*texts, icons=(), targets=()):
    return {"texts": list(texts), "icons": list(icons), "targets": list(targets)}


class Findings(unittest.TestCase):
    def rules(self, found):
        return [finding["rule"] for finding in found if finding["defect"]]

    def test_a_title_in_the_middle_of_its_frame_is_fine(self):
        centred = text("سورة الكهف", (22, 52), (100, 10, 240, 64), [20, 0, 320, 74])
        self.assertEqual(self.rules(audit.findings(report(centred))), [])

    def test_a_title_that_sits_low_is_a_defect(self):
        low = text("سورة الكهف", (32, 62), (100, 20, 240, 74), [20, 0, 320, 74])
        self.assertIn("décentré", self.rules(audit.findings(report(low))))

    def test_ink_through_the_frame_is_a_defect(self):
        through = text("سورة الكهف", (40, 70), (100, 28, 240, 82), [20, 0, 320, 74])
        self.assertIn("déborde", self.rules(audit.findings(report(through))))

    def test_a_cut_label_is_a_defect(self):
        cut = text("Uthmani", (22, 52), (100, 10, 240, 64), [20, 0, 320, 74], truncated={"needs": 90, "has": 28})
        self.assertIn("tronqué", self.rules(audit.findings(report(cut))))

    def test_the_phone_font_is_not_judged_on_a_machine_that_lacks_it(self):
        low = text("Lire", (32, 62), (100, 20, 240, 74), [20, 0, 320, 74], font="600 17px -apple-system")
        found = audit.findings(report(low))
        self.assertEqual(self.rules(found), [])
        self.assertIn("décentré", [finding["rule"] for finding in found])

    def test_an_icon_and_its_text_share_a_middle(self):
        label = text("5", (30, 44), (60, 26, 70, 48), [20, 0, 320, 74], font="700 16px InterUI")
        label["container"]["sole"] = False
        low_icon = {"element": "svg", "row": "span.rd-count", "rowBox": [30, 20, 80, 60], "box": [34, 40, 52, 58]}
        self.assertIn("icône et texte", self.rules(audit.findings(report(label, icons=[low_icon]))))
        level_icon = dict(low_icon, box=[34, 28, 52, 46])
        self.assertNotIn("icône et texte", self.rules(audit.findings(report(label, icons=[level_icon]))))

    def test_two_figures_side_by_side_stand_on_one_baseline(self):
        five = text("5", (30, 44), (60, 26, 70, 48), [20, 0, 320, 74], font="700 16px InterUI", baseline=44)
        goal = text("/8", (31, 41.5), (74, 28, 90, 46), [20, 0, 320, 74], font="500 13px InterUI", baseline=41.5)
        self.assertIn("lignes de base", self.rules(audit.findings(report(five, goal))))

    def test_a_small_target_is_listed_to_be_checked_in_the_code(self):
        small = {"element": "button", "label": "Fermer", "box": [0, 0, 30, 30], "width": 30, "height": 30}
        found = audit.findings(report(targets=[small]))
        self.assertEqual([finding["rule"] for finding in found], ["cible tactile"])
        self.assertFalse(found[0]["defect"])


@unittest.skipUnless(features.check("raqm") and AMIRI_BOLD.exists(), "needs Pillow with libraqm and the fonts")
class TheNumbersTheAppKeeps(unittest.TestCase):
    """`src/ui/ink-centre.ts` keeps what `font_band.py` measures on the font file."""

    def kept(self):
        source = (ROOT / "src" / "ui" / "ink-centre.ts").read_text()
        block = re.search(r"quranTitle: \{(.*?)\}", source, re.S).group(1)
        return {name: float(value) for name, value in re.findall(r"(\w+): ([\d.]+)", block)}

    def test_the_line_of_the_title_font(self):
        ascent, descent = font_band.line_metrics(str(AMIRI_BOLD))
        self.assertAlmostEqual(self.kept()["ascent"], ascent, places=3)
        self.assertAlmostEqual(self.kept()["descent"], descent, places=3)

    def test_the_band_and_the_furthest_ink_of_the_114_titles(self):
        titles = font_band.surah_titles()
        self.assertEqual(len(titles), 114)
        top, bottom = font_band.median_band(str(AMIRI_BOLD), titles)
        bands = [font_band.ink_band(str(AMIRI_BOLD), title) for title in titles]
        kept = self.kept()
        self.assertAlmostEqual(kept["bandTop"], top, delta=0.006)
        self.assertAlmostEqual(kept["bandBottom"], bottom, delta=0.006)
        self.assertAlmostEqual(kept["inkTop"], max(band[0] for band in bands), delta=0.006)
        self.assertAlmostEqual(kept["inkBottom"], max(band[1] for band in bands), delta=0.006)


if __name__ == "__main__":
    unittest.main()
