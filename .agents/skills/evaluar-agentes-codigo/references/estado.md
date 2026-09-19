# Implementation state — 2026-09-15

The laboratory moved from the previous project to `buscador-hoteles` at Iñigo's request. The old localhost server was stopped; original evidence was retained in its original repository. This project keeps the fictional catalog and deterministic product.

Implemented: runner and desktop UI, editable specification/process, available/initial skills, column views, baseline selection, private acceptance, informed judge, language defaults and per-skill overrides. English and Spanish versions include skill references; snapshots preserve the chosen content. UI text remains Spanish. Custom prompt text remains literal.

Migration changes code baseline, package namespace and project guidance. Historical runs are contextual evidence, not an identical Spanish control. Requested campaign: two Luna high candidates, Spanish skills except English testing. Do not silently run additional candidates.

Validation and campaign results are recorded in local artifacts under `.agent-evals/`. Pending: a same-baseline Spanish control if requested, rejudgment UI, cancellation, full Penpot design, clean/legacy comparisons, scope and compaction analysis, evidence-based autonomy and automated improvement proposals.

## Completed campaign and next step

Campaign `2026-09-15T21-26-42.054Z-081bc520`: two concurrent Luna high runs, Spanish except English testing; both read that skill. Both pass private acceptance; run 001 fails lint/types and retains a circular URL expectation, run 002 passes external checks and adds independent expectations. This is not a causal language comparison across repositories. No mutation testing was run.

Read `.agent-evals/experiments/testing-language-en/report.md` for raw evidence and limitations. That campaign exposed Node realpath failures under isolation; the original evidence remains historical. See the correction below before running another campaign. Candidate test-script removal and generated-verifier formatting were corrected after the frozen campaign. Six UI tests and twelve localized skill validations pass. The UI at port 3415 now belongs to this repository. No additional candidates are authorized by these notes.

## Environment repair — 2026-09-16

The user explicitly authorized short Codex SDK diagnostics. Three Luna high processes verified all checks, only types/architecture, and no checks. Enabled verify commands pass; the absent command in the empty profile fails as expected; all private-canary reads are denied. The full profile also passes browser verification. Evidence: `.agent-evals/environment-validation/report-20260916.md`.

Candidates now run outside private controller parents with their own dependency copy and independent Git. The original checkout is restored afterward. Every enabled check runs under the candidate sandbox before the model starts; failure blocks the model. Preflight must be async and capture stdio through pipes to preserve browser responsiveness and avoid leaking private file descriptors. Controller tests are excluded from the candidate product suite. The 32 switch combinations, focused tests and repository verify pass. Use `eval:coding:validate` for deterministic diagnostics; `--models` explicitly adds SDK calls. This does not authorize a new language-comparison campaign.


## Overnight stabilization — 2026-09-16

The current authorized goal and exact continuation state live in `.agents/bitacoras/evaluador-noche-2026-09-16.md`. User authorized multiple Luna high tasks/variants until08:00, with Sol 5.6 high as judge. Do not inherit the older two-run limit for this explicit overnight request.

Candidate-written tests use Bun, product Playwright, eval Playwright or configured public acceptance runners separately. Reverify frozen delivery tests with `--reverify-candidate-tests RUN`; hash-matched corrections are shown by the UI without altering historical results or rerunning models. New judgments use six0–10 dimensions and a transparent weighted quality summary; execution status and deterministic acceptance remain separate. Historical0–2 judgments retain their scale. Judge process-summary.json limits duplicate trace reading, with full events preserved.

Candidate dependencies get a local browser adapter: Chromium launch uses the leased per-run browser in both Node and Bun, with launch process settings owned by the controller. Node/Bun browser health precedes enabled checks even in the zero-check profile. Provisioning discards its dependency copies after candidate delivery, then restores external links; code and evidence remain. Candidate snapshots exclude orchestration bitácoras.

## Reference restoration fixes — overnight16September

Preserve delivered package product metadata (exports/imports/type and other fields); restore only reference script tables. Keep new manifests and do not silently repair malformed or deleted product manifests. Reference suites include their helpers under tests/, while candidate-test verification preserves candidate helpers. Architecture policy configuration is a reference file. Availability provisioning refuses to remove a file outside reference restoration coverage.

Validate the entire no-model path: disable all candidate checks, snapshot unchanged product, restore reference verification, run all external gates. On16September this reproduced missing architecture helpers before the fix and passed all four gates afterward. SDK preflight alone does not prove post-delivery restoration.

`--reverify-delivery RUN` repeats checks and a Sol high judgment against a frozen delivery. Immutable original evidence is retained; hash-bound corrections accumulate chronologically, including a later candidate-tests-only correction. Keep protocol changes and candidate-context changes distinct in experiment provenance.


### Local laboratory access and isolation (2026-09-16)

