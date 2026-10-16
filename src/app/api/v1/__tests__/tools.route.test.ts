const { mockAuth, mockConsume } = vi.hoisted(() => ({
    mockAuth: vi.fn(),
    mockConsume: vi.fn(),
}));
vi.mock('@/entities/siglens-api-key/server/apiKeyAuth', () => ({
    authenticateApiKey: mockAuth,
}));
vi.mock('@/entities/siglens-api-key/server/rateLimit', async () => {
    const actual = await vi.importActual<
        typeof import('@/entities/siglens-api-key/server/rateLimit')
    >('@/entities/siglens-api-key/server/rateLimit');
    return { ...actual, consumeRateLimit: mockConsume };
});
vi.mock('@/app/api/ai/chat/tools/chatTools', () => ({
    availableToolNames: () =>
        new Set([
            'search_ticker',
            'get_quote',
            'get_my_portfolio',
            'run_fresh_analysis',
            'web_search',
        ]),
    createToolExecutor: vi.fn(),
}));

import { GET } from '@/app/api/v1/tools/route';

const principal = {
    keyId: 'k1',
    keyName: 'n',
    keyPrefix: 'slk_abcdef',
    userId: 'u1',
    tier: 'member' as const,
};
const request = (headers: Record<string, string> = {}): Request =>
    new Request('https://siglens.io/api/v1/tools', { headers });

describe('GET /api/v1/tools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockConsume.mockResolvedValue({
            allowed: true,
            window: 'minute',
            limit: 60,
            remaining: 59,
            resetAtEpochSeconds: 1_792_000_020,
            retryAfterSeconds: 20,
        });
    });

    it('키 없이는 401', async () => {
        mockAuth.mockResolvedValue({ status: 'invalid' });
        const response = await GET(request());
        expect(response.status).toBe(401);
    });

    it('노출 도구의 name·description·inputSchema만 돌려준다', async () => {
        mockAuth.mockResolvedValue({ status: 'ok', principal });
        const response = await GET(request({ authorization: 'Bearer slk_x' }));
        expect(response.status).toBe(200);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        const body = (await response.json()) as {
            data: { tools: Array<Record<string, unknown>> };
        };
        expect(body.data.tools.map(t => t.name)).toEqual([
            'search_ticker',
            'get_quote',
            'run_fresh_analysis',
            'get_my_portfolio',
            'get_chart_data',
        ]);
        for (const tool of body.data.tools) {
            expect(Object.keys(tool).toSorted()).toEqual([
                'description',
                'inputSchema',
                'name',
            ]);
        }
    });

    it('run_fresh_analysis는 model 인자를 더한 API 전용 스키마로 나간다', async () => {
        mockAuth.mockResolvedValue({ status: 'ok', principal });
        const body = (await (
            await GET(request({ authorization: 'Bearer slk_x' }))
        ).json()) as {
            data: {
                tools: Array<{
                    name: string;
                    inputSchema: {
                        properties: Record<string, unknown>;
                        required: string[];
                    };
                }>;
            };
        };
        const fresh = body.data.tools.find(
            t => t.name === 'run_fresh_analysis'
        );
        expect(
            Object.keys(fresh?.inputSchema.properties ?? {}).toSorted()
        ).toEqual(['kind', 'model', 'symbol', 'timeframe']);
        // model은 선택이다 — 기본 모델이 있으면 생략할 수 있다.
        expect(fresh?.inputSchema.required).toEqual(['symbol', 'kind']);
    });

    it('스키마는 core 스펙 그대로다', async () => {
        mockAuth.mockResolvedValue({ status: 'ok', principal });
        const body = (await (
            await GET(request({ authorization: 'Bearer slk_x' }))
        ).json()) as {
            data: { tools: Array<{ name: string; inputSchema: unknown }> };
        };
        const quote = body.data.tools.find(t => t.name === 'get_quote');
        expect(quote?.inputSchema).toMatchObject({
            type: 'object',
            required: ['symbols'],
            additionalProperties: false,
        });
    });

    it('data 버킷을 회원 단위로 소비하고 한도 헤더를 싣는다', async () => {
        mockAuth.mockResolvedValue({ status: 'ok', principal });
        const response = await GET(request({ authorization: 'Bearer slk_x' }));
        expect(mockConsume).toHaveBeenCalledWith('u1', 'data');
        expect(response.headers.get('X-RateLimit-Limit')).toBe('60');
        expect(response.headers.get('X-RateLimit-Remaining')).toBe('59');
    });

    it('한도를 넘으면 429', async () => {
        mockAuth.mockResolvedValue({ status: 'ok', principal });
        mockConsume.mockResolvedValue({
            allowed: false,
            window: 'minute',
            limit: 60,
            remaining: 0,
            resetAtEpochSeconds: 1_792_000_020,
            retryAfterSeconds: 20,
        });
        const response = await GET(request({ authorization: 'Bearer slk_x' }));
        expect(response.status).toBe(429);
    });

    it('인증 실패는 한도를 소비하지 않는다', async () => {
        mockAuth.mockResolvedValue({ status: 'invalid' });
        await GET(request());
        expect(mockConsume).not.toHaveBeenCalled();
    });
});
