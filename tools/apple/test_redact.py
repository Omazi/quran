"""Tests of tools/apple/redact.py: what Apple's tools say is shown in a public log, without a name in it.

    python3 -m unittest discover -s tools/apple -p "test_*.py"
"""

from __future__ import annotations

import io
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import redact  # noqa: E402


class ALine(unittest.TestCase):
    def test_the_holder_named_by_a_signing_certificate_is_hidden(self):
        said = 'error: exportArchive: Provisioning profile "P" doesn\'t include signing certificate "Apple Distribution: Jane Doe (ABCDE12345)".'
        self.assertEqual(redact.redact(said), 'error: exportArchive: Provisioning profile "P" doesn\'t include signing certificate "Apple Distribution: (hidden)".')

    def test_older_and_development_certificates_are_hidden_the_same_way(self):
        for kind in ("iPhone Distribution", "Apple Development", "iOS Distribution", "iPhone Developer"):
            with self.subTest(kind=kind):
                self.assertEqual(redact.redact(f"signer \"{kind}: Jane Doe (ABCDE12345)\" is not trusted"), f'signer "{kind}: (hidden)" is not trusted')

    def test_a_certificate_named_at_the_end_of_a_line_is_hidden(self):
        self.assertEqual(redact.redact("Signing Identity: Apple Distribution: Jane Doe (ABCDE12345)"), "Signing Identity: Apple Distribution: (hidden)")

    def test_a_team_named_in_quotes_is_hidden(self):
        said = 'error: exportArchive: Team "Jane Doe" does not have permission to create "iOS App Store" provisioning profiles.'
        self.assertEqual(redact.redact(said), 'error: exportArchive: Team (hidden) does not have permission to create "iOS App Store" provisioning profiles.')

    def test_an_address_is_hidden(self):
        self.assertEqual(redact.redact("The account jane.doe+apps@example.org has no agreement."), "The account (address hidden) has no agreement.")

    def test_a_line_that_names_nobody_is_shown_as_it_is(self):
        said = "error: exportArchive: No profiles for 'com.example.app' were found"
        self.assertEqual(redact.redact(said), said)


class AWholeLog(unittest.TestCase):
    def test_every_line_is_read_and_written_again_without_the_names(self):
        said = io.StringIO('No errors validating archive.\nsigner "Apple Distribution: Jane Doe (ABCDE12345)"\n')
        shown = io.StringIO()
        redact.copy(said, shown)
        self.assertEqual(shown.getvalue(), 'No errors validating archive.\nsigner "Apple Distribution: (hidden)"\n')


if __name__ == "__main__":
    unittest.main()
