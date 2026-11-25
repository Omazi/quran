"""Tests of tools/apple/check-app.py: what is signed must be the one app that was asked for.

    python3 -m unittest discover -s tools/apple -p "test_*.py"

Every archive below is the accepted one with a single thing changed, so a refusal can only come
from that thing.
"""

from __future__ import annotations

import contextlib
import importlib
import io
import os
import plistlib
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import asc  # noqa: E402

check_app = importlib.import_module("check-app")

BUNDLE = "com.example.app"
BUILD = "20260101.5"


def make_app(app: Path, bundle: str = BUNDLE, build: str = BUILD, binary: bool = True) -> Path:
    """An app as Xcode leaves it: a folder with its Info.plist, its JavaScript and one framework."""
    (app / "Frameworks" / "One.framework").mkdir(parents=True)
    (app / "Frameworks" / "One.framework" / "One").write_bytes(b"code")
    (app / "main.jsbundle").write_bytes(b"js")
    info = {"CFBundleIdentifier": bundle, "CFBundleVersion": build, "CFBundleShortVersionString": "0.1.0"}
    (app / "Info.plist").write_bytes(plistlib.dumps(info, fmt=plistlib.FMT_BINARY if binary else plistlib.FMT_XML))
    return app


def make_archive(folder: Path, **app_options) -> Path:
    archive = folder / "App.xcarchive"
    make_app(archive / "Products" / "Applications" / "Sample.app", **app_options)
    properties = {"ApplicationPath": "Applications/Sample.app", "CFBundleIdentifier": BUNDLE, "CFBundleVersion": BUILD}
    (archive / "Info.plist").write_bytes(plistlib.dumps({"ApplicationProperties": properties, "Name": "Sample"}))
    return archive


class InAFolder(unittest.TestCase):
    def setUp(self):
        holder = tempfile.TemporaryDirectory()
        self.addCleanup(holder.cleanup)
        self.folder = Path(holder.name)

    def refused(self, archive: Path) -> None:
        with self.assertRaises(asc.AppleError):
            check_app.archive_app(archive, BUNDLE, BUILD)


class TheArchive(InAFolder):
    def test_the_app_that_was_asked_for_is_accepted_and_returned(self):
        archive = make_archive(self.folder)
        self.assertEqual(check_app.archive_app(archive, BUNDLE, BUILD), archive / "Products" / "Applications" / "Sample.app")

    def test_an_info_plist_written_as_text_is_read_too(self):
        archive = make_archive(self.folder, binary=False)
        self.assertEqual(check_app.archive_app(archive, BUNDLE, BUILD).name, "Sample.app")

    def test_another_identifier_is_refused(self):
        self.refused(make_archive(self.folder, bundle="com.example.other"))

    def test_an_identifier_that_only_starts_the_same_is_refused(self):
        self.refused(make_archive(self.folder, bundle=BUNDLE + ".extra"))

    def test_another_build_number_is_refused(self):
        self.refused(make_archive(self.folder, build="20260101.6"))

    def test_an_archive_without_an_app_is_refused(self):
        archive = self.folder / "App.xcarchive"
        (archive / "Products" / "Applications").mkdir(parents=True)
        self.refused(archive)

    def test_two_apps_are_refused(self):
        archive = make_archive(self.folder)
        make_app(archive / "Products" / "Applications" / "Second.app")
        self.refused(archive)

    def test_a_link_standing_where_the_app_should_be_is_refused(self):
        archive = make_archive(self.folder)
        applications = archive / "Products" / "Applications"
        (applications / "Sample.app").rename(self.folder / "Elsewhere.app")
        (applications / "Sample.app").symlink_to(self.folder / "Elsewhere.app", target_is_directory=True)
        self.refused(archive)

    def test_an_app_name_that_would_write_a_second_line_is_refused(self):
        archive = make_archive(self.folder)
        applications = archive / "Products" / "Applications"
        (applications / "Sample.app").rename(applications / "Sample\nSIGNING_IDENTITY=other.app")
        (archive / "Info.plist").write_bytes(plistlib.dumps({"Name": "Sample"}))  # so that only the name can be refused
        self.refused(archive)

    def test_an_archive_that_points_at_another_app_is_refused(self):
        archive = make_archive(self.folder)
        (archive / "Info.plist").write_bytes(plistlib.dumps({"ApplicationProperties": {"ApplicationPath": "Applications/../../Other.app"}}))
        self.refused(archive)

    def test_an_archive_that_names_no_app_path_is_left_to_xcode(self):
        archive = make_archive(self.folder)
        (archive / "Info.plist").write_bytes(plistlib.dumps({"Name": "Sample"}))
        self.assertEqual(check_app.archive_app(archive, BUNDLE, BUILD).name, "Sample.app")


