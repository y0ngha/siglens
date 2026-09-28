import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAuthorizedCronRequest } from '@/shared/lib/auth/isAuthorizedCronRequest';

function requestWith(authorization?: string): Request {
    return new Request('https://siglens.test/api/cron/x', {
        method: 'PATCH',
        headers: authorization ? { authorization } : {},
    });
}

describe('isAuthorizedCronRequest', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('CRON_SECRET이 비어 있으면 어떤 헤더든 거부한다 (fail-closed)', () => {
        vi.stubEnv('CRON_SECRET', '');
        expect(isAuthorizedCronRequest(requestWith('Bearer '))).toBe(false);
        expect(isAuthorizedCronRequest(requestWith())).toBe(false);
    });

    it('일치하는 Bearer 토큰만 통과시킨다', () => {
        vi.stubEnv('CRON_SECRET', 's3cret');
        expect(isAuthorizedCronRequest(requestWith('Bearer s3cret'))).toBe(
            true
        );
        expect(isAuthorizedCronRequest(requestWith('Bearer wrong'))).toBe(
            false
        );
        expect(isAuthorizedCronRequest(requestWith())).toBe(false);
    });
});
