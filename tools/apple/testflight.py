"""After an upload: makes sure a group of internal testers exists, then waits until Apple has
processed the build and says what state it is in.

    python3 tools/apple/testflight.py --bundle com.omazi.quran --group "Coran - Tests internes" --build 20261124.1380

The group is internal (people of the developer account only) and receives every build by
itself, so no build has to be handed over one by one. The account holder is put in it: that is
the owner, who asked to install the app from TestFlight.

Nothing personal is printed (no name, no e-mail): the log is public. If the group or the tester
cannot be set up from here, the script says what to do by hand and goes on: the build is the point.
"""

from __future__ import annotations

import argparse
import datetime as dt
import os
import sys
import time

from asc import AppleError, Connect, fail


def note(lines: list[str], text: str) -> None:
    print(text)
    lines.append(text)


def ensure_group(connect: Connect, app_id: str, name: str, lines: list[str]) -> str | None:
    groups = connect.all(f"/apps/{app_id}/betaGroups?limit=200")
    group = next((g for g in groups if g["attributes"].get("name") == name), None)
    if group is None:
        try:
            group = connect.call(
                "POST",
                "/betaGroups",
                {
                    "data": {
                        "type": "betaGroups",
                        "attributes": {"name": name, "isInternalGroup": True, "hasAccessToAllBuilds": True},
                        "relationships": {"app": {"data": {"type": "apps", "id": app_id}}},
                    }
                },
            )["data"]
            note(lines, f"- Groupe de testeurs « {name} » : créé (interne, reçoit toutes les versions).")
        except AppleError as error:
            note(lines, f"- Groupe de testeurs « {name} » : impossible de le créer d'ici (réponse {error.status or 'inconnue'}). À créer à la main dans TestFlight.")
            return None
    else:
        note(lines, f"- Groupe de testeurs « {name} » : il existe.")
    return group["id"]


def ensure_owner(connect: Connect, group_id: str, lines: list[str]) -> None:
    """Puts the account holder in the group. Says only whether it worked."""
    try:
        holders = [u for u in connect.all("/users?limit=200") if "ACCOUNT_HOLDER" in (u["attributes"].get("roles") or [])]
        if len(holders) != 1:
            raise AppleError("the account holder could not be told apart")
        attributes = holders[0]["attributes"]
        email = attributes.get("username") or ""
        inside = connect.all(f"/betaGroups/{group_id}/betaTesters?limit=200")
        if any((t["attributes"].get("email") or "").lower() == email.lower() for t in inside):
            note(lines, "- Le propriétaire du compte est déjà dans le groupe.")
            return
        connect.call(
            "POST",
            "/betaTesters",
            {
                "data": {
                    "type": "betaTesters",
                    "attributes": {"email": email, "firstName": attributes.get("firstName") or "", "lastName": attributes.get("lastName") or ""},
                    "relationships": {"betaGroups": {"data": [{"type": "betaGroups", "id": group_id}]}},
                }
            },
        )
        note(lines, "- Le propriétaire du compte a été ajouté au groupe.")
    except AppleError as error:
        # Apple's message can quote the address it refused: only the status is repeated here.
        note(lines, f"- Le propriétaire du compte n'a pas pu être ajouté au groupe d'ici (réponse {error.status or 'inconnue'}). À faire à la main : TestFlight › le groupe › « + ».")


def wait_for_build(connect: Connect, app_id: str, build: str, minutes: float, lines: list[str], pause: float = 30) -> int:
    deadline = time.time() + minutes * 60
    last = ""
    while True:
        found = connect.call("GET", f"/builds?filter[app]={app_id}&filter[version]={build}&sort=-uploadedDate&limit=5").get("data", [])
        recent = []
        for item in found:
            try:
                age = dt.datetime.now(dt.timezone.utc) - dt.datetime.fromisoformat(item["attributes"].get("uploadedDate"))
            except (TypeError, ValueError):
                continue
            if age < dt.timedelta(hours=6):
                recent.append(item)
        state = recent[0]["attributes"].get("processingState") if recent else "not visible yet"
        if state != last:
            print(f"build {build}: {state}")
            last = state
        if state == "VALID":
            note(lines, f"- Version {build} : traitée par Apple, **disponible dans TestFlight**.")
            return 0
        if state in ("FAILED", "INVALID"):
            note(lines, f"- Version {build} : Apple l'a refusée ({state}). La raison est dans l'e-mail envoyé au titulaire du compte.")
            return 1
        if time.time() > deadline:
            note(lines, f"- Version {build} : toujours en traitement chez Apple après {minutes:.0f} minutes. Elle peut encore arriver ; à revoir dans TestFlight.")
            return 1
        time.sleep(pause)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bundle", required=True)
    parser.add_argument("--group", required=True)
    parser.add_argument("--build", required=True)
    parser.add_argument("--wait-min", type=float, default=40)
    parser.add_argument("--pause", type=float, default=30, help="seconds between two looks at the build")
    args = parser.parse_args()

    connect = Connect()
    lines: list[str] = []
    apps = [a for a in connect.call("GET", f"/apps?filter[bundleId]={args.bundle}&limit=5").get("data", []) if a["attributes"].get("bundleId") == args.bundle]
    if not apps:
        raise AppleError(f"No app record for {args.bundle} in App Store Connect.")
    app_id = apps[0]["id"]
    group_id = ensure_group(connect, app_id, args.group, lines)
    if group_id:
        ensure_owner(connect, group_id, lines)
    result = wait_for_build(connect, app_id, args.build, args.wait_min, lines, args.pause)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as stream:
            stream.write("## TestFlight\n\n" + "\n".join(lines) + "\n")
    return result


if __name__ == "__main__":
    try:
        sys.exit(main())
    except AppleError as error:
        sys.exit(fail(error))
    except Exception as error:  # no traceback: it could show an argument or an address
        sys.exit(fail(AppleError(f"Unexpected problem ({type(error).__name__}).")))
