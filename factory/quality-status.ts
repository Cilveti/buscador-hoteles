import { api, number, object, repoPath, string } from './github';
import { updateQuality } from './presentation';

const sha = string(process.env.HEAD_SHA);
if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid commit');
const state = process.env.QUALITY_RESULT === 'success' ? 'success' : 'failure';
api(repoPath(`statuses/${sha}`), 'POST', {
  state,
  context: 'Factory / quality',
  description:
    state === 'success' ? 'Calidad de Sonar superada' : 'Sonar no ha pasado; revisa el análisis',
  target_url: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
});

// A model-authored summary cannot change the authoritative gate; update only our managed section.
const prNumber = number(Number(process.env.PR_NUMBER));
const pr = object(api(repoPath(`pulls/${prNumber}`)));
if (object(pr.head).sha !== sha) throw new Error('PR head changed since verification');
api(repoPath(`pulls/${prNumber}`), 'PATCH', {
  body: updateQuality(
    string(pr.body),
    state,
    `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
  ),
});
