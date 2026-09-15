import { config } from './config';
import { api, object, repoPath } from './github';

/** Read-only by default. --apply creates labels/state; permission expansion is a separate flag. */
const apply = process.argv.includes('--apply');
const identity = object(api('user'));
const repository = object(api(`repos/${config.repository}`));
const permissions = object(api(repoPath('actions/permissions/workflow')));
const secrets = object(api(repoPath('actions/secrets')));
const secretNames = Array.isArray(secrets.secrets)
  ? secrets.secrets.map((item) => object(item).name)
  : [];
console.log(
  JSON.stringify(
    {
      repository: repository.full_name,
      identity: identity.login,
      defaultBranch: repository.default_branch,
      isAdmin: object(repository.permissions).admin,
      canCreatePR: permissions.can_approve_pull_request_reviews,
      secretsPresent: {
        model: secretNames.includes('OPENCODE_API_KEY'),
        sonar: secretNames.includes('SONAR_TOKEN'),
      },
      apply,
    },
    null,
    2,
  ),
);
if (repository.default_branch !== config.baseBranch)
  throw new Error('Configure the actual default branch');
if (!config.operators.some((operator) => operator === identity.login))
  throw new Error('Authenticated user is not a configured operator');
if (apply) {
  if (!object(repository.permissions).admin)
    throw new Error('Setup requires repository administration');
  const existing = api(repoPath('labels?per_page=100'));
  const labels = Array.isArray(existing) ? existing.map((item) => object(item).name) : [];
  for (const [name, color, description] of [
    ['factory:basic', '0e8a16', 'Application code only; no dependency changes'],
    [
      'factory:full',
      'd93f0b',
      'Application code and dependency declarations; controls remain protected',
    ],
    ['factory:ready', '0052cc', 'Admit a new task; durable state prevents duplicate runs'],
    ['factory:visual', '5319e7', 'Requires a versioned design snapshot'],
    [
      'factory:improvement',
      'bfd4f2',
      'Proposed harness improvement; separate human-reviewed process',
    ],
  ] as const) {
    if (!labels.includes(name)) api(repoPath('labels'), 'POST', { name, color, description });
  }
  const branches = api(repoPath('branches?per_page=100'));
  const exists =
    Array.isArray(branches) && branches.some((item) => object(item).name === 'factory-state');
  if (!exists) {
    const base = object(api(repoPath(`git/ref/heads/${config.baseBranch}`)));
    api(repoPath('git/refs'), 'POST', {
      ref: 'refs/heads/factory-state',
      sha: object(base.object).sha,
    });
  }
  console.log('Labels and durable state branch are ready. No model invocation or secret transfer.');
}
if (process.argv.includes('--enable-prs')) {
  if (!apply) throw new Error('--enable-prs requires --apply and explicit owner authorization');
  api(repoPath('actions/permissions/workflow'), 'PUT', {
    default_workflow_permissions: 'read',
    can_approve_pull_request_reviews: true,
  });
  console.log('Actions PR creation enabled; job-level permissions remain explicit.');
}
if (process.argv.includes('--check-ready')) {
  const currentPermissions = object(api(repoPath('actions/permissions/workflow')));
  const missing = [
    !currentPermissions.can_approve_pull_request_reviews && 'Actions PR creation',
    !secretNames.includes('OPENCODE_API_KEY') && 'OPENCODE_API_KEY',
    !secretNames.includes('SONAR_TOKEN') && 'SONAR_TOKEN',
  ].filter(Boolean);
  if (missing.length) throw new Error(`Not ready for a model run: ${missing.join(', ')}`);
  console.log(
    'Required settings exist. Provider validity and Sonar PR support still require the end-to-end trial.',
  );
}
