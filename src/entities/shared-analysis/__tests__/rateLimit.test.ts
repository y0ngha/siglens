const { mockCheck } = vi.hoisted(() => ({ mockCheck: vi.fn() }));
vi.mock('@/shared/cache/fixedWindowRateLimit', () => ({
    checkFixedWindowRateLimit: mockCheck,
}));

import { checkShareRateLimit } from '@/entities/shared-analysis/server/rateLimit';

describe('checkShareRateLimit', () => {
    beforeEach(() => vi.clearAllMocks());

    it('keeps the share:rl:<ipHash> key with a 30/hour limit', async () => {
        mockCheck.mockResolvedValue(true);
        await checkShareRateLimit('ipHashA');
        expect(mockCheck).toHaveBeenCalledWith({
            key: 'share:rl:ipHashA',
            limit: 30,
            windowSeconds: 3600,
            logTag: 'checkShareRateLimit',
        });
    });

    it('returns the shared limiter verdict as-is', async () => {
        mockCheck.mockResolvedValueOnce(false);
        expect(await checkShareRateLimit('ipHashA')).toBe(false);
        mockCheck.mockResolvedValueOnce(true);
        expect(await checkShareRateLimit('ipHashA')).toBe(true);
    });
});
