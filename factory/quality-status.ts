import { api, repoPath, string } from './github';

const sha = string(process.env.HEAD_SHA);
if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid commit');
const state = process.env.QUALITY_RESULT === 'success' ? 'success' : 'failure';
api(repoPath(`statuses/${sha}`), 'POST', {
  state,
  context: 'Factory / quality',
  description:
    state === 'success' ? 'SonarQube quality gate passed' : 'SonarQube did not pass; inspect run',
  target_url: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
});
