const { mockGetRedis } = vi.hoisted(() => ({ mockGetRedis: vi.fn() }));
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisReaderWriter: mockGetRedis,
}));

import { checkShareRateLimit } from '@/entities/shared-analysis/server/rateLimit';

/**
 * The rate-limit implementation uses an atomic SET NX EX + INCR pattern:
 *   - set(key, 1, { nx, ex }) → "OK" on first request (key created atomically with TTL)
 *   - set(key, 1, { nx, ex }) → null when key already exists → fall through to incr
 */
describe('checkShareRateLimit', () => {
    beforeEach(() => vi.clearAllMocks());

    it('allows when redis is unavailable (graceful)', async () => {
        mockGetRedis.mockReturnValue(null);
        expect(await checkShareRateLimit('ipHashA')).toBe(true);
    });

    it('allows on first request (SET NX EX returns OK)', async () => {
        mockGetRedis.mockReturnValue({
            writer: {
                set: vi.fn().mockResolvedValue('OK'),
                incr: vi.fn(),
            },
        });
        expect(await checkShareRateLimit('ipHashA')).toBe(true);
    });

    it('does not call incr on first request', async () => {
        const incr = vi.fn();
        mockGetRedis.mockReturnValue({
            writer: {
                set: vi.fn().mockResolvedValue('OK'),
                incr,
            },
        });
        await checkShareRateLimit('ipHashA');
        expect(incr).not.toHaveBeenCalled();
    });

    it('allows under the limit (subsequent request)', async () => {
        mockGetRedis.mockReturnValue({
            writer: {
                set: vi.fn().mockResolvedValue(null),
                incr: vi.fn().mockResolvedValue(5),
            },
        });
        expect(await checkShareRateLimit('ipHashA')).toBe(true);
    });

    it('allows at exactly the limit (30)', async () => {
        mockGetRedis.mockReturnValue({
            writer: {
                set: vi.fn().mockResolvedValue(null),
                incr: vi.fn().mockResolvedValue(30),
            },
        });
        expect(await checkShareRateLimit('ipHashA')).toBe(true);
    });

    it('blocks over the limit', async () => {
        mockGetRedis.mockReturnValue({
            writer: {
                set: vi.fn().mockResolvedValue(null),
                incr: vi.fn().mockResolvedValue(31),
            },
        });
        expect(await checkShareRateLimit('ipHashA')).toBe(false);
    });

    it('blocks well over the limit', async () => {
        mockGetRedis.mockReturnValue({
            writer: {
                set: vi.fn().mockResolvedValue(null),
                incr: vi.fn().mockResolvedValue(999),
            },
        });
        expect(await checkShareRateLimit('ipHashA')).toBe(false);
    });

    it('calls set with correct key, value, nx and ex options', async () => {
        const set = vi.fn().mockResolvedValue('OK');
        mockGetRedis.mockReturnValue({
            writer: { set, incr: vi.fn() },
        });
        await checkShareRateLimit('ipHashA');
        expect(set).toHaveBeenCalledWith('share:rl:ipHashA', 1, {
            nx: true,
            ex: 3600,
        });
    });

    it('allows (fail-open) when redis set rejects', async () => {
        mockGetRedis.mockReturnValue({
            writer: {
                set: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
                incr: vi.fn(),
            },
        });
        expect(await checkShareRateLimit('ipHashA')).toBe(true);
    });

    it('allows (fail-open) when redis incr rejects on subsequent request', async () => {
        mockGetRedis.mockReturnValue({
            writer: {
                set: vi.fn().mockResolvedValue(null),
                incr: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
            },
        });
        expect(await checkShareRateLimit('ipHashA')).toBe(true);
    });
});
