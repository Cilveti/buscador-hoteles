# Integration

Choose this test when the risk lies in how real pieces connect: an adapter translates a contract, persistence enforces a constraint or an endpoint composes a use case. State which components execute and which dependency is substituted.

## What to check

- Verify the relevant round trip: accepted input, transformation, persisted data or public result. HTTP 200 does not prove that the operation did the right thing.
- Cover representative failures at the changed boundary: denied permissions, incompatible data, absence or unavailability. Do not generate a test for every imaginable HTTP code.
- Execute the adapter you want to validate. A mock of that adapter only checks its consumer. A repository fake may serve the use case, but does not establish SQL, transactions or PostgreSQL constraints.
- For persistence, observe the stored state through an independent read appropriate to that boundary. Do not require going through the UI to verify a database constraint.

## Isolation

Use identifiable synthetic records or a test schema, and clean up only the resources created by that execution, including on failure. Reuse repository utilities. Do not empty tables or reset the corpus to isolate a test.

Opt-in local integrations have prerequisites: consult [development](../../../../README.md) and the test before running them. Do not change a URL to a remote service if the local one is missing. A test skipped because infrastructure is unavailable is reported as not run, not as evidence of correct integration.

## Local fit

The [catalog handler tests](../../../../apps/web/src/app/api/catalog/hotels/handler.test.ts) check the HTTP boundary with controlled dependencies; do not confuse them with a Payload/PostgreSQL check. When modifying the real adapter, also select a test that executes it against the corresponding local service.

Paid model calls do not belong in this suite by default. Provider contracts use reproducible responses; real quality and connectivity are checked separately.
