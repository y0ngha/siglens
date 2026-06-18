import { constants } from 'node:http2';
import {
    cancelAnalysisJob,
    cancelCongressTrendJob,
    cancelFinancialsAnalysisJob,
    cancelFundamentalAnalysisJob,
    cancelJob,
    cancelNewsAnalysisJob,
    cancelOverallAnalysisJob,
} from '@y0ngha/siglens-core';
import type {
    CancelJobEntry,
    CancelJobsBody,
    JobType,
} from '@/shared/lib/types';

const { HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_NO_CONTENT } = constants;

const VALID_JOB_TYPES = new Set<JobType>([
    'analysis',
    'financials',
    'fundamental',
    'news',
    'options',
    'overall',
    'congress',
]);

/** Cancel one or more analysis jobs. Called via sendBeacon on pagehide. */
export async function POST(request: Request): Promise<Response> {
    let jobs: CancelJobsBody['jobs'];
    try {
        const body: CancelJobsBody = await request.json();
        if (
            !Array.isArray(body.jobs) ||
            body.jobs.some(
                j =>
                    !j.jobId ||
                    !j.type ||
                    !VALID_JOB_TYPES.has(j.type as JobType)
            )
        ) {
            return new Response(null, { status: HTTP_STATUS_BAD_REQUEST });
        }
        jobs = body.jobs;
    } catch (error) {
        console.error('[cancel route] failed to parse request body:', error);
        return new Response(null, { status: HTTP_STATUS_BAD_REQUEST });
    }

    await Promise.allSettled(
        jobs.map(({ jobId, type }: CancelJobEntry) => {
            switch (type) {
                case 'analysis':
                    return cancelAnalysisJob(jobId);
                case 'financials':
                    return cancelFinancialsAnalysisJob(jobId);
                case 'fundamental':
                    return cancelFundamentalAnalysisJob(jobId);
                case 'news':
                    return cancelNewsAnalysisJob(jobId);
                case 'options':
                    return cancelJob(jobId);
                case 'overall':
                    return cancelOverallAnalysisJob(jobId);
                case 'congress':
                    return cancelCongressTrendJob(jobId);
                default:
                    console.warn('[cancel route] unknown job type:', type);
            }
        })
    );

    return new Response(null, { status: HTTP_STATUS_NO_CONTENT });
}
