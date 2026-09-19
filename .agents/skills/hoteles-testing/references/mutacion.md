# Mutation testing

Use it to evaluate whether tests detect incorrect changes to relevant rules, especially when they have coverage but might assert little. It is not a check for every edit or a goal of reaching 100%: running and maintaining tests also costs effort.

## Scope and execution

1. Inspect the existing configuration, the code it mutates and the tests it runs. First check that those tests pass without mutation; otherwise resolve or report the baseline failure before interpreting mutants.
2. Choose a bounded, valuable rule or change. Keep the scope explicit in the report. Do not add a global campaign, new scripts or blocking thresholds without a need and an initial measurement.
3. Run Stryker and review its saved report. Improve tests for relevant survivors and repeat over the affected scope; do not run another campaign merely to reread its output.

## Project configuration

[stryker.config.json](../../../../stryker.config.json) already exists, with its scripts in [package.json](../../../../package.json). It mutates capacity rules; it is not a campaign over the whole catalog.

Stryker uses `testRunner: "command"` with a finite Bun command and `coverageAnalysis: "off"`. This runner executes the configured set for each mutant: it does not provide per-test coverage selection or allow absence of coverage to be interpreted like an integrated runner. Do not copy `perTest` from a Vitest example or switch runners without a reason. Keep pinned local versions, without initializers or `@latest` downloads just to run the test.

Current sandboxes do not mutate the working tree (`inPlace: false`) and exclude secrets. When expanding the scope, check that exclusions do not omit necessary code. If you choose to mutate a diff between commits, check which unversioned work is excluded; do not present it as the whole change or implicitly make commits/stashes.

## Interpret rather than disguise

- **Detected:** the test fails with the mutant. Check that the failure represents the expected rule when strengthening a particular case.
- **Relevant survivor:** there is a different observable input or effect permitted by the contract. Add the smallest behavior test that distinguishes it.
- **Equivalent:** behavior does not change under the current contract. Explain the argument; do not fabricate tests of internals to kill it. If you cannot justify equivalence, record the uncertainty.
- **Error, timeout or incomplete campaign:** investigate execution and distinguish its status from assertion results. Do not describe them as a test that detected the bug.

Do not narrow `mutate`, weaken fixtures, suppress operators or change thresholds to improve the apparent percentage. Justified exclusions must be explicit, with their effect on scope. Do not change a production rule merely to make mutants easier to kill either.

For a focused manual check, isolate the deliberate change, observe red and restore only that mutation before checking green. Preserve previous changes; do not use broad resets. Report scope, detected mutants, survivors and limitations, without attributing that result to the whole system.
