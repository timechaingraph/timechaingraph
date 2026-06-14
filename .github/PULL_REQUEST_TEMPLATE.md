<!--
Thanks for contributing! Please fill in the sections below. See CONTRIBUTING.md
for the full workflow.
-->

## Summary

<!-- 1-3 bullets on what this PR changes and why. -->

## Test plan

<!-- How did you verify this works? -->

- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run lint` — 0 errors
- [ ] `npm run test:run` — all green
- [ ] `npm run build` — succeeds
- [ ] `npm run privacy-audit` — no third-party leaks
- [ ] Manual test: <!-- describe what you did in the browser -->

## Privacy check

<!-- Required for any change that touches dependencies, fetch, fonts, or external resources. -->

- [ ] No new third-party domain reachable from the browser at runtime
- [ ] No new dependency that calls home (telemetry, analytics, license check)
- [ ] If a third-party resource was needed, it has been self-hosted under `/public/` or vendored

## Screenshots / GIF

<!-- If this changes the UI, attach a screenshot or short GIF. -->

## Related issues

<!-- e.g. "Closes #42" or "Refs #17" -->
