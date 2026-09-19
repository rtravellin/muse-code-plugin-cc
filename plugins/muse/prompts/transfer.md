<task>
You are being handed a conversation that started in Claude Code inside the repository at {{REPO_ROOT}}.
The user wants to continue that same work here in Muse Code.
Absorb the transcript below as your working context for this session.
</task>

<what_to_do_now>
Do not run tools, do not modify anything, and do not start on the work yet.
Reply with a compact handoff note (at most 8 lines) that states:
1. What the user was trying to accomplish.
2. What has been done so far, including files that were touched, if the transcript says.
3. What the next concrete step appears to be.
4. Any open questions or unverified assumptions, labelled as such.
The user will resume this session interactively and give you the next instruction.
</what_to_do_now>

<transcript turns="{{TURN_COUNT}}">
{{TRANSCRIPT}}
</transcript>
