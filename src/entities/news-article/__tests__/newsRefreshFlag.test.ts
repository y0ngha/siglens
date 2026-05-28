delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
vi.mock('server-only', () => ({}));

const { mockGet, mockSet, mockCtor } = vi.hoisted(() => ({
    mockGet: vi.fn(),
    mockSet: vi.fn(),
    mockCtor: vi.fn(),
}));
vi.mock('@upstash/redis', () => ({
    Redis: vi.fn().mockImplementation(function (o: unknown) {
        mockCtor(o);
        return { get: mockGet, set: mockSet };
    }),
}));

async function loadWithEnv(opts: { url?: string; token?: string }) {
    process.env.UPSTASH_REDIS_REST_URL = opts.url ?? '';
    process.env.UPSTASH_REDIS_REST_TOKEN = opts.token ?? '';
    vi.resetModules();
    return import('../lib/newsRefreshFlag');
}
afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

describe('newsRefreshFlag', () => {
    beforeEach(() => vi.clearAllMocks());

    it('Redis 없으면 isRecentlyFetched=false, markFetched noop', async () => {
        const mod = await loadWithEnv({});
        expect(await mod.isRecentlyFetched('AAPL')).toBe(false);
        await mod.markFetched('AAPL');
        expect(mockCtor).not.toHaveBeenCalled();
    });
    it('플래그 있으면 isRecentlyFetched=true', async () => {
        mockGet.mockResolvedValue('1');
        const mod = await loadWithEnv({
            url: 'https://x.upstash.io',
            token: 't',
        });
        expect(await mod.isRecentlyFetched('AAPL')).toBe(true);
        expect(mockGet).toHaveBeenCalledWith('news:refresh:AAPL');
    });
    it('플래그 없으면(null) isRecentlyFetched=false', async () => {
        mockGet.mockResolvedValue(null);
        const mod = await loadWithEnv({
            url: 'https://x.upstash.io',
            token: 't',
        });
        expect(await mod.isRecentlyFetched('AAPL')).toBe(false);
    });
    it('markFetched는 TTL과 함께 set (대문자 정규화)', async () => {
        mockSet.mockResolvedValue('OK');
        const mod = await loadWithEnv({
            url: 'https://x.upstash.io',
            token: 't',
        });
        await mod.markFetched('aapl');
        expect(mockSet).toHaveBeenCalledWith('news:refresh:AAPL', '1', {
            ex: mod.NEWS_REFRESH_FLAG_TTL_SECONDS,
        });
    });
    it('Redis get 예외는 흡수하고 false', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockGet.mockRejectedValue(new Error('down'));
        const mod = await loadWithEnv({
            url: 'https://x.upstash.io',
            token: 't',
        });
        expect(await mod.isRecentlyFetched('AAPL')).toBe(false);
        expect(errSpy).toHaveBeenCalled();
        errSpy.mockRestore();
    });
    it('Redis set 예외는 흡수(throw 안 함)', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockSet.mockRejectedValue(new Error('down'));
        const mod = await loadWithEnv({
            url: 'https://x.upstash.io',
            token: 't',
        });
        await expect(mod.markFetched('AAPL')).resolves.toBeUndefined();
        expect(errSpy).toHaveBeenCalled();
        errSpy.mockRestore();
    });
});
