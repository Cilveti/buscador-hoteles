import { object, string } from './github';

export type WorkerRole = 'implementer' | 'reviewer';

export function resultSchema(role: WorkerRole) {
  const summary = { type: 'string', minLength: 1, maxLength: 4000 };
  return role === 'reviewer'
    ? {
        type: 'object',
        additionalProperties: false,
        required: ['status', 'summary', 'findings'],
        properties: {
          status: { type: 'string', enum: ['pass', 'changes-requested'] },
          summary,
          findings: {
            type: 'array',
            maxItems: 30,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['path', 'reason'],
              properties: {
                path: { type: 'string', minLength: 1, maxLength: 255 },
                reason: { type: 'string', minLength: 1, maxLength: 2000 },
              },
            },
          },
        },
      }
    : {
        type: 'object',
        additionalProperties: false,
        required: ['status', 'summary'],
        properties: {
          status: { type: 'string', enum: ['implemented', 'needs-human', 'blocked'] },
          summary,
        },
      };
}

/** Recheck the transport result independently; schema output is not publication authority. */
export function validateResult(value: unknown, role: WorkerRole): Record<string, unknown> {
  const result = object(value);
  const keys = role === 'reviewer' ? ['status', 'summary', 'findings'] : ['status', 'summary'];
  if (Object.keys(result).some((key) => !keys.includes(key)))
    throw new Error('Unexpected result field');
  const summary = string(result.summary);
  if (!summary.trim() || summary.length > 4000) throw new Error('Invalid result summary');
  const statuses =
    role === 'reviewer' ? ['pass', 'changes-requested'] : ['implemented', 'needs-human', 'blocked'];
  if (!statuses.includes(string(result.status))) throw new Error('Invalid result status');
  if (role === 'reviewer') {
    if (!Array.isArray(result.findings) || result.findings.length > 30)
      throw new Error('Invalid findings');
    for (const value of result.findings) {
      const finding = object(value);
      const path = string(finding.path);
      const reason = string(finding.reason);
      if (
        Object.keys(finding).some((key) => !['path', 'reason'].includes(key)) ||
        !path.trim() ||
        path.length > 255 ||
        !reason.trim() ||
        reason.length > 2000
      )
        throw new Error('Invalid finding');
    }
    if (result.status === 'pass' && result.findings.length)
      throw new Error('Inconsistent review verdict');
  }
  return result;
}
