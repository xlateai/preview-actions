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

This is an early public foundation. The first reusable workflow performs a
strict, secret-safe preflight of `.xlate/preview.json`. Native compilation,
protected signing handoff, install cards, connected runners, and metered Xlate
build infrastructure are coming next.

Do not depend on the workflow contract before the first tagged release. Once
released, callers should pin the workflow and action to a full commit SHA.

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

The public preflight validates metadata and paths without printing the complete
configuration. Secret-like fields are rejected. Credentials remain in the
protected service that performs signing.

## Security

Please read [SECURITY.md](SECURITY.md) before reporting a vulnerability. Do not
include credentials, private keys, provisioning profiles, or customer data in
an issue, workflow input, or pull request.
