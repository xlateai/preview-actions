#!/usr/bin/env python3
"""Extract the final approved Xlate preview result from mixed CLI output."""

import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse


def objects(raw: str):
    decoder = json.JSONDecoder()
    cursor = 0
    while cursor < len(raw):
        while cursor < len(raw) and raw[cursor].isspace():
            cursor += 1
        if cursor == len(raw):
            return
        try:
            value, cursor = decoder.raw_decode(raw, cursor)
        except json.JSONDecodeError:
            next_line = raw.find("\n", cursor)
            if next_line < 0:
                return
            cursor = next_line + 1
            continue
        yield value


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: extract-preview-result.py INPUT OUTPUT")

    candidates = []
    for value in objects(Path(sys.argv[1]).read_text(encoding="utf-8")):
        if not isinstance(value, dict):
            continue
        page_url = value.get("page_url")
        if not isinstance(page_url, str):
            continue
        parsed = urlparse(page_url)
        legacy = parsed.netloc == "builds.xlate.ai" and re.fullmatch(r"/(?:previews|builds)/(?:preview|build)_[A-Za-z0-9_-]+", parsed.path)
        integrated = parsed.netloc == "xlate.ai" and re.fullmatch(r"/apps/previews/(?:preview|build)_[A-Za-z0-9_-]+", parsed.path)
        if parsed.scheme == "https" and (legacy or integrated):
            candidates.append(value)

    if not candidates:
        raise SystemExit("preview result omitted an approved Xlate preview URL")

    Path(sys.argv[2]).write_text(
        json.dumps(candidates[-1], separators=(",", ":")) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
