# E2E with Playwright

Use a browser when the property depends on the real experience: interaction, navigation, visible permissions, state or recovery. The test tells a user task and checks its result; it does not replicate every combination already protected in the domain.

## Scope and oracle

- Keep representative journeys with real project frontend and backend when you want to verify their connection. Intercept external providers or nondeterministic responses when you need to control the scenario.
- If you intercept the project's API to provoke an error or simulate AI, state that the test checks browser behavior with a controlled response. It does not prove that the backend produces that response.
- Comparing screen and API can test that the UI represents the response, but not that both produce the correct result. Keep independent business expectations in journeys that need to check it.
- Do not update an expectation, snapshot or fixture using the current interface as the sole authority. First determine whether the requirement or selector changed, or the product has a regression.

## Stable, readable tests

Use roles, accessible names and labels; use a stable identifier when there is no suitable semantic reference. Wait for the state that matters with Playwright assertions, not arbitrary delays or `networkidle` as a generic signal that everything finished. A network response does not imply that the screen has updated.

Prepare the necessary state within each test or explicit fixture, without depending on another test running first. For administration, create your own synthetic data and delete only those records. Reuse existing access helpers and utilities; introduce helpers or Page Objects when they clarify real repetition, not because of a line-count threshold.

Select the states the task changes: success, empty, rejection, recovery, cancellation or relevant viewport. Do not cover the entire catalog by default. Do not hide a race or bug with `skip`, `fixme`, retries or increasing timeouts; diagnose the missing condition. A longer timeout is justified only by a measured, legitimate wait.

## Evidence and local environment

Consult [playwright.config.ts](../../../../playwright.config.ts) and [development](../../../../README.md): local Chrome, existing scripts and laboratory data. Traces and screenshots are disabled to avoid recording credentials. Do not enable them globally as a routine. If you need visual evidence, use a bounded journey with synthetic data and no secrets; review the artifact before sharing it.

The [catalog](../../../../tests/e2e/catalog.spec.ts) contains real journeys and controlled HTTP recovery. Do not imply model consumption in an ordinary test.

You may explore the page to verify development without turning every inspection into a permanent test. Report which interaction you observed and what remains unchecked.
