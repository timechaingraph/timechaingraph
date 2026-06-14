# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Timechain Graph, please report it
privately so we can fix it before public disclosure. **Do not open a public
GitHub issue.**

### How to report

Open a private security advisory on GitHub:

1. Go to <https://github.com/timechaingraph/timechaingraph/security/advisories/new>
2. Fill in the details: what the vulnerability is, how to reproduce it, what
   the impact is, and (if known) suggested mitigation.

We will acknowledge your report within 7 days and aim to issue a fix or
mitigation within 30 days for serious issues.

## Scope

In scope:

- The static site at `timechaingraph.com` and the build output in `/out/`
- The data pipeline in `chain-tools/`
- The privacy audit script and CI workflow
- The Cloudflare Pages deployment configuration

Out of scope:

- Issues in upstream dependencies (Next.js, PixiJS, etc.) — please report to
  those projects directly. Linking to a relevant CVE in your report is helpful.
- Network-layer issues with Cloudflare's infrastructure — report to Cloudflare.
- The sister project `timechaingrid` — has its own security policy.

## Privacy violations

Privacy is a security boundary in this project. If you discover that the
browser is making any third-party request at runtime, that is a security
issue and the same reporting process applies. The privacy audit
(`scripts/privacy-audit.sh`) runs in CI and should catch most cases — if it
ever fails to catch a leak, that's also a privacy issue worth reporting.

## Responsible disclosure timeline

| Day  | What |
|------|------|
| 0    | You report the vulnerability privately. |
| ≤7   | We acknowledge receipt. |
| ≤30  | We issue a fix or mitigation for serious issues. |
| +30  | After the fix is deployed, we credit you in the changelog (if you want). |

Thank you for helping keep Timechain Graph and its users safe.
