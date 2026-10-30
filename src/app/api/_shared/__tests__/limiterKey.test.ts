const { mockGetClientIp } = vi.hoisted(() => ({ mockGetClientIp: vi.fn() }));
vi.mock('@/shared/api/getClientIp', () => ({ getClientIp: mockGetClientIp }));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveLimiterKey } from '@/app/api/_shared/limiterKey';
import { UNKNOWN_CLIENT_IP } from '@/shared/api/unknownClientIp';

describe('resolveLimiterKey', () => {
    beforeEach(() => {
        mockGetClientIp.mockReset();
    });

    it('해석된 클라이언트 IP를 그대로 돌려준다', async () => {
        mockGetClientIp.mockResolvedValue('203.0.113.9');
        expect(await resolveLimiterKey()).toBe('203.0.113.9');
    });

    it('IP 해석이 던져도 던지지 않고 공용 버킷 키를 돌려준다', async () => {
        mockGetClientIp.mockRejectedValue(new Error('headers() unavailable'));
        expect(await resolveLimiterKey()).toBe(UNKNOWN_CLIENT_IP);
    });
});
