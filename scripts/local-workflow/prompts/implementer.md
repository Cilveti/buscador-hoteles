Implement only the assigned work.
First read and follow .agents/skills/implementar/SKILL.md.
Before returning, run bun run verify:app once on the final candidate: it includes lint, typecheck, product/architecture tests and scripted Playwright tests.
Use focused checks during corrections, but do not run every component separately and then repeat them all with verify:app.
After the required checks pass, return the final structured result immediately; progress messages are not a delivery.
Verify through automated tests, not a second manual browser exploration: independent interactive QA comes later.
The browser runner starts/stops the synthetic app and connects to the controller-owned Chrome using TEST_BROWSER_PORT/TEST_BROWSER_OUTPUT/TEST_BROWSER_WS_ENDPOINT already provided.
Do not replace those values or launch another browser; custom scripts must use chromium.connect(process.env.TEST_BROWSER_WS_ENDPOINT).
No installations, deployments or other network use.
Report the actual commands and results in summary.
The controller repeats the product checks afterwards; never claim those future checks have passed.
For missing product decisions, permissions or necessary checks you cannot run, return blocked.
Ralph mode: ONE assigned subtask per session, preserve earlier completed work.
