import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  WorkflowAgent,
  WorkflowCheck,
  WorkflowHandoff,
  WorkflowRun,
  WorkflowStep,
} from './contracts';
import { agentId, localWorkflowRun, stepStatus } from './local';

type Json = Record<string, unknown>;
const object = (value: unknown): Json =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {};
const string = (value: unknown) => (typeof value === 'string' ? value : null);
const number = (value: unknown) => (typeof value === 'number' ? value : null);
const list = (value: unknown) => (Array.isArray(value) ? value : []);
function json(path: string): Json {
  try {
    return object(JSON.parse(readFileSync(path, 'utf8')));
  } catch {
    return {};
  }
}
function jsonList(path: string): unknown[] {
  try {
    return list(JSON.parse(readFileSync(path, 'utf8')) as unknown);
  } catch {
    return [];
  }
}
function verificationChecks(value: unknown, group: string): WorkflowCheck[] {
  return list(object(value).checks).map((raw) => {
    const check = object(raw);
    return {
      id: string(check.id) ?? 'check',
      group,
      status: stepStatus(string(check.status) ?? ''),
      durationMs: number(check.durationMs),
    };
  });
}
function activePhase(run: string, root: string): string {
  if (existsSync(join(root, 'judge-session'))) return 'judging';
  if (existsSync(join(root, 'delivery.json'))) return 'verifying';
  if (existsSync(join(root, 'workflow/state.json'))) return 'workflow';
  return run === 'running' ? 'implementing' : run;
}
function evaluationSteps(root: string, result: Json): WorkflowStep[] {
  const events = list(object(result.workflow).events);
  if (events.length) {
    const steps = events.flatMap((raw, index) => {
      const event = object(raw);
      const phase = string(event.status);
      if (!phase) return [];
      return [
        {
          id: `workflow-${index}`,
          phase,
          title: phase,
          status: index === events.length - 1 ? stepStatus(phase) : ('passed' as const),
          at: string(event.at),
          message: string(event.message) ?? '',
        } satisfies WorkflowStep,
      ];
    });
    steps.push({
      id: 'external-verification',
      phase: 'verifying',
      title: 'Checks externos y aceptación',
      status:
        result.repositoryChecksPassed === true && result.privateAcceptancePassed !== false
          ? 'passed'
          : result.repositoryChecksPassed === false || result.privateAcceptancePassed === false
            ? 'failed'
            : 'unknown',
      at: null,
      message: 'Comprobaciones posteriores a la entrega del candidato.',
    });
    steps.push({
      id: 'judge',
      phase: 'judging',
      title: 'Juez',
      status:
        result.judgeTaskVerdict === 'pass'
          ? 'passed'
          : result.judgeTaskVerdict === 'fail'
            ? 'failed'
            : 'unknown',
      at: null,
      message: string(object(result.judgment).verdict) ?? 'Pendiente',
    });
    return steps;
  }
  const rawStatus = string(result.status) ?? 'running';
  const current = activePhase(rawStatus, root);
  return [
    {
      id: 'candidate',
      phase: 'implementing',
      title: 'Agente candidato',
      status:
        current === 'implementing'
          ? 'running'
          : existsSync(join(root, 'delivery.json')) || rawStatus === 'evaluated'
            ? 'passed'
            : 'unknown',
      at: string(result.startedAt),
      message: 'Implementación y entrega.',
    },
    {
      id: 'checks',
      phase: 'verifying',
      title: 'Checks externos',
      status:
        result.repositoryChecksPassed === true
          ? 'passed'
          : result.repositoryChecksPassed === false
            ? 'failed'
            : current === 'verifying'
              ? 'running'
              : 'pending',
      at: null,
      message: 'Referencia, tests propios y aceptación reservada.',
    },
    {
      id: 'judge',
      phase: 'judging',
      title: 'Juez',
      status:
        result.judgeTaskVerdict === 'pass'
          ? 'passed'
          : result.judgeTaskVerdict === 'fail'
            ? 'failed'
            : current === 'judging'
              ? 'running'
              : 'pending',
      at: null,
      message: 'Juicio y nota de calidad.',
    },
  ];
}
/** Same UI contract for a scored run, including a single implementer. */
export function evaluationRun(
  campaign: string,
  run: string,
  root: string,
  summary = false,
): WorkflowRun {
  const result = json(join(root, 'result.json'));
  const config = object(result.config);
  const workflow = object(result.workflow);
  const full = config.candidateKind === 'workflow' || result.candidateKind === 'workflow';
  const liveWorkflow =
    full && existsSync(join(root, 'workflow/state.json'))
      ? localWorkflowRun(join(root, 'workflow'))
      : null;
  const archiveAgents = jsonList(join(root, 'trace-archive/agents.json')).flatMap((raw) => {
    const agent = object(raw);
    const id = string(agent.id);
    if (!id || !/^(?:candidate|[a-f0-9]{16})$/.test(id)) return [];
    return [
      {
        id,
        role: string(agent.role) ?? 'agent',
        harness: string(agent.harness) ?? 'unknown',
        model: string(agent.model),
        status: stepStatus(string(agent.status) ?? ''),
        startedAt: string(agent.startedAt),
        durationMs: number(agent.durationMs),
        traceAvailable: existsSync(join(root, 'trace-archive', `${id}.projected.jsonl`)),
        output: string(agent.output),
        sessionId: string(agent.sessionId),
        resumeCommand: null,
      } satisfies WorkflowAgent,
    ];
  });
  const calls = list(workflow.workerCalls);
  const agents: WorkflowAgent[] =
    liveWorkflow?.agents ??
    (archiveAgents.length ? archiveAgents : null) ??
    (full
      ? calls.map((raw) => {
          const call = object(raw);
          const timing = object(call.timing);
          const path = string(call.path) ?? '';
          return {
            id: agentId(path),
            role: string(call.role) ?? 'agent',
            harness: 'codex',
            model: string(call.model),
            status: call.completed === true ? 'passed' : 'unknown',
            startedAt: string(timing.startedAt),
            durationMs: number(timing.durationMs),
            traceAvailable: false,
            output: null,
            sessionId: null,
            resumeCommand: null,
          } satisfies WorkflowAgent;
        })
      : [
          {
            id: 'candidate',
            role: 'implementer',
            harness: string(config.harness) ?? 'unknown',
            model: string(config.model),
            status:
              result.status === 'running'
                ? 'running'
                : object(result.candidate).status === 'completed'
                  ? 'passed'
                  : 'unknown',
            startedAt: string(result.startedAt),
            durationMs: number(object(result.candidate).durationMs),
            traceAvailable:
              existsSync(join(root, 'candidate-session/events.jsonl')) ||
              existsSync(join(root, 'trace-archive/candidate.projected.jsonl')),
            output: existsSync(join(root, 'candidate-session/final.txt'))
              ? readFileSync(join(root, 'candidate-session/final.txt'), 'utf8').slice(0, 12_000)
              : null,
            sessionId: null,
            resumeCommand: null,
          } satisfies WorkflowAgent,
        ]);
  const steps = liveWorkflow?.steps ?? evaluationSteps(root, result);
  const checks = [
    ...(liveWorkflow?.checks ??
      list(workflow.verification).flatMap((raw) =>
        verificationChecks(raw, string(object(raw).path) ?? 'workflow'),
      )),
    ...verificationChecks(result.verification, 'externos'),
    ...verificationChecks(result.candidateTestVerification, 'tests del candidato'),
    ...verificationChecks(result.privateAcceptanceVerification, 'aceptación privada'),
  ];
  const handoffs: WorkflowHandoff[] = liveWorkflow?.handoffs ?? [
    ...list(workflow.feedback).map((raw, index) => ({
      id: `feedback-${index}`,
      kind: 'feedback' as const,
      title: string(object(raw).path) ?? 'Feedback',
      content: string(object(raw).text) ?? '',
    })),
    ...list(workflow.reviews).map((raw, index) => ({
      id: `review-${index}`,
      kind: 'review' as const,
      title: string(object(raw).path) ?? 'Review',
      content: JSON.stringify(object(raw).result, null, 2),
    })),
    ...list(workflow.qa).map((raw, index) => ({
      id: `qa-${index}`,
      kind: 'qa' as const,
      title: string(object(raw).path) ?? 'QA',
      content: JSON.stringify(object(raw).results, null, 2),
    })),
  ];
  const rawStatus = string(result.status) ?? 'running';
  const failedWithoutVerdict = [
    'incomplete',
    'baseline_failed',
    'evaluation_error',
    'failed',
    'interrupted',
  ].includes(rawStatus);
  return {
    ref: `evaluation:${campaign}:${run}`,
    source: 'evaluation',
    definitionId: full ? 'delivery' : 'single-agent',
    title: string(config.task) ?? string(result.id) ?? run,
    runId: `${campaign}/${run}`,
    status:
      rawStatus === 'running'
        ? 'running'
        : result.outcome === 'pass'
          ? 'passed'
          : result.outcome === 'fail'
            ? 'failed'
            : failedWithoutVerdict
              ? 'failed'
              : stepStatus(rawStatus),
    rawStatus,
    message: result.outcome
      ? `Resultado: ${String(result.outcome)}`
      : (liveWorkflow?.message ??
        (failedWithoutVerdict
          ? `Evaluación incompleta: ${string(result.error) ?? rawStatus}`
          : rawStatus === 'running'
            ? 'Evaluación en curso'
            : `Estado: ${rawStatus}`)),
    startedAt: string(result.startedAt),
    updatedAt: string(result.finishedAt) ?? string(result.startedAt),
    round: number(workflow.rounds) ?? liveWorkflow?.round ?? null,
    score: number(result.score),
    agents: summary ? [] : agents,
    steps: summary ? [] : steps,
    checks: summary ? [] : checks,
    handoffs: summary ? [] : handoffs,
    artifacts: summary
      ? []
      : [
          { id: 'patch', label: 'Patch', available: existsSync(join(root, 'candidate.patch')) },
          { id: 'result', label: 'Resultado', available: existsSync(join(root, 'result.json')) },
        ],
  };
}
