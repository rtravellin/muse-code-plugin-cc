<task>
Continue a Claude Code session here in Muse Code, inside the repository at {{REPO_ROOT}}.
Use your bundled resume-claude skill: call read_skill for bundled:resume-claude first, then read the Claude Code transcript at the path below and absorb it as this session's working context.

Claude Code session id: {{CLAUDE_SESSION_ID}}
Transcript path: {{TRANSCRIPT_PATH}}
Turns in the transcript: {{TURN_COUNT}}
</task>

<what_to_do_now>
This run is read-only: you may read files, but you have no shell and cannot modify anything.
Do not start on the work yet.
Reply with a compact handoff note (at most 8 lines) that states:
1. What the user was trying to accomplish.
2. What has been done so far, including files that were touched, if the transcript says.
3. What the next concrete step appears to be.
4. Any open questions or unverified assumptions, labelled as such.
The user will resume this session interactively and give you the next instruction.
</what_to_do_now>
