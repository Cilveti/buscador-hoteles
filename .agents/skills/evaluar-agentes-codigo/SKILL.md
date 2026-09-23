---
name: evaluar-agentes-codigo
description: Develop and use this project's local coding-harness evaluation laboratory, including recipes, skills, private acceptance and an informed judge. Use for implementing the system, running authorized campaigns and analyzing coding deliveries, not for adding AI to hotel search.
---
# Evaluate coding harnesses

The laboratory lives in `scripts/coding-eval/` and `evals/coding/`. Read the [runner guide](../../../evals/coding/README.md) for configuration and artifacts, and [implementation state](references/estado.md) when resuming development. Keep work in this project; do not extract a framework without a new request.

## Design the comparison

Freeze the code baseline, specification, process prompt, skills and their references, checks, rubric and private judge knowledge. Change the intended ingredient and record environmental differences. Model runs remain stochastic. Two observations cannot establish reliability or a causal language effect across different repositories.

`skillLanguage` selects English (`en`) or Spanish (`es`); `skillLanguages` overrides individual skills. English sources are discoverable in `.agents/skills/`; Spanish sources live in `evals/coding/skill-locales/es/`. Translate instructions faithfully, including references, without adding stronger requirements in one language. Candidates receive only the selected versions at canonical skill paths. Keep skill IDs, paths and commands stable. Exact edited `promptText` and `specificationText` take precedence over sources and are never translated automatically.

Separate available skills, skills injected initially and the process prompt. Loading a skill is evidence of delivery, not compliance. Read traces to establish whether it was opened; inline injection needs no subsequent read. Do not score the number of skill calls as quality.

## Execute

Implementing infrastructure does not authorize unlimited model campaigns. Use the requested model, effort, number of runs and concurrency. First prepare and verify the baseline without models. A repository gate failure blocks candidates; expected red acceptance for pending functionality does not. Freeze the resulting commit for subsequent comparisons.

Each candidate runs in a disposable worktree. Private acceptance and the judge dossier stay outside its checkout and readable Git history. Codex candidates use an independent Git root and native deny rules for controller/private storage. Fail closed if isolation is unavailable; never remove restrictions to make a run start. The browser has a separate native profile denying controller/private file access, verified at every launch; this is not a hostile-code isolation certification.

Use assigned browser ports/endpoints and synthetic data. Stop only processes owned by the run. Do not use the everyday app/database or modify credentials. Candidates use an isolated dependency copy (reflinks when supported); workspace packages resolve to the candidate. The worktree runs outside private controller parent paths and is restored afterward. Before calling the model, execute every enabled check under the same native permissions and environment. Any failure blocks the model and records evidence in environment-preflight/. Use `bun run eval:coding:validate` to diagnose provisioning without models; add `--models` only for explicitly authorized short SDK probes. Run external checks after delivery and separately execute candidate-written tests. Do not feed private failures back to the candidate unless explicitly testing a repair protocol.

## Judge and interpret

The judge is fixed: Codex `gpt-6-sol`, `high`. It reads the frozen delivery, requirements, checks, traces and privileged dossier. The Golden Dataset is privileged knowledge of intended behavior, constraints and known bugs, not a required literal patch. Historical judgments retain their original judge identity. Do not create a separate judge-evaluation project.

Report functionality, code quality, test quality, guideline compliance, verification process and report accuracy separately. A judge review finding is not a deterministic reproduction or mutation result. Distinguish prior debt, necessary integration with legacy code and unsolicited scope expansion. Compactions are observed process data, not inherently failures; unknown coverage is not zero.

Preserve immutable final results and failed-attempt summaries. The user requires results-only retention: remove evaluation worktrees, raw traces, temporary judge packets and heavy browser artifacts after completion, preparation or failure. Keep configuration, prompts, patch, final messages and metrics; never clean an active or unrelated worktree. Compacted runs cannot be rejudged from discarded evidence. CLI errors, cancellation, timeout, failed checks and unavailable costs must remain explicit. API-equivalent token cost is an estimate, not a subscription invoice. Rejudging creates a new result alongside the original and reuses historical checks; it does not rerun them or overwrite history.

## Accumulate private regressions

Judges return executable `regressionTests`; the controller stores them outside the repository with requirement, finding, specification hash and delivery provenance. Collection never executes or promotes generated code. Before adding a test to a versioned private acceptance bundle, the orchestrator must reproduce the intended product assertion on the faulty delivery and pass it on a correct reference for that requirement. Infrastructure/selector failures remain pending. Select the new bundle in future recipes; historical campaigns retain their frozen suite and scores. See the runner guide for paths and artifacts. Candidates may consult public official documentation over the network; available access is not evidence that they actually did.

## Future direction

Keep the local desktop composer, table views and exact snapshots useful before expanding. Next experiments include clean/legacy baselines, ambiguous scope, compaction effects and successive tasks. Continuous improvement can detect failures, propose a harness change and compare it on frozen tasks. Evidence can inform autonomy; scores do not authorize merge, deployment or broader permissions.
