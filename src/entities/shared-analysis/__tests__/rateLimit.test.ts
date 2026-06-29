const { mockGetRedis } = vi.hoisted(() => ({ mockGetRedis: vi.fn() }));
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisReaderWriter: mockGetRedis,
}));

import { checkShareRateLimit } from '@/entities/shared-analysis/server/rateLimit';

describe('checkShareRateLimit', () => {
    beforeEach(() => vi.clearAllMocks());

    it('allows when redis is unavailable (graceful)', async () => {
        mockGetRedis.mockReturnValue(null);
        expect(await checkShareRateLimit('ipHashA')).toBe(true);
    });

    it('allows under the limit', async () => {
        mockGetRedis.mockReturnValue({
            writer: {
                incr: vi.fn().mockResolvedValue(1),
                expire: vi.fn().mockResolvedValue(1),
            },
        });
        expect(await checkShareRateLimit('ipHashA')).toBe(true);
    });

    it('blocks over the limit', async () => {
        mockGetRedis.mockReturnValue({
            writer: {
                incr: vi.fn().mockResolvedValue(999),
                expire: vi.fn().mockResolvedValue(1),
            },
        });
        expect(await checkShareRateLimit('ipHashA')).toBe(false);
    });

    it('allows at exactly the limit (30)', async () => {
        mockGetRedis.mockReturnValue({
            writer: {
                incr: vi.fn().mockResolvedValue(30),
                expire: vi.fn().mockResolvedValue(1),
            },
        });
        expect(await checkShareRateLimit('ipHashA')).toBe(true);
    });

    it('sets expiry only on first request (count === 1)', async () => {
        const expire = vi.fn().mockResolvedValue(1);
        mockGetRedis.mockReturnValue({
            writer: { incr: vi.fn().mockResolvedValue(5), expire },
        });
        await checkShareRateLimit('ipHashA');
        expect(expire).not.toHaveBeenCalled();
    });

    it('sets expiry on first request (count === 1)', async () => {
        const expire = vi.fn().mockResolvedValue(1);
        mockGetRedis.mockReturnValue({
            writer: { incr: vi.fn().mockResolvedValue(1), expire },
        });
        await checkShareRateLimit('ipHashA');
        expect(expire).toHaveBeenCalledWith('share:rl:ipHashA', 3600);
    });
});