Every local API read and write requires the controller capability, stored with mode 0600 in `.agent-evals/ui/access.json`. Open `http://127.0.0.1:3415/#access=<token>` once in the operator browser. The bootstrap clears the fragment and stores the capability for that origin, including its port. API requests explicitly send an Authorization header; cookies are not accepted, because localhost cookies would also reach other local ports. Version 2 rotates the earlier cookie credential. The original CSRF checks still apply to writes. Never copy the capability into candidate prompts, files or environments.

Candidate preflight checks denied controller/private/history directories, anonymous API access (403, or connection refused when offline), Node/Bun and the leased Chrome. Chrome has its own macOS profile: normal browser capabilities remain available, but reads and writes to controller/private roots are denied. Every browser launch checks a real private `file://` sentinel before serving a candidate; evidence lives in `.agent-evals/browser-isolation/`. This closes the direct file access that an unrestricted external Chrome allowed. macOS Chrome is supported by default; `EVAL_BROWSER_EXECUTABLE` selects an explicit compatible executable. Unsupported isolation fails closed. This is not certification against hostile code or an OS/browser exploit.


## Overnight close — 16 September 2026

The authorized night produced 46 evaluated Luna high deliveries across four tasks, with Sol 5.6 high judging: 29 pass, 17 fail, plus 1 infrastructure attempt stopped before the model. The final three deliveries pass after repairing a 5-second private-browser probe timeout. The probe waits for navigation commit up to 30 seconds and retries only one TimeoutError; a readable file, unexpected error or second timeout still fails closed. Four simultaneous browser probes and full verification passed. Preserve the failed attempt and protocol/concurrency differences in comparisons.

One complete four-candidate batch passed all private/general/candidate gates, with roughly 3.98 GiB peak summed process RSS on this 24 GiB machine. This is sampled shared-page RSS, not exclusive physical RAM or a universal concurrency guarantee.

The longer testing instruction did not show a clear benefit. Original English/Spanish testing files remain the defaults; both experimental variants and their frozen candidate snapshots are retained privately. Initial delivery of instructions is not proof of compliance. Saved-search state/reload/capacity bugs were independently reproduced despite green general and candidate tests. Versioned private `dossier-night-v2` bundles are ready for future saved-searches, advanced-filters and review-order recipes; current judgments retain their original frozen dossiers.

Morning report and exact provenance: `.agent-evals/night-summary-20260916/informe.md`, `runs.json`, `runs.csv`. These are controller-private; do not copy them into candidate guidance. No further autonomous night campaigns after the deadline. Future priorities: portable private state-transition acceptance, reserved-task comparisons, then legacy/clean and compaction experiments.

## Public documentation and private regression collection — 16 September 2026

The candidate environment explicitly permits official public documentation and Codex live web search; judges keep web search disabled and use their evidence packet. Native network/Chrome diagnostics are recorded in `.agent-evals/documentation-access-20260916/`. Availability is not proof of historical use.

Judges now emit bounded executable test proposals with public requirements and evidence. The controller collects them outside Git under private task storage, retaining specification/patch provenance, without executing or promoting generated code. Historical judgments remain readable. The orchestrator validates and versions the acceptance suite; promotion is not yet automatic. New campaigns freeze the controller's current rubric independently of the candidate code baseline.

A three-case private suite was validated against one positive and one negative frozen delivery using the real external verifier. The current saved-search recipe selects it. Exact cases, source hashes, validation artifacts, prior recipe and limits are controller-private in `.agent-evals/private-suite-validation-saved-v1-final/informe.md`. No new model calls and no historical score changes in this intervention. The general verification passed; collection tests use simulated judge output, not a new live judge.

## Results-only retention — 16 September 2026

The user explicitly requires disposable worktrees to be removed after evaluations. `retention.ts` now compacts finished runs/campaigns in finally blocks, preserving immutable final results, corrections, exact inputs/prompts, patches and metrics while removing registered worktrees, raw event copies, temporary judge packets and heavy browser output. It refuses active states and paths outside evaluation storage. `--clean-finished` applies the same policy historically. Compacted runs cannot reuse discarded evidence for rejudging/reverification; fail clearly before model calls. Git refs preserve revisions without materialized project copies.

All 26 completed campaigns and seven inactive diagnostic worktrees were cleaned. 117 result/judgment hashes unchanged; storage about3.7GiB→164MiB. Exact evidence in `.agent-evals/storage-cleanup-20260916/`. Private suites and proposals remain separate. Earlier notes about preserving raw campaign evidence are superseded by this explicit retention decision.

Compaction telemetry audit:52 candidate results partial,1missing,0observed markers; no exact counts. Installed CLI0.154.0-alpha.6.2 is not the stable version validated by the parser. Do not report zero or claim impact measurement. Summaries remain; deleted rollout contents cannot be reanalyzed retroactively. Future work: validate the actual CLI persistence contract and a forced-compaction probe.
