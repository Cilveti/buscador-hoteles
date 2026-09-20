import { z } from 'zod';

export const specSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,60}$/),
    title: z.string().min(5),
    objective: z.string().min(15),
    scope: z.array(z.string().min(1)).min(1),
    outOfScope: z.array(z.string()),
    acceptance: z
      .array(z.object({ id: z.string().regex(/^AC[0-9]+$/), criterion: z.string().min(8) }))
      .min(1),
    decisions: z.array(z.string()),
  })
  .strict()
  .superRefine((spec, ctx) => {
    if (new Set(spec.acceptance.map((item) => item.id)).size !== spec.acceptance.length)
      ctx.addIssue({ code: 'custom', message: 'Acceptance IDs must be unique' });
  });
export type Specification = z.infer<typeof specSchema>;

export const researchSchema = z
  .object({
    summary: z.string(),
    files: z.array(z.string()),
    risks: z.array(z.string()),
    blockers: z.array(z.string()),
  })
  .strict();
export const planSchema = z
  .object({
    summary: z.string(),
    tasks: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z][a-z0-9-]{0,40}$/),
            title: z.string(),
            instructions: z.string(),
            criteria: z.array(z.string().regex(/^AC[0-9]+$/)).min(1),
          })
          .strict(),
      )
      .min(1)
      .max(6),
    blockers: z.array(z.string()),
  })
  .strict();
export type Plan = z.infer<typeof planSchema>;
export const implementationSchema = z
  .object({
    status: z.enum(['implemented', 'blocked']),
    summary: z.string(),
    blockers: z.array(z.string()),
  })
  .strict();
export const reviewSchema = z
  .object({
    status: z.enum(['pass', 'changes-requested', 'blocked']),
    summary: z.string(),
    findings: z.array(
      z.object({ path: z.string(), problem: z.string(), criterion: z.string() }).strict(),
    ),
  })
  .strict();

export const actionSchema = z
  .object({
    action: z.enum([
      'navigate',
      'click',
      'fill',
      'select',
      'press',
      'back',
      'inspect',
      'expect-text',
      'expect-url',
      'finish',
    ]),
    role: z.enum([
      'button',
      'link',
      'textbox',
      'combobox',
      'checkbox',
      'radio',
      'heading',
      'tab',
      'none',
    ]),
    name: z.string(),
    value: z.string(),
    rationale: z.string(),
    results: z.array(
      z
        .object({
          id: z.string().regex(/^AC[0-9]+$/),
          status: z.enum(['pass', 'fail', 'not-verified']),
          observed: z.string(),
          evidence: z.array(z.string().regex(/^screen-[0-9]{2}\.png$/)),
        })
        .strict(),
    ),
  })
  .strict();
export type BrowserAction = z.infer<typeof actionSchema>;

export function validatePlan(spec: Specification, plan: Plan): void {
  const ids = plan.tasks.map((task) => task.id);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate subtask ID');
  const criteria = new Set(spec.acceptance.map((item) => item.id));
  const covered = new Set(plan.tasks.flatMap((task) => task.criteria));
  if ([...covered].some((id) => !criteria.has(id)) || [...criteria].some((id) => !covered.has(id)))
    throw new Error('Plan must cover exactly the specification criteria');
}

export function validQaFinish(
  spec: Specification,
  action: BrowserAction,
  screenshots: string[],
): boolean {
  if (action.action !== 'finish' || action.results.length !== spec.acceptance.length) return false;
  const ids = new Set(action.results.map((result) => result.id));
  return (
    spec.acceptance.every(({ id }) => ids.has(id)) &&
    action.results.every(
      (result) =>
        result.observed.trim().length > 0 &&
        result.evidence.every((file) => screenshots.includes(file)) &&
        (result.status !== 'pass' || result.evidence.length > 0),
    )
  );
}
