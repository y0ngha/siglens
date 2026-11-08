const { mockGetRedis } = vi.hoisted(() => ({ mockGetRedis: vi.fn() }));
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisReaderWriter: mockGetRedis,
}));

import { checkFixedWindowRateLimit } from '../fixedWindowRateLimit';

const OPTIONS = {
    key: 'test:rl:h',
    limit: 3,
    windowSeconds: 60,
    logTag: 'checkTest',
} as const;

function writer(setResult: unknown, count = 0) {
    const set = vi.fn().mockResolvedValue(setResult);
    const incr = vi.fn().mockResolvedValue(count);
    mockGetRedis.mockReturnValue({ writer: { set, incr } });
    return { set, incr };
}

/**
 * 원자적 SET NX EX + INCR 패턴:
 *   - set(key, 1, { nx, ex }) -> "OK": 첫 요청(키와 TTL을 한 번에 만든다)
 *   - set(...) -> null: 키가 이미 있어 incr로 넘어간다
 */
describe('checkFixedWindowRateLimit', () => {
    beforeEach(() => vi.clearAllMocks());

    it('Redis 가 없으면 통과한다', async () => {
        mockGetRedis.mockReturnValue(null);
        expect(await checkFixedWindowRateLimit(OPTIONS)).toBe(true);
    });

    it('첫 요청은 호출자의 키와 창 길이로 SET NX EX 하고 incr 하지 않는다', async () => {
        const { set, incr } = writer('OK');
        expect(await checkFixedWindowRateLimit(OPTIONS)).toBe(true);
        expect(set).toHaveBeenCalledWith('test:rl:h', 1, {
            nx: true,
            ex: 60,
        });
        expect(incr).not.toHaveBeenCalled();
    });

    it('한도까지는 허용하고 넘으면 차단한다', async () => {
        writer(null, 3);
        expect(await checkFixedWindowRateLimit(OPTIONS)).toBe(true);
        writer(null, 4);
        expect(await checkFixedWindowRateLimit(OPTIONS)).toBe(false);
        writer(null, 999);
        expect(await checkFixedWindowRateLimit(OPTIONS)).toBe(false);
    });

    it('set 이 거절되면 통과시키고 호출자 태그로 로그한다(fail-open)', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        mockGetRedis.mockReturnValue({
            writer: { set: vi.fn().mockRejectedValue(new Error('down')) },
        });
        expect(await checkFixedWindowRateLimit(OPTIONS)).toBe(true);
        expect(errorSpy).toHaveBeenCalledWith(
            '[checkTest] redis error, failing open',
            expect.any(Error)
        );
        errorSpy.mockRestore();
    });

    it('incr 이 거절돼도 통과시킨다(fail-open)', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        mockGetRedis.mockReturnValue({
            writer: {
                set: vi.fn().mockResolvedValue(null),
                incr: vi.fn().mockRejectedValue(new Error('down')),
            },
        });
        expect(await checkFixedWindowRateLimit(OPTIONS)).toBe(true);
        errorSpy.mockRestore();
    });
});
