# Security

Xlate Preview treats source compilation, signing, and artifact delivery as
separate trust boundaries.

- Public compilation jobs must not receive Apple, Android, Cloudflare, GitHub
  App, or customer credentials. Signing jobs must be isolated in an explicitly
  selected protected environment and remove ephemeral material on completion.
- Protected operations must use short-lived workload identity and validate the
  calling repository, immutable workflow revision, application, and artifact.
- Workflows and actions should be pinned to full commit SHAs.
- Logs and artifacts must not contain tokens, private keys, provisioning
  profiles, signing certificates, or unredacted customer configuration.

If you discover a vulnerability, do not open a public issue. Contact the Xlate
team through an existing trusted channel and include only the minimum detail
needed to reproduce the problem. Never send live credentials.
