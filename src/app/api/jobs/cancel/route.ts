import { constants } from 'node:http2';
import {
    cancelAnalysisJob,
    cancelFundamentalAnalysisJob,
    cancelNewsAnalysisJob,
    cancelOverallAnalysisJob,
} from '@y0ngha/siglens-core';
import type { CancelJobsBody, JobType } from '@/lib/cancelJobsApi';

const { HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_NO_CONTENT } = constants;

/** Cancel one or more analysis jobs. Called via sendBeacon on pagehide. */
export async function POST(request: Request): Promise<Response> {
    let jobs: CancelJobsBody['jobs'];
    try {
        const body: CancelJobsBody = await request.json();
        if (!Array.isArray(body.jobs)) {
            return new Response(null, { status: HTTP_STATUS_BAD_REQUEST });
        }
        jobs = body.jobs;
    } catch {
        return new Response(null, { status: HTTP_STATUS_BAD_REQUEST });
    }

    await Promise.allSettled(
        jobs.map(({ jobId, type }: { jobId: string; type: JobType }) => {
            switch (type) {
                case 'analysis':
                    return cancelAnalysisJob(jobId);
                case 'fundamental':
                    return cancelFundamentalAnalysisJob(jobId);
                case 'news':
                    return cancelNewsAnalysisJob(jobId);
                case 'overall':
                    return cancelOverallAnalysisJob(jobId);
            }
        })
    );

    return new Response(null, { status: HTTP_STATUS_NO_CONTENT });
}
