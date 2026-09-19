# Changelog

## 0.1.0

- Initial release.
- `/muse:check`, `/muse:review`, `/muse:critique`, `/muse:delegate`, `/muse:transfer`, `/muse:sync-skills`, `/muse:runs`, `/muse:show`, `/muse:stop`.
- `muse:muse-delegate` subagent with `--resume` support (continues the same `muse exec --session-id`).
- `/muse:delegate --worktree` (the bridge creates a git worktree on `muse/session-<id>` and hands it to Muse) and `--image`; model aliases `spark`, `contributor`, `spark-1.2`.
- `/muse:transfer` imports natively through Muse's bundled `resume-claude` skill, with a condensed-transcript fallback.
- Optional stop-time review gate (`/muse:check --enable-review-gate`).
- Windows: runs the `muse-bin-<version>.exe` beside Meta's shim directly; `/muse:check` reports the Windows sandbox state; `MUSE_CC_DISABLE_SANDBOX=1` is an opt-in.
- README demo (`docs/demo.svg`), rendered from one recorded session by `npm run build-demo-script` and `npm run render-demo`.
