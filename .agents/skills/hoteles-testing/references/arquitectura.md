# Architectural integrity

An architectural test checks a dependency decision; it does not prove that the whole design is good or by itself limit which files an agent may edit. To decide boundaries, consult [the hexagonal skill](../../hoteles-hexagonal/SKILL.md) and [the current architecture](../../../../docs/architecture.md).

## What to automate

Add a rule when violating it matters enough to reject that change: for example, core importing Payload or frontend application code depending on React. Do not turn preferences about names, folder counts or class counts into mandatory architecture.

The repository declares rules in [dependency-cruiser](../../../../.dependency-cruiser.cjs) and runs them through a [Bun check](../../../../tests/architecture/dependencies.test.ts), available as `bun run check:architecture` and included in `test`/`verify`. Extend the configuration when a new boundary appears. The [fixtures](../../../../tests/architecture/configuration.test.ts) verify allowed and forbidden dependencies. A small AST guard still rejects computed paths (`import(variable)` and `require(variable)`), which the tool does not incorporate into the graph. Follow the real import graph: relative paths, aliases, types, reexports and dynamic loads can cross a boundary even when the bundler removes some code.

## Check the detector too

- Keep examples of allowed and forbidden dependencies, including paths that could evade the new rule. Use small snippets as detector input data; do not introduce illegal production imports and leave them there.
- A failure must identify the source, rejected dependency and decision it protects. An empty list is useful only if the detector actually examined the intended scope: detect an unexpectedly empty scope rather than passing vacuously.
- Do not relax the pattern, exclusion or allowlist just because the change violates it. If the architecture needs a legitimate exception, make its reason and scope explicit before adding it.

An import rule can prevent certain dependencies, but cannot by itself detect all business logic placed in the wrong location. Complement it with behavior tests and design review; do not declare boundaries covered when the detector does not inspect them yet.
