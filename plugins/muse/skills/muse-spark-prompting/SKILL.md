---
name: muse-spark-prompting
description: Internal guidance for composing Muse Code prompts for coding, review, diagnosis, and research tasks inside the Muse Claude Code plugin
user-invocable: false
---

# Muse Spark Prompting

Use this skill when `muse:muse-delegate` needs to ask Muse Code for help.

Muse Code runs multi-agent by default: it plans, spawns background subagents for independent pieces of work, and verifies before reporting. Prompt it like a tech lead handing off a ticket, not like a pair programmer. State the task, what "done" looks like, how to verify, and the few constraints that matter.

Core rules:
- Prefer one clear task per Muse run. Split unrelated asks into separate runs.
- Tell Muse what done looks like. Do not assume it will infer the desired end state.
- Name the verification step (test command, build, lint) whenever a wrong guess would be expensive. Muse will run it itself when the run is write-capable.
- Prefer better task contracts over raising reasoning effort. Only pass `--effort` when the user asks.
- Keep the prompt compact. Muse already has the repository; do not paste large file contents it can read on its own.

Default prompt recipe:
- **Task**: the concrete job and the relevant repository or failure context (error text, failing test name, file paths).
- **Done when**: the observable end state, in one or two lines.
- **Verify with**: the command(s) that prove it, if any.
- **Constraints**: what not to touch, style or API boundaries, whether to commit (default: do not commit).
- **Report**: what to say back — touched files, what was verified, and open questions or inferences marked as such.

When to add blocks:
- Debugging: ask for root cause first, then the smallest safe fix, then the verification result.
- Review, critique, research: ask for grounded findings with file paths and line numbers, and for uncertainty to be labelled.
- Write-capable tasks: say explicitly that unrelated refactors are out of scope.
- Follow-ups on the same session (`--resume-last`): send only the delta instruction; Muse still has the prior context.

How to choose prompt shape:
- Use the built-in `review` or `critique` commands when the job is reviewing local git changes. Those prompts already carry the review contract.
- Use `run` for diagnosis, planning, research, or implementation where you need to control the prompt directly.
- Use `run --resume-last` for follow-up instructions on the same Muse session.

Working rules:
- Keep claims anchored to observed evidence. Ask Muse to label hypotheses as hypotheses.
- Ask for brief, outcome-based progress only for long-running or tool-heavy tasks; the bridge already records tool activity in the run log.
- Do not restate the user's request in a different voice. Tighten it; do not reinterpret it.

Prompt assembly checklist:
1. Define the exact task and scope.
2. State the done condition.
3. Name the verification command when one exists.
4. Add only the constraints that change the outcome.
5. Remove redundant instructions before sending the prompt.
