# Devlate distributions · Xlate Cloud

Build, sign, and share native apps with ordinary GitHub Actions. GitHub hosts the
runners, Xlate manages application access and preview metadata, and R2 stores the
artifacts. There is no EAS account or separate build server to operate.

## One workflow import

Add `.github/workflows/distributions.yml`:

```yaml
name: Distributions
on:
  workflow_dispatch:
    inputs:
      request:
        description: Optional Devlate request (JSON)
        required: false
        type: string
permissions:
  contents: read
  actions: write
  pull-requests: write
  id-token: write
jobs:
  distribute:
    uses: xlateai/preview-actions/.github/workflows/devlate.yml@FULL_RELEASE_COMMIT_SHA
    with:
      project-path: apps/example # Omit for a repository-root app.
    secrets: inherit
```

The single release pin selects the compiler, tooling, and workflow implementation.
There is no second SDK pin or `actions-ref` to maintain. Your workflow may be named
`distributions.yml` or `devlate.yml`; XOS repositories can keep their additional
compiler/test workflows alongside it.

Connect the repository to Xlate Cloud, keep `.xlate/preview.json` beside the app's
`package.json`, and choose **Actions → Distributions → Run workflow → branch**.
An empty request builds the platforms declared in the configuration. To choose a
platform or attach review notes, use:

```json
{"platforms":"android","title":"Navigation redesign","changed":"Updated app navigation","test":"Sign in and open an existing chat"}
```

Use `expected_sha` when dispatching from automation to fail if the branch moves.
`pull_request` adds the result to that PR. The result is also retained as a GitHub
Actions JSON artifact, including the preview URL. Existing build-host links and
new `https://xlate.ai/apps/previews/{id}` links are accepted.

## App configuration

React Native and Expo use the same entry point. Example `.xlate/preview.json`:

```json
{
  "name": "Example",
  "version": "1.0.0",
  "native_generation": "expo",
  "android": {
    "identifier": "com.example.app",
    "directory": "android",
    "module": "app",
    "task": "assembleRelease",
    "apk": "app/build/outputs/apk/release/app-release-unsigned.apk"
  }
}
```

For iOS, add its workspace, scheme, configuration and matching identifier. Connect
the app's Apple team in Xlate and set the repository's `XLATE_SIGNING_ENVIRONMENT`
variable to that existing protected GitHub environment (or use the workflow's
`signing-environment` input). Apple credentials stay in that environment. The
signing job checks the repository, application and Apple-team binding with Xlate;
viewing a build page never starts a build. Device enrollment can explicitly request
re-signing for that approved device.

Android uses the connected signing key when configured. Otherwise preview builds
use an ephemeral key, so a later preview may require uninstalling an earlier APK.
Store releases require a stable configured key; this workflow does not publish to
App Store or Google Play.

## Naming and compatibility

**Xlate Cloud** is the GitHub integration; **Devlate** is the developer CLI and
workflow interface. `preview-actions` remains the public repository hosting the
reusable workflow. Existing `native-preview.yml` callers remain compatible during
migration. Legacy `XOS_*` protocol/environment names are retained internally where
renaming them would invalidate existing clients or signing bindings.

The current distribution implementation supports React Native/Expo iOS and
Android. Other adapters must supply tested compile/sign/publish implementations;
importing this workflow alone does not claim support for every framework.

## Security

Pin a reviewed full commit SHA. Builds require explicit workflow dispatch; fork
PRs do not automatically receive signing credentials. App configuration contains
no secrets. Read [SECURITY.md](SECURITY.md) before reporting a vulnerability.
