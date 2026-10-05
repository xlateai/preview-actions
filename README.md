# Xlate Preview Actions

Native app previews, delivered like web previews.

This repository is the public GitHub Actions boundary for Xlate Preview. It is
being built so a repository can compile an iOS or Android app on an ordinary
GitHub runner, hand the unsigned result to protected signing infrastructure,
and receive an install link that can be shared in a pull request or Xlate chat.

The intended flow is deliberately split:

1. application source is compiled on the repository's runner;
2. the unsigned artifact is identified and inspected;
3. signing is authorized with short-lived workload identity;
4. Xlate publishes an install page for eligible devices.

Long-lived signing credentials do not belong in this repository or in an
application's workflow.

## Status

This is an early public foundation. The reusable workflow performs a strict
request preflight, compiles React Native iOS source without signing credentials,
hands the retained archive to a separate protected signing run, and publishes
the resulting install page through `builds.xlate.ai`.

Android publication, connected runners, and metered Xlate build infrastructure
are coming next.

Callers must pin the workflow and its SDK input to full commit SHAs. The initial
runner is intended for Xlate-authorized repositories while the CLI distribution
is separated from private SDK source.

```yaml
jobs:
  preview:
    uses: xlateai/preview-actions/.github/workflows/native-preview.yml@FULL_COMMIT_SHA
    with:
      project-name: example
      project-path: apps/example
      project-adapter: react_native
      xos-ref: FULL_XOS_COMMIT_SHA
      command-subject: /preview(ios)
    secrets: inherit
```

## Preview configuration

Place `.xlate/preview.json` beside the native app's `package.json`:

```json
{
  "name": "Example",
  "version": "1.0.0",
  "native_generation": "expo",
  "ios": {
    "identifier": "com.example.app",
    "workspace": "ios/Example.xcworkspace",
    "scheme": "Example",
    "configuration": "Release"
  },
  "android": {
    "identifier": "com.example.app",
    "directory": "android",
    "module": "app",
    "task": "assembleRelease",
    "apk": "app/build/outputs/apk/release/app-release-unsigned.apk"
  }
}
```

The standalone public preflight validates metadata and paths without printing
the complete configuration. Secret-like fields are rejected. The compile job
never receives Apple credentials; the signing job is isolated in the caller's
application-specific protected GitHub environment.

## Security

Please read [SECURITY.md](SECURITY.md) before reporting a vulnerability. Do not
include credentials, private keys, provisioning profiles, or customer data in
an issue, workflow input, or pull request.
