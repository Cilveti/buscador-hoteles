# Approach a development task

The specification defines what the product must satisfy. This skill defines how to approach the work and gather evidence for delivery. Decide technical design and decomposition based on the existing code; a small task does not need a ceremonial plan.

## Understand and execute

Read the requirements, affected context and project instructions. Identify what is already solved and the boundaries you must respect. Consult specific skills that provide criteria for this task: in this project, [testing](../../hoteles-testing/SKILL.md), [architecture](../../hoteles-hexagonal/SKILL.md) and, for UI, [search verification](../../hoteles-verificar-buscador/SKILL.md).

Relate each requirement to observable behavior and a way to check it. You may keep this relationship in your notes; a document or a test per sentence is not required. Resolve reversible technical decisions with judgment. If a missing product decision changes the result, identify the blocker; do not invent requirements.

Implement verifiable increments and use tool feedback to correct them. When extending an existing test, check that its expectations can detect an incorrect implementation: outputs of the same function must not be the only source of truth. Follow the project's testing guidelines, without duplicating cases or adding tests that merely reproduce the implementation.

## Check the result before finishing

Cross-check each requirement against the implementation and verification evidence. Check the main journey and relevant edge cases: for example, absent values, removing the last selection, combinations, state restoration and error recovery where applicable. Select cases based on the task's rules and risks; do not make exhaustive combinations without value.

Before finishing, verify the relevant state transitions. For each one, identify the initial state, the action and the expected resulting state according to the requirements. Establish that initial state, perform the action and check what must appear, disappear or remain unchanged. Apply this also to error paths and limits: verify the resulting state, not just that the action ran or a message appeared.

In UI, check behavior, text and visible state **after interacting and restoring the page**, as well as the initial state. Review relevant accessibility. Run or extend browser journeys covering these behaviors; passing an existing suite does not establish requirements it does not check. Do not manually repeat already covered journeys unless there is a specific uncertainty.

Use the browser environment indicated by the corresponding skill. If the controller provides a connection to an existing browser, use it in custom scripts too; do not launch another process or replace its parameters. A startup failure does not validate the interface: diagnose it with the available guide or record the pending check.

In this project, run `bun run verify` (lint, types, full suite and base browser) and the `acceptanceCommand` from `evals/coding/tasks/<task>/task.json` when the task has visible acceptance. Fix introduced failures and check again after the last modification. If an already executed check still covers exactly the delivered state, do not repeat it without a reason.

Review the final diff: scope, readability, contracts, useful tests and absence of accidental changes. Do not lower requirements or weaken checks to get green. Separate introduced failures from environment errors or previous debt; attribute the cause only with evidence, not because a file is outside your change.

## Deliver

Summarize what was implemented, the checks executed and their results, with links to useful evidence. State requirements or cases you could not check. Do not present a failed check or an execution attempt as passed. You do not need a huge table: let the reviewer understand what works, what was verified and what is missing.
