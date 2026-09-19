---
name: hoteles-testing
description: Choose, write and review checks for a change in the hotel search project. Use when implementing behavior, fixing bugs or improving tests; load references by test type. Does not replace LLM quality evaluations.
---
# Testing philosophy and strategy

Tests protect product behavior and decisions, not the incidental shape of the code. Before adding one, identify the relevant breakage it would detect and where the expected result comes from: an agreed requirement, a worked example or a reviewed fixture. Do not recalculate the expectation with the implementation under test.

Consult the acceptance criterion, the area's tests and the [project commands](../../../README.md); cross-check scripts against [package.json](../../../package.json). Bun is the package manager and deterministic runner; Playwright and Stryker are already configured. Use what exists, without installing another methodology, runner or command catalog by default.

## How to choose and work

- Choose the smallest check that can detect the real failure. Move to integration or browser tests when the property depends on that connection; do not duplicate every case across all layers or pursue a universal ratio or coverage target.
- For new behavior or a bug, work in vertical increments: observe red for the right reason, implement what is needed and refactor while staying green. A pure refactor uses tests that already protect the contract; if they are missing, characterize the relevant behavior first. This does not require a test per function or human approval for each test.
- Execute real project code. Control clocks, IDs and nondeterministic providers at justified boundaries; a test double does not test the integration it replaces. Abstractions are justified by design and behavior, not by making mocking easier.
- Use small, readable, typed fixtures; avoid `any`, casts that disguise impossible data, massive snapshots and tests that only inspect source text or internal calls. A helper should clarify intent, not hide the scenario and expectation.
- Focused exploration helps you learn; it does not require keeping a permanent test. Retain tests when they protect a rule, journey or risk worth maintaining.

## References by change

Read the applicable references before designing or modifying those tests; do not load the rest. A change may need more than one.

| What you need to check | Reference |
|---|---|
| Pure rule, use case or state transition | [Unit tests and use cases](references/unitarios.md) |
| Mapping, persistence or real collaboration between components | [Integration](references/integracion.md) |
| External data, Zod schemas and inferred types | [Contracts and validation](references/contratos.md) |
| Allowed dependencies and architectural isolation | [Architectural integrity](references/arquitectura.md) |
| Visible journey, interaction or recovery in a browser | [E2E with Playwright](references/e2e.md) |
| Whether tests detect incorrect changes to a rule | [Mutation testing](references/mutacion.md) |

## On failure and before finishing

A failure may indicate a bug, an incorrect expectation or an environment problem. Identify which with evidence. Do not delete, weaken, skip or update tests/snapshots to accommodate a regression. If the requirement has explicitly changed, update the test explaining the new expectation; if the contract is ambiguous or contradictory, ask about that decision rather than inventing one to get green.

Run the focused test first, then checks affected by the change's impact, including types and other boundaries when appropriate. Check what the script actually includes: neither a name such as `test` proves full coverage nor does an omitted suite count as a correct suite. Also review the diff of tests, fixtures and configuration.

Briefly report the behavior checked, command and result, substituted dependencies and pending checks. Do not attribute a suite's guarantees to a browser inspection or the absence of bugs to a green result.

LLM responses used in ordinary tests are deterministic fixtures. Real quality evaluations require their own dataset, configuration and budget: run them separately following the [evaluation guide](../../../evals/coding/README.md), not as a consequence of asking for ordinary tests.
