"""Prepares the pictures of the app's first screen for the branch `ci-screens`.

    python3 tools/ci/publish-screens.py <downloaded artifact> <output folder> --run 123 --sha abc

The artifact `ios-first-screen` comes from a job that ran the whole build, third-party tools
included, so it is read as untrusted data: nothing in it is executed, only the four pictures the
iOS check is known to take are kept, and each one must really be a PNG of a plausible size. The
build log that travels in the same artifact is left behind.

The output folder receives the pictures and a README.md that shows them with a label each. The
workflow `.github/workflows/ios-screens.yml` then replaces the branch with that folder.
"""

import argparse
import os
import pathlib
import re
import struct
import sys

# File name -> label shown above the picture. The names are those of ios-check.yml.
EXPECTED = {
    "1-francais-clair.png": "Français, mode clair",
    "2-francais-sombre.png": "Français, mode sombre",
    "3-anglais-clair.png": "Anglais, mode clair",
    "4-arabe-clair.png": "Arabe, mode clair (mise en page de droite à gauche)",
}

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
MAX_BYTES = 15 * 1024 * 1024
MAX_SIDE = 4000  # an iPhone screenshot is at most 1320 x 2868 pixels today


def png_size(data: bytes) -> tuple[int, int] | None:
    """Width and height when `data` starts like a PNG file, otherwise nothing."""
    if len(data) < 33 or not data.startswith(PNG_SIGNATURE) or data[12:16] != b"IHDR":
        return None
    width, height = struct.unpack(">II", data[16:24])
    if not (0 < width <= MAX_SIDE and 0 < height <= MAX_SIDE):
        return None
    return width, height


def find(folder: pathlib.Path, name: str) -> pathlib.Path | None:
    """The one regular file called `name` under `folder`; links are never followed."""
    found = [
        path
        for path in sorted(folder.rglob(name))
        if path.is_file() and not path.is_symlink() and not any(p.is_symlink() for p in path.parents)
    ]
    return found[0] if len(found) == 1 else None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("incoming", type=pathlib.Path)
    parser.add_argument("out", type=pathlib.Path)
    parser.add_argument("--run", required=True)
    parser.add_argument("--sha", required=True)
    args = parser.parse_args()

    if not re.fullmatch(r"[0-9]{1,20}", args.run) or not re.fullmatch(r"[0-9a-f]{7,40}", args.sha):
        print("::error::the run number or the commit is not what GitHub gives", file=sys.stderr)
        return 1

    args.out.mkdir(parents=True, exist_ok=False)
    kept = []
    for name, label in EXPECTED.items():
        source = find(args.incoming, name)
        if source is None:
            print(f"missing: {name}")
            continue
        if source.stat().st_size > MAX_BYTES:
            print(f"refused: {name} is too large")
            continue
        data = source.read_bytes()
        size = png_size(data)
        if size is None:
            print(f"refused: {name} is not a PNG picture")
            continue
        (args.out / name).write_bytes(data)
        kept.append((name, label, size))
        print(f"kept: {name} {size[0]}x{size[1]}")

    if not kept:
        print("::error::no picture to publish", file=sys.stderr)
        return 1

    repository = "https://github.com/" + os.environ.get("GITHUB_REPOSITORY", "Omazi/quran")
    lines = [
        "# Premier écran de l'appli, dans le simulateur d'iPhone",
        "",
        "Images prises automatiquement par la vérification iOS, sur un Mac de GitHub.",
        "",
        f"- Version du code : [`{args.sha[:7]}`]({repository}/commit/{args.sha})",
        f"- Exécution : [{args.run}]({repository}/actions/runs/{args.run})",
        "",
        "Cette branche ne contient que ces images. Elle est remplacée à chaque vérification :",
        "ne rien y écrire à la main.",
    ]
    for name, label, (width, height) in kept:
        lines += ["", f"## {label}", "", f'<img src="{name}" alt="{label}" width="320">', "", f"`{name}`, {width} × {height} pixels"]
    missing = [label for name, label in EXPECTED.items() if name not in {k[0] for k in kept}]
    if missing:
        lines += ["", "## Images manquantes", ""] + [f"- {label}" for label in missing]
    (args.out / "README.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
