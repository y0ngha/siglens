export type JobType = 'analysis' | 'fundamental' | 'news' | 'overall';
export type CancelJobEntry = { jobId: string; type: JobType };
export type CancelJobsBody = { jobs: CancelJobEntry[] };
