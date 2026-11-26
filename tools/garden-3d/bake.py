"""Bakes a level's garden into its GLB (docs/DECISIONS.md D40, D46): level 1 into
assets/models/garden/level-1/garden.glb, levels 2 to 7 into dist/garden-art/level-N/garden.glb.

usage: python3 -I tools/garden-3d/bake.py [--level N] [--source /home/claude/gen/garden3d] [--output file]

Level 1 reads source/layout.json and source/pack.json; level N (2 to 7) reads
source/level-N/layout.json and pack.json, written by levels/make_levels.py.

The source folder holds the model packs (packs/) and the prepared textures (tool/cache/) the
garden pictures were rendered from (D35); it is not in the repository. The page runs in headless
Chromium (Playwright): three.js's FBX and glTF loaders need a browser. Nothing from the packs is
executed: they are only sent to the browser as bytes.
"""
import argparse
import base64
import contextlib
import functools
import http.server
import json
import os
import socketserver
import threading

TOOL = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(TOOL))


def output_of(level):
    """Level 1 ships with the app; levels 2 to 7 are built into dist/garden-art (not in git), made
    into the packs the app downloads (tools/garden-3d/pack.py, docs/specs/garden-levels.md)."""
    if level == 1:
        return os.path.join(REPO, "assets", "models", "garden", "level-1", "garden.glb")
    return os.path.join(REPO, "dist", "garden-art", f"level-{level}", "garden.glb")


def source_of(level):
    return os.path.join(TOOL, "source") if level == 1 else os.path.join(TOOL, "source", f"level-{level}")
CHROMIUM_ARGS = ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]


class _Handler(http.server.SimpleHTTPRequestHandler):
    """Serves /repo/... from the repository and /gen/... from the source folder."""

    roots = {}

    def translate_path(self, path):
        path = path.split("?", 1)[0]
        for prefix, root in self.roots.items():
            if path.startswith(prefix):
                relative = os.path.normpath(path[len(prefix):]).lstrip("/")
                full = os.path.join(root, relative)
                if os.path.commonpath([root, os.path.abspath(full)]) == root:
                    return full
        return os.path.join(REPO, "__nothing__")

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass

    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".mjs": "text/javascript", ".js": "text/javascript"}


class _Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


@contextlib.contextmanager
def serve(source, extra_roots=None):
    roots = {"/repo/": REPO, "/gen/": os.path.abspath(source), **(extra_roots or {})}
    handler = type("Handler", (_Handler,), {"roots": roots})
    httpd = _Server(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    try:
        yield f"http://127.0.0.1:{httpd.server_address[1]}"
    finally:
        httpd.shutdown()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="/home/claude/gen/garden3d")
    parser.add_argument("--level", type=int, default=1)
    parser.add_argument("--output")
    args = parser.parse_args()
    output = args.output or output_of(args.level)
    with open(os.path.join(source_of(args.level), "layout.json"), encoding="utf-8") as f:
        layout = json.load(f)
    with open(os.path.join(source_of(args.level), "pack.json"), encoding="utf-8") as f:
        pack = json.load(f)
    from playwright.sync_api import sync_playwright

    with serve(args.source) as base, sync_playwright() as p:
        browser = p.chromium.launch(args=CHROMIUM_ARGS)
        page = browser.new_page()
        logs = []
        page.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))
        page.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
        page.on("response", lambda r: logs.append(f"[http {r.status}] {r.url}") if r.status >= 400 else None)
        page.goto(base + "/repo/tools/garden-3d/bake.html")
        try:
            page.wait_for_function("window.ready === true", timeout=60000)
            result = page.evaluate("([l, p]) => window.bake(l, p, '/gen/')", [layout, pack])
        except Exception:
            print("\n".join(logs[-40:]))
            raise
        browser.close()
    for line in [l for l in logs if "error" in l.lower() or "http" in l][:20]:
        print("log:", line[:300])
    os.makedirs(os.path.dirname(os.path.abspath(output)), exist_ok=True)
    with open(output, "wb") as f:
        f.write(base64.b64decode(result["glb"]))
    print(json.dumps(result["report"], indent=1))
    print("written:", output)


if __name__ == "__main__":
    main()
