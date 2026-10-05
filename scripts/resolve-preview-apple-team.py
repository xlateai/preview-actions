#!/usr/bin/env python3
"""Resolve an app's public Apple team binding with the runner's GitHub OIDC."""
import json
import os
import re
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen


def request_json(request):
    with urlopen(request, timeout=30) as response:
        return json.load(response)


origin = os.environ.get("XOS_CLOUD_API_URL", "https://xlate.ai").rstrip("/")
if not re.fullmatch(r"https://[A-Za-z0-9.-]+(?::[0-9]+)?", origin):
    raise ValueError("Signing control plane must be an HTTPS origin")
endpoint = f"{origin}/api/xos/preview-signing-context"
identifier = os.environ["XOS_PREVIEW_APPLICATION_IDENTIFIER"]
oidc_url = os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"]
if urlparse(oidc_url).scheme != "https":
    raise ValueError("GitHub OIDC endpoint must use HTTPS")
separator = "&" if "?" in oidc_url else "?"
oidc = request_json(Request(
    oidc_url + separator + urlencode({"audience": endpoint}),
    headers={"Authorization": f"bearer {os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']}"},
))["value"]
binding = request_json(Request(
    endpoint,
    method="POST",
    data=json.dumps({"application_identifier": identifier}).encode(),
    headers={"Authorization": f"Bearer {oidc}", "Content-Type": "application/json"},
))
team = binding.get("apple_team_id", "")
if binding.get("application_identifier") != identifier or not re.fullmatch(r"[A-Z0-9]{10}", team):
    raise ValueError("Signing control plane returned an invalid application/team binding")
configured = os.environ.get("XOS_PREVIEW_EXPECTED_APPLE_TEAM_ID", "")
if configured and configured != team:
    raise ValueError("GitHub environment and control plane disagree about the Apple team")
with open(os.environ["GITHUB_ENV"], "a", encoding="utf-8") as output:
    output.write(f"XOS_PREVIEW_EXPECTED_APPLE_TEAM_ID={team}\n")
