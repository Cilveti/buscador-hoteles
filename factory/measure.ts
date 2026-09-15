import { config } from './config';
import { api, number, object, repoPath, string } from './github';

const run = number(Number(process.argv[2]));
const rate = process.env.FACTORY_USD_PER_LINUX_MINUTE;
const price = rate === undefined ? null : Number(rate);
if (price !== null && (!Number.isFinite(price) || price < 0))
  throw new Error('Invalid minute price');
const execution = object(api(repoPath(`actions/runs/${run}`)));
if (execution.status !== 'completed') throw new Error('Wait until the run completes');
const jobs: { name: string; seconds: number; roundedMinutes: number; conclusion: unknown }[] = [];
for (let page = 1; ; page++) {
  const response = object(api(repoPath(`actions/runs/${run}/jobs?per_page=100&page=${page}`)));
  if (!Array.isArray(response.jobs)) throw new Error('Missing jobs');
  for (const value of response.jobs) {
    const job = object(value);
    if (job.conclusion === 'skipped') continue;
    const start = Date.parse(string(job.started_at));
    const end = Date.parse(string(job.completed_at));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
      throw new Error('Incomplete job timing');
    const seconds = (end - start) / 1000;
    jobs.push({
      name: string(job.name),
      seconds,
      roundedMinutes: Math.ceil(seconds / 60),
      conclusion: job.conclusion,
    });
  }
  if (response.jobs.length < 100) break;
}
const roundedMinutes = jobs.reduce((sum, job) => sum + job.roundedMinutes, 0);
console.log(
  JSON.stringify(
    {
      run,
      url: `https://github.com/${config.repository}/actions/runs/${run}`,
      commit: execution.head_sha,
      conclusion: execution.conclusion,
      jobs,
      runnerSeconds: jobs.reduce((sum, job) => sum + job.seconds, 0),
      roundedMinutes,
      assumedUsdPerLinuxMinute: price,
      estimatedRunnerUsdBeforeQuota:
        price === null ? null : Number((roundedMinutes * price).toFixed(4)),
      modelUsage: null,
      invoice: null,
      limitation:
        'Job timestamps estimate runner time, not the invoice. Price applies only to standard Linux runners. Included quota, retries and model billing require separate evidence. Unknown usage is not zero.',
    },
    null,
    2,
  ),
);
