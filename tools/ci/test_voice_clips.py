"""Tests of the voice proof's clip fetcher. Run: python3 -m unittest tools/ci/test_voice_clips.py"""

import hashlib
import importlib.util
import json
import pathlib
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("voice_clips", HERE / "voice-clips.py")
clips = importlib.util.module_from_spec(spec)
spec.loader.exec_module(clips)

WAV = b"RIFF\x24\x00\x00\x00WAVEfmt " + b"\x00" * 40


def entry(name="a__83-1-3.wav", data=WAV, **overrides):
    clip = {"name": name, "url": "https://example.org/a.wav", "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest()}
    clip.update(overrides)
    return clip


class FetchTest(unittest.TestCase):
    def run_with(self, listing, served):
        with tempfile.TemporaryDirectory() as tmp:
            folder = pathlib.Path(tmp)
            (folder / "list.json").write_text(json.dumps({"clips": listing}), encoding="utf-8")
            clips.main(["x", str(folder / "list.json"), str(folder / "out")], download=lambda url: served)
            return sorted(p.name for p in (folder / "out").iterdir())

    def test_keeps_a_clip_of_the_right_size_and_hash(self):
        self.assertEqual(self.run_with([entry()], WAV), ["a__83-1-3.wav"])

    def test_leaves_out_another_file(self):
        self.assertEqual(self.run_with([entry()], WAV + b"x"), [])
        changed = WAV[:-1] + b"x"
        self.assertEqual(self.run_with([entry(data=changed, sha256="0" * 64)], changed), [])

    def test_leaves_out_an_entry_that_is_not_safe(self):
        self.assertEqual(self.run_with([entry(name="../a__83-1-3.wav")], WAV), [])
        self.assertEqual(self.run_with([entry(name="a.wav")], WAV), [])
        self.assertEqual(self.run_with([entry(url="http://example.org/a.wav")], WAV), [])
        self.assertEqual(self.run_with(["nonsense"], WAV), [])

    def test_the_committed_list_is_valid(self):
        listing = json.loads((HERE / "voice-clips.json").read_text(encoding="utf-8"))["clips"]
        self.assertTrue(3 <= len(listing) <= clips.MAX_CLIPS)
        for clip in listing:
            self.assertIsNone(clips.valid_entry(clip), clip.get("name"))


if __name__ == "__main__":
    unittest.main()
