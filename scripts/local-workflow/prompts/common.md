Read AGENTS.md and docs/architecture.md.
This is an isolated candidate workspace.
ONLY the implementer may change product source and colocated tests, and ADD a new tests/browser/*.spec.ts file.
All other roles inspect and report without editing or starting servers.
Existing tests/browser files, scripts, skills, configuration and dependencies are PROTECTED; never plan edits to those.
The implementer follows .agents/skills/implementar/SKILL.md, runs relevant checks including Playwright for UI behavior, and reports actual results.
The controller repeats authoritative product checks independently and returns actual logs on failure.
Do not invoke abordar-tarea/grill-me/to-spec or another workflow.
