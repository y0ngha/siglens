const { mockCheck } = vi.hoisted(() => ({ mockCheck: vi.fn() }));

vi.mock('@/shared/cache/fixedWindowRateLimit', () => ({
    checkFixedWindowRateLimit: mockCheck,
}));
vi.mock('@/shared/api/getClientIp', () => ({
    getClientIp: vi.fn().mockResolvedValue('1.2.3.4'),
}));
vi.mock('@y0ngha/siglens-core', async orig => ({
    ...(await orig<typeof import('@y0ngha/siglens-core')>()),
    hashUsageIp: vi.fn(() => 'ipHashX'),
}));

import {
    isHoneypotFilled,
    isInquiryRateLimited,
} from '../server/inquirySpamGuard';
import { makeFormData } from '@/shared/test-utils/makeFormData';

describe('isHoneypotFilled', () => {
    it('봇 함정 입력에 값이 있으면 true', () => {
        expect(isHoneypotFilled(makeFormData({ siglens_hp_ignore: 'x' }))).toBe(
            true
        );
    });

    it('비었거나 없으면 false', () => {
        expect(isHoneypotFilled(makeFormData({ siglens_hp_ignore: '' }))).toBe(
            false
        );
        expect(isHoneypotFilled(makeFormData({}))).toBe(false);
    });
});

describe('isInquiryRateLimited', () => {
    beforeEach(() => mockCheck.mockReset());

    it('inquiry 키를 IP 해시로 조회하고 거절이면 true', async () => {
        mockCheck.mockResolvedValue(false);
        await expect(isInquiryRateLimited()).resolves.toBe(true);
        expect(mockCheck).toHaveBeenCalledWith({
            key: 'inquiry:rl:ipHashX',
            limit: 5,
            windowSeconds: 3600,
            logTag: 'isInquiryRateLimited',
        });
    });

    it('허용이면 false', async () => {
        mockCheck.mockResolvedValue(true);
        await expect(isInquiryRateLimited()).resolves.toBe(false);
    });
});
