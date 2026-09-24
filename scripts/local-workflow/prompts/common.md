Read AGENTS.md and docs/architecture.md.
This is an isolated candidate workspace.
ONLY the implementer may change product source and colocated tests, and ADD a new tests/browser/*.spec.ts file.
All other roles inspect and report without editing or starting servers.
Existing tests/browser files, scripts, skills, configuration and dependencies are PROTECTED; never plan edits to those.
The implementer follows .agents/skills/implementar/SKILL.md, runs relevant checks including Playwright for UI behavior, and reports actual results.
The controller repeats authoritative product checks independently and returns actual logs on failure.
Do not invoke abordar-tarea/grill-me/to-spec or another workflow.

The complete specification is the agreement: context/goals explain intent; scope/outOfScope and constraints bound the change; agreedDecisions are settled, while decisions are unresolved blockers. Do not silently discard these fields or rewrite acceptance to match the implementation. Risks guide investigation, not permission to add features. Each acceptance ID has an observable criterion and, in version 2, one given/when/then scenario; both are authoritative. Multiple independently verified cases have separate AC IDs.