class WhatTheAppHolds(InAFolder):
    """The profile made for the send covers one identifier: nothing else that runs may travel in the app."""

    def app_of(self, archive: Path) -> Path:
        return archive / "Products" / "Applications" / "Sample.app"

    def test_an_app_extension_is_refused(self):
        archive = make_archive(self.folder)
        (self.app_of(archive) / "PlugIns" / "Share.appex").mkdir(parents=True)
        self.refused(archive)

    def test_a_watch_app_is_refused(self):
        archive = make_archive(self.folder)
        (self.app_of(archive) / "Watch" / "Wrist.app").mkdir(parents=True)
        self.refused(archive)

    def test_code_bundled_deeper_in_the_app_is_refused(self):
        for name in ("Helper.xpc", "Inner.app", "Late.appex"):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as holder:
                archive = make_archive(Path(holder))
                (self.app_of(archive) / "Frameworks" / "One.framework" / name).mkdir()
                self.refused(archive)

    def test_a_link_to_a_file_outside_the_app_is_refused(self):
        outside = self.folder / "key.p8"
        outside.write_text("private")
        for target in (str(outside), "../../../../key.p8"):
            with self.subTest(target=target):
                archive = make_archive(self.folder / target.replace("/", "_").replace(".", "_"))
                (self.app_of(archive) / "notes.txt").symlink_to(target)
                self.refused(archive)

    def test_a_link_that_stays_inside_the_app_is_accepted(self):
        archive = make_archive(self.folder)
        (self.app_of(archive) / "Frameworks" / "One.framework" / "Current").symlink_to("One")
        self.assertEqual(check_app.archive_app(archive, BUNDLE, BUILD).name, "Sample.app")


class TheSignedApp(InAFolder):
    """After the signing, the same questions are asked of what is about to be uploaded."""

    def payload(self, **app_options) -> Path:
        make_app(self.folder / "Payload" / "Sample.app", **app_options)
        return self.folder

    def test_the_signed_app_that_was_asked_for_is_accepted_and_returned(self):
        self.assertEqual(check_app.payload_app(self.payload(), BUNDLE, BUILD), self.folder / "Payload" / "Sample.app")

    def test_a_signed_app_with_another_identifier_is_refused(self):
        with self.assertRaises(asc.AppleError):
            check_app.payload_app(self.payload(bundle="com.example.other"), BUNDLE, BUILD)

    def test_a_signed_app_with_another_build_number_is_refused(self):
        with self.assertRaises(asc.AppleError):
            check_app.payload_app(self.payload(build="1"), BUNDLE, BUILD)


class FromTheCommandLine(InAFolder):
    def run_script(self, *arguments: str) -> int:
        argv, sys.argv = sys.argv, ["check-app.py", *arguments]
        try:
            with contextlib.redirect_stdout(io.StringIO()):
                return check_app.main()
        finally:
            sys.argv = argv

    def test_an_accepted_archive_is_handed_to_the_next_steps(self):
        archive = make_archive(self.folder)
        handed = self.folder / "github_env"
        os.environ["GITHUB_ENV"] = str(handed)
        self.addCleanup(os.environ.pop, "GITHUB_ENV", None)
        self.assertEqual(self.run_script("archive", str(archive), "--bundle", BUNDLE, "--build", BUILD), 0)
        self.assertEqual(handed.read_text().splitlines(), [f"ARCHIVE={archive}", f"APP_IN_ARCHIVE={archive}/Products/Applications/Sample.app"])

    def test_a_refused_archive_hands_nothing_over(self):
        archive = make_archive(self.folder, bundle="com.example.other")
        handed = self.folder / "github_env"
        os.environ["GITHUB_ENV"] = str(handed)
        self.addCleanup(os.environ.pop, "GITHUB_ENV", None)
        with self.assertRaises(asc.AppleError):
            self.run_script("archive", str(archive), "--bundle", BUNDLE, "--build", BUILD)
        self.assertFalse(handed.exists())


if __name__ == "__main__":
    unittest.main()
