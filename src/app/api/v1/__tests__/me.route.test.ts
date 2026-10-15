const { mockAuth, mockPeek, mockConsume, mockFindProviders, mockFindModel } =
    vi.hoisted(() => ({
        mockAuth: vi.fn(),
        mockConsume: vi.fn(),
        mockPeek: vi.fn(),
        mockFindProviders: vi.fn(),
        mockFindModel: vi.fn(),
    }));
vi.mock('@/entities/siglens-api-key/server/apiKeyAuth', () => ({
    authenticateApiKey: mockAuth,
}));
vi.mock('@/entities/siglens-api-key/server/rateLimit', async () => {
    const actual = await vi.importActual<
        typeof import('@/entities/siglens-api-key/server/rateLimit')
    >('@/entities/siglens-api-key/server/rateLimit');
    return {
        ...actual,
        peekRateLimits: mockPeek,
        consumeRateLimit: mockConsume,
    };
});
vi.mock('@/entities/api-key/api', () => ({
    DrizzleUserApiKeyRepository: vi.fn().mockImplementation(function () {
        return { findByUser: mockFindProviders };
    }),
}));
vi.mock('@/entities/siglens-api-key/api', () => ({
    DrizzleSiglensApiKeyRepository: vi.fn().mockImplementation(function () {
        return { findApiDefaultModel: mockFindModel };
    }),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {} })),
}));

import { GET } from '@/app/api/v1/me/route';

const principal = {
    keyId: '33333333-3333-4333-8333-333333333333',
    keyName: '내 에이전트',
    keyPrefix: 'slk_ab12cd',
    userId: '11111111-1111-4111-8111-111111111111',
    tier: 'pro' as const,
};
const allowed = {
    allowed: true,
    window: 'minute' as const,
    limit: 60,
    remaining: 59,
    resetAtEpochSeconds: 1_792_000_020,
    retryAfterSeconds: 20,
};
const request = (): Request =>
    new Request('https://siglens.io/api/v1/me', {
        headers: { authorization: 'Bearer slk_x' },
    });

describe('GET /api/v1/me', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        mockAuth.mockResolvedValue({ status: 'ok', principal });
        mockConsume.mockResolvedValue(allowed);
        mockPeek.mockResolvedValue({ data: { minute: { limit: 60 } } });
        mockFindProviders.mockResolvedValue([
            { provider: 'openai' },
            { provider: 'anthropic' },
        ]);
        mockFindModel.mockResolvedValue(null);
    });

    it('키·tier·BYOK provider·남은 한도를 돌려준다', async () => {
        const response = await GET(request());
        expect(response.status).toBe(200);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        await expect(response.json()).resolves.toEqual({
            data: {
                key: {
                    id: principal.keyId,
                    name: '내 에이전트',
                    prefix: 'slk_ab12cd',
                },
                tier: 'pro',
                defaultModel: null,
                byokProviders: ['anthropic', 'openai'],
                rateLimits: { data: { minute: { limit: 60 } } },
            },
            meta: {},
        });
    });

    it('계정 화면에서 고른 API 기본 모델을 defaultModel로 돌려준다', async () => {
        mockFindModel.mockResolvedValue('claude-opus-5');
        const body = (await (await GET(request())).json()) as {
            data: { defaultModel: string | null };
        };
        expect(body.data.defaultModel).toBe('claude-opus-5');
    });

    it('기본 모델 조회가 실패하면 503', async () => {
        mockFindModel.mockRejectedValue(new Error('db down'));
        const response = await GET(request());
        expect(response.status).toBe(503);
    });

    it('BYOK provider와 기본 모델은 키 소유자 id로만 조회한다', async () => {
        await GET(request());
        expect(mockFindModel).toHaveBeenCalledWith(principal.userId);
        expect(mockFindProviders).toHaveBeenCalledWith(principal.userId);
        expect(mockPeek).toHaveBeenCalledWith(principal.userId);
    });

    it('한도 저장소를 못 읽어도 나머지는 돌려준다(rateLimits: null)', async () => {
        mockPeek.mockResolvedValue(null);
        const response = await GET(request());
        expect(response.status).toBe(200);
        const body = (await response.json()) as {
            data: { rateLimits: unknown; tier: string };
        };
        expect(body.data.rateLimits).toBeNull();
        expect(body.data.tier).toBe('pro');
    });

    it('provider 조회가 실패하면 503', async () => {
        mockFindProviders.mockRejectedValue(new Error('db down'));
        const response = await GET(request());
        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toMatchObject({
            error: { code: 'service_unavailable' },
        });
    });

    it('키가 없으면 401이고 아무것도 조회하지 않는다', async () => {
        mockAuth.mockResolvedValue({ status: 'invalid' });
        const response = await GET(request());
        expect(response.status).toBe(401);
        expect(mockFindProviders).not.toHaveBeenCalled();
    });

    it('응답에 키 원문·해시를 담지 않는다', async () => {
        const text = await (await GET(request())).text();
        expect(text).not.toMatch(/key_?hash/i);
        expect(text).not.toMatch(/slk_[0-9A-Za-z]{40}/);
    });

    it('data 버킷을 회원 단위로 소비하고 한도 헤더를 싣는다', async () => {
        const response = await GET(request());
        expect(mockConsume).toHaveBeenCalledWith(principal.userId, 'data');
        expect(response.headers.get('X-RateLimit-Limit')).toBe('60');
        expect(response.headers.get('X-RateLimit-Remaining')).toBe('59');
        expect(response.headers.get('X-RateLimit-Reset')).toBe('1792000020');
    });

    it('한도를 넘으면 429이고 계정 데이터를 조회하지 않는다', async () => {
        mockConsume.mockResolvedValue({
            ...allowed,
            allowed: false,
            remaining: 0,
        });
        const response = await GET(request());
        expect(response.status).toBe(429);
        expect(response.headers.get('Retry-After')).toBe('20');
        expect(mockFindProviders).not.toHaveBeenCalled();
    });
});
