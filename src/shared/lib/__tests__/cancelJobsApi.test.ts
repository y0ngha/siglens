import { CANCEL_JOBS_API_PATH } from '@/shared/lib/cancelJobsApi';

describe('CANCEL_JOBS_API_PATH', () => {
    it('is the expected API path', () => {
        expect(CANCEL_JOBS_API_PATH).toBe('/api/jobs/cancel');
    });
});
