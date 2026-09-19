# Unit tests and use cases

Use Bun for pure rules and use cases with controlled effects. The unit is a coherent behavior, not necessarily an isolated function. Test through the interface its clients consume; do not export private details just to test them.

## Choose discriminating cases

- Start from a minimal example whose result you can justify without executing the code. Add boundaries and combinations that change a decision, not cosmetic variations of the same case.
- Distinguish absence, zero, false and unknown when the domain does. In the catalog, an unknown rating is not a zero rating and a conditional policy is not confirmed permission.
- For a state transition, observe what remains in effect after the action: preserved filters, invalidated results or effective cancellation. Do not test a private sequence of calls unless it is part of the contract.
- When reproducing a bug, verify that the test fails with the defect present and passes with the fix. An import or fixture error does not show that it detects the bug.

## Test doubles and data

Inject nondeterministic facts through existing extension points. Use a small fake of the port when you need state, or a controlled response when a value is enough. Do not simulate every internal function or introduce an interface per test.

An expected result must be independent, even when input data is created with typed factories. Do not use the same production helper to calculate both sides of the assertion. Verify relevant effects through the observable contract; counting calls only makes sense if the number is a real obligation, such as avoiding a duplicate charge or request.

## Local fit

Rule tests live alongside their code. [Catalog search](../../../../packages/core/src/catalog/search.test.ts) shows combined filters, unknown values and confirmed policies. Interaction state tests live in `apps/web/src/features/*/application/`, without needing React or a browser for rules that do not depend on them.

Do not add a property-based testing library by default. If there is a useful invariant and many possible inputs, it may be a justified extension; a property that reproduces the algorithm is still a poor check.
