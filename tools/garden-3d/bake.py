"""Bakes the level-1 garden into assets/models/garden/level-1/garden.glb (docs/DECISIONS.md D40).

usage: python3 -I tools/garden-3d/bake.py [--source /home/claude/gen/garden3d]

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
OUTPUT = os.path.join(REPO, "assets", "models", "garden", "level-1", "garden.glb")
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
def serve(source):
    handler = type("Handler", (_Handler,), {"roots": {"/repo/": REPO, "/gen/": os.path.abspath(source)}})
    httpd = _Server(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    try:
        yield f"http://127.0.0.1:{httpd.server_address[1]}"
    finally:
        httpd.shutdown()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="/home/claude/gen/garden3d")
    args = parser.parse_args()
    with open(os.path.join(TOOL, "source", "layout.json"), encoding="utf-8") as f:
        layout = json.load(f)
    with open(os.path.join(TOOL, "source", "pack.json"), encoding="utf-8") as f:
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
        except Exception:
            print("\n".join(logs))
            raise
        result = page.evaluate("([l, p]) => window.bake(l, p, '/gen/')", [layout, pack])
        browser.close()
    for line in [l for l in logs if "error" in l.lower() or "http" in l][:20]:
        print("log:", line[:300])
    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "wb") as f:
        f.write(base64.b64decode(result["glb"]))
    print(json.dumps(result["report"], indent=1))
    print("written:", os.path.relpath(OUTPUT, REPO))


if __name__ == "__main__":
    main()
