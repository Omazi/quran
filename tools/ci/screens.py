"""The pictures the iOS check takes, in one place.

    python3 tools/ci/screens.py plan     # one tab-separated line per picture, read by ios-check.yml
    python3 tools/ci/screens.py names    # the file names

`.github/workflows/ios-check.yml` takes the pictures from this list; `tools/ci/publish-screens.py`
keeps from the artifact only the names this list gives, whatever else the artifact holds. The
screens are opened by launch arguments that only a build made for the check understands
(`src/features/screen-check`, docs/BUILD.md).
"""

import sys

# The one text file of the crash hunt that may be published next to the pictures
# (tools/ci/crash-report.py writes it; publish-screens.py checks it). Its first line is
# "VERDICT: " and one of these words.
CRASH_REPORT = "crash-report.txt"
CRASH_VERDICTS = ("OK", "CRASH", "INCOMPLETE")

# The pages of the first-launch flow (src/features/onboarding/pages.ts). A test of the app
# (src/features/screen-check/__tests__/door.test.ts) fails when this number is not the app's.
ONBOARDING_PAGES = 16

LANGUAGES = {
    "fr": ("fr_FR", "français"),
    "en": ("en_US", "anglais"),
    "ar": ("ar_SA", "arabe"),
}
LOOKS = {"light": ("clair", "mode clair"), "dark": ("sombre", "mode sombre")}

# Screens opened after the app is filled with its made-up history: (slug, label, launch screen,
# page, script, seconds to wait once it is open).
FILLED_SCREENS = [
    ("jardin", "Jardin (accueil)", "garden", None, None, 5),
    ("coran", "Onglet Coran", "quran", None, None, 0),
    ("lecteur-uthmani", "Lecteur, écriture uthmani, page 3", "reader", 3, "uthmani", 4),
    ("lecteur-simple", "Lecteur, écriture simple, page 3", "reader", 3, "imlaei", 4),
    ("ecoute", "Écoute et reconnaissance (prête, micro éteint)", "listening", None, None, 2),
    ("proches", "Onglet Proches", "friends", None, None, 2),
    ("proche-jardin", "Jardin d'un proche (démonstration)", "friend", None, None, 2),
    ("profil", "Profil", "profile", None, None, 0),
    ("reglages", "Réglages", "settings", None, None, 0),
]

# Screens of the levels and badges (D46), opened after the app is filled with the gardens history
# (one khatma completed, the next under way: -screenCheckSeed gardens). Same fields.
GARDEN_SCREENS = [
    ("profil-badges", "Profil : niveau, jardin en cours, badges", "profile", None, None, 1),
    ("mes-jardins", "Mes jardins (chemin des niveaux)", "gardens", None, None, 1),
    ("khatma-terminee", "Khatma terminée (célébration)", "khatma", None, None, 3),
]

DEFAULT_WAIT = 9  # seconds between the launch and the picture; "wait" adds to it


class Shot:
    # seed: the made-up history to fill the app with ("demo", "gardens"), or None for a first launch.
    def __init__(self, name, label, group, look, language, screen, page=None, script=None, seed=None, wait=0):
        self.name, self.label, self.group = name, label, group
        self.look, self.language = look, language
        self.screen, self.page, self.script, self.seed, self.wait = screen, page, script, seed, wait


def _suffix(language, look):
    return f"{language}-{LOOKS[look][0]}"


def _how(language, look):
    return f"{LANGUAGES[language][1]}, {LOOKS[look][1]}"


def build() -> list[Shot]:
    shots: list[Shot] = []

    def introduction(language, look, pages):
        group = f"Introduction du premier lancement ({_how(language, look)})"
        for page in pages:
            shots.append(
                Shot(
                    f"intro-{page:02d}-{_suffix(language, look)}.png",
                    f"Page {page} sur {ONBOARDING_PAGES}",
                    group,
                    look,
                    language,
                    "onboarding",
                    page=page,
                )
            )

    def filled(language, look, only=None):
        group = f"Écrans de l'appli ({_how(language, look)})"
        screens_and_seeds = [(entry, "demo") for entry in FILLED_SCREENS] + [
            (entry, "gardens") for entry in GARDEN_SCREENS
        ]
        for (slug, label, screen, page, script, wait), seed in screens_and_seeds:
            if only is not None and slug not in only:
                continue
            shots.append(
                Shot(
                    f"ecran-{slug}-{_suffix(language, look)}.png",
                    label,
                    group,
                    look,
                    language,
                    screen,
                    page=page,
                    script=script,
                    seed=seed,
                    wait=wait,
                )
            )

    # The introduction first: once the app is filled, the flow is the replay of the settings.
    # Arabic comes before the filling too, so that it is photographed in its first-launch state.
    all_pages = range(1, ONBOARDING_PAGES + 1)
    introduction("fr", "light", all_pages)
    introduction("fr", "dark", all_pages)
    introduction("en", "light", [1])
    introduction("ar", "light", all_pages)
    filled("fr", "light")
    filled("fr", "dark")
    filled("en", "light", only={"jardin"})
    filled("ar", "light", only={"jardin", "profil-badges"})
    return shots


SHOTS = build()
EXPECTED = {shot.name: f"{shot.label} ({_how(shot.language, shot.look)})" for shot in SHOTS}


def plan() -> str:
    lines = []
    for shot in SHOTS:
        locale = LANGUAGES[shot.language][0]
        fields = [
            shot.name[: -len(".png")],
            shot.look,
            shot.language,
            locale,
            shot.screen,
            "" if shot.page is None else str(shot.page),
            shot.script or "",
            shot.seed or "",
            str(DEFAULT_WAIT + shot.wait),
        ]
        # An empty field would be swallowed by `read` with a tab separator: "-" says "none".
        lines.append("\t".join(field or "-" for field in fields))
    return "\n".join(lines)


if __name__ == "__main__":
    if sys.argv[1:] == ["plan"]:
        print(plan())
    elif sys.argv[1:] == ["names"]:
        print("\n".join(EXPECTED))
    else:
        print(__doc__)
        sys.exit(2)
