const { mockAuth, mockConsume, mockExecute } = vi.hoisted(() => ({
    mockAuth: vi.fn(),
    mockConsume: vi.fn(),
    mockExecute: vi.fn(),
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
vi.mock('@/app/api/v1/executePublicTool', () => ({
    executePublicTool: mockExecute,
    resolveApiLocale: () => 'en',
}));

import { POST } from '@/app/api/v1/tools/[name]/route';
import { RateLimiterUnavailableError } from '@/entities/siglens-api-key/server/rateLimit';

const principal = {
    keyId: 'key-1',
    keyName: 'n',
    keyPrefix: 'slk_abcdef',
    userId: 'user-1',
    tier: 'member' as const,
};
const allowedVerdict = {
    allowed: true,
    window: 'minute' as const,
    limit: 60,
    remaining: 59,
    resetAtEpochSeconds: 1_792_000_020,
    retryAfterSeconds: 20,
};

function call(
    name: string,
    body: unknown = { symbols: ['AAPL'] },
    headers: Record<string, string> = { authorization: 'Bearer slk_x' }
): Promise<Response> {
    return POST(
        new Request(`https://siglens.io/api/v1/tools/${name}`, {
            method: 'POST',
            headers,
            body: typeof body === 'string' ? body : JSON.stringify(body),
        }),
        { params: Promise.resolve({ name }) }
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockAuth.mockResolvedValue({ status: 'ok', principal });
    mockConsume.mockResolvedValue(allowedVerdict);
    mockExecute.mockResolvedValue({
        ok: true,
        data: { quotes: [] },
        truncated: false,
    });
});

describe('POST /api/v1/tools/{name} — 인증', () => {
    it('키가 없으면 401이고 한도·실행에 닿지 않는다', async () => {
        mockAuth.mockResolvedValue({ status: 'invalid' });
        const response = await call('get_quote', {}, {});
        expect(response.status).toBe(401);
        expect(mockConsume).not.toHaveBeenCalled();
        expect(mockExecute).not.toHaveBeenCalled();
    });

    it('폐기된 키도 같은 401이다', async () => {
        // 인증기는 폐기·미인증·없는 키를 모두 invalid로 접는다(apiKeyAuth.test).
        mockAuth.mockResolvedValue({ status: 'invalid' });
        const response = await call('search_ticker', { query: 'apple' });
        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toMatchObject({
            error: { code: 'invalid_api_key' },
        });
    });
});

describe('POST /api/v1/tools/{name} — 도구 선택', () => {
    it.each(['web_search', 'no_such_tool'])(
        '%s는 404 unknown_tool이고 한도도 소비하지 않는다',
        async name => {
            const response = await call(name, {});
            expect(response.status).toBe(404);
            await expect(response.json()).resolves.toMatchObject({
                error: { code: 'unknown_tool' },
            });
            expect(mockConsume).not.toHaveBeenCalled();
            expect(mockExecute).not.toHaveBeenCalled();
        }
    );
});

describe('POST /api/v1/tools/{name} — run_fresh_analysis', () => {
    it('model은 스키마가 받아들이고 실행에 그대로 전달된다', async () => {
        const response = await call('run_fresh_analysis', {
            symbol: 'AAPL',
            kind: 'technical',
            model: 'claude-opus-5',
        });
        expect(response.status).toBe(200);
        expect(mockExecute.mock.calls[0][0].name).toBe('run_fresh_analysis');
        expect(mockExecute.mock.calls[0][1]).toEqual({
            symbol: 'AAPL',
            kind: 'technical',
            model: 'claude-opus-5',
        });
    });

    it('로스터에 없는 model은 400 invalid_args이고 한도를 소비하지 않는다', async () => {
        const response = await call('run_fresh_analysis', {
            symbol: 'AAPL',
            kind: 'technical',
            model: 'no-such-model',
        });
        expect(response.status).toBe(400);
        expect(mockConsume).not.toHaveBeenCalled();
        expect(mockExecute).not.toHaveBeenCalled();
    });

    it('userId 같은 필드는 여전히 거절한다', async () => {
        const response = await call('run_fresh_analysis', {
            symbol: 'AAPL',
            kind: 'technical',
            userId: 'someone-else',
        });
        expect(response.status).toBe(400);
        expect(mockExecute).not.toHaveBeenCalled();
    });

    it('캐시 적중 결과의 meta.source·model을 응답 meta에 싣는다', async () => {
        mockExecute.mockResolvedValue({
            ok: true,
            data: { found: true },
            truncated: false,
            meta: { source: 'cache', model: 'claude-opus-5' },
        });
        const response = await call('run_fresh_analysis', {
            symbol: 'AAPL',
            kind: 'technical',
            model: 'claude-opus-5',
        });
        await expect(response.json()).resolves.toEqual({
            data: { found: true },
            meta: {
                tool: 'run_fresh_analysis',
                source: 'cache',
                model: 'claude-opus-5',
            },
        });
        expect(mockConsume).toHaveBeenCalledTimes(1);
        expect(mockConsume).toHaveBeenCalledWith('user-1', 'data');
    });

    it('ai 버킷 429는 X-RateLimit-AI-*와 Retry-After를 싣고 data 버킷 X-RateLimit-*를 덮지 않는다', async () => {
        mockExecute.mockResolvedValue({
            ok: false,
            status: 429,
            code: 'rate_limited',
            message: 'Rate limit exceeded (ai bucket, minute window).',
            headers: {
                'X-RateLimit-AI-Limit': '10',
                'X-RateLimit-AI-Remaining': '0',
                'X-RateLimit-AI-Reset': '1792000040',
                'Retry-After': '17',
            },
        });
        const response = await call('run_fresh_analysis', {
            symbol: 'AAPL',
            kind: 'technical',
            model: 'claude-opus-5',
        });
        expect(response.status).toBe(429);
        // ai 버킷 상태
        expect(response.headers.get('X-RateLimit-AI-Limit')).toBe('10');
        expect(response.headers.get('X-RateLimit-AI-Remaining')).toBe('0');
        expect(response.headers.get('X-RateLimit-AI-Reset')).toBe('1792000040');
        expect(response.headers.get('Retry-After')).toBe('17');
        // data 버킷 상태는 그대로(이 요청이 소비한 data 한도)
        expect(response.headers.get('X-RateLimit-Limit')).toBe('60');
        expect(response.headers.get('X-RateLimit-Remaining')).toBe('59');
        expect(response.headers.get('X-RateLimit-Reset')).toBe('1792000020');
    });

    it('오류 details(provider_error의 provider·status)를 본문에 싣는다', async () => {
        mockExecute.mockResolvedValue({
            ok: false,
            status: 502,
            code: 'provider_error',
            message: 'The anthropic API rejected the request with HTTP 401.',
            details: { provider: 'anthropic', status: 401 },
        });
        const response = await call('run_fresh_analysis', {
            symbol: 'AAPL',
            kind: 'technical',
            model: 'claude-opus-5',
        });
        expect(response.status).toBe(502);
        await expect(response.json()).resolves.toMatchObject({
            error: {
                code: 'provider_error',
                details: { provider: 'anthropic', status: 401 },
            },
        });
    });
});

describe('POST /api/v1/tools/{name} — 스트리밍 응답(생성 시작 뒤)', () => {
    const body = { symbol: 'AAPL', kind: 'technical', model: 'claude-opus-5' };

    it('200 + json + no-transform으로 시작하고 최종 본문이 일반 봉투와 같은 모양이다', async () => {
        mockExecute.mockResolvedValue({
            streaming: true,
            completion: Promise.resolve({
                ok: true,
                data: { found: true },
                truncated: false,
                meta: { source: 'fresh', model: 'claude-opus-5' },
            }),
        });
        const response = await call('run_fresh_analysis', body);

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toContain(
            'application/json'
        );
        expect(response.headers.get('Cache-Control')).toBe(
            'no-store, no-transform'
        );
        expect(response.headers.get('X-Accel-Buffering')).toBe('no');
        // data 버킷 한도 헤더는 스트림 응답에도 실린다.
        expect(response.headers.get('X-RateLimit-Limit')).toBe('60');
        const text = await response.text();
        expect(text.startsWith('\n')).toBe(true);
        expect(JSON.parse(text)).toEqual({
            data: { found: true },
            meta: {
                tool: 'run_fresh_analysis',
                source: 'fresh',
                model: 'claude-opus-5',
            },
        });
    });

    it('스트림 응답에는 소비한 ai 버킷 상태(X-RateLimit-AI-*)가 data 버킷 헤더와 함께 실린다', async () => {
        mockExecute.mockResolvedValue({
            streaming: true,
            headers: {
                'X-RateLimit-AI-Limit': '10',
                'X-RateLimit-AI-Remaining': '7',
                'X-RateLimit-AI-Reset': '1792000020',
            },
            completion: Promise.resolve({
                ok: true,
                data: {},
                truncated: false,
            }),
        });
        const response = await call('run_fresh_analysis', body);
        expect(response.headers.get('X-RateLimit-AI-Limit')).toBe('10');
        expect(response.headers.get('X-RateLimit-AI-Remaining')).toBe('7');
        expect(response.headers.get('X-RateLimit-AI-Reset')).toBe('1792000020');
        // data 버킷 헤더는 이름이 겹치지 않고 그대로 있다.
        expect(response.headers.get('X-RateLimit-Limit')).toBe('60');
        await response.text();
    });

    it('시작 뒤의 실패는 상태 200 그대로 본문에 { error }로 온다', async () => {
        mockExecute.mockResolvedValue({
            streaming: true,
            completion: Promise.resolve({
                ok: false,
                status: 502,
                code: 'provider_error',
                message:
                    'The anthropic API rejected the request with HTTP 401.',
                details: { provider: 'anthropic', status: 401 },
            }),
        });
        const response = await call('run_fresh_analysis', body);

        expect(response.status).toBe(200);
        expect(JSON.parse(await response.text())).toEqual({
            error: {
                code: 'provider_error',
                message:
                    'The anthropic API rejected the request with HTTP 401.',
                details: { provider: 'anthropic', status: 401 },
            },
        });
    });

    it('completion이 예기치 않게 reject되면 내부 상세 없는 internal_error 봉투', async () => {
        mockExecute.mockResolvedValue({
            streaming: true,
            completion: Promise.reject(new Error('secret connection string')),
        });
        const response = await call('run_fresh_analysis', body);
        const text = await response.text();
        expect(JSON.parse(text)).toMatchObject({
            error: { code: 'internal_error' },
        });
        expect(text).not.toContain('secret');
    });

    it('스트림이 아닌 결과(사전 거절)는 일반 상태 코드와 본문이다', async () => {
        mockExecute.mockResolvedValue({
            ok: false,
            status: 400,
            code: 'byok_key_required',
            message: 'No key.',
            details: { provider: 'anthropic' },
        });
        const response = await call('run_fresh_analysis', body);
        expect(response.status).toBe(400);
        expect(response.headers.get('Content-Type')).toContain(
            'application/json'
        );
        await expect(response.json()).resolves.toMatchObject({
            error: { code: 'byok_key_required' },
        });
    });
});

describe('POST /api/v1/tools/{name} — 요청 검증', () => {
    it('깨진 JSON은 400 invalid_body이고 한도를 소비하지 않는다', async () => {
        const response = await call('get_quote', '{"symbols":');
        expect(response.status).toBe(400);
        expect(mockConsume).not.toHaveBeenCalled();
    });

    it('스키마 위반은 400 invalid_args + issues, 한도 미소비', async () => {
        const response = await call('get_quote', {});
        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
            error: {
                code: 'invalid_args',
                details: { issues: [{ path: 'symbols', message: 'required' }] },
            },
        });
        expect(mockConsume).not.toHaveBeenCalled();
        expect(mockExecute).not.toHaveBeenCalled();
    });

    it('스키마에 없는 필드(userId 등)는 거절한다', async () => {
        const response = await call('get_my_portfolio', {
            userId: 'someone-else',
        });
        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
            error: {
                code: 'invalid_args',
                details: {
                    issues: [{ path: 'userId', message: 'unknown field' }],
                },
            },
        });
        expect(mockExecute).not.toHaveBeenCalled();
    });

    it('본문이 너무 크면 413', async () => {
        const response = await call('search_ticker', {
            query: 'x'.repeat(10_000),
        });
        expect(response.status).toBe(413);
    });
});

describe('POST /api/v1/tools/{name} — 한도', () => {
    it('data 버킷을 키 id로 소비한다', async () => {
        await call('get_quote');
        // 회원(userId) 단위로 센다 — 키 id가 아니다.
        expect(mockConsume).toHaveBeenCalledWith('user-1', 'data');
    });

    it('한도 초과는 429이고 도구를 실행하지 않는다', async () => {
        mockConsume.mockResolvedValue({
            ...allowedVerdict,
            allowed: false,
            remaining: 0,
        });
        const response = await call('get_quote');
        expect(response.status).toBe(429);
        expect(response.headers.get('Retry-After')).toBe('20');
        expect(mockExecute).not.toHaveBeenCalled();
    });

    it('한도 저장소 장애는 503 rate_limiter_unavailable이고 실행하지 않는다', async () => {
        mockConsume.mockRejectedValue(new RateLimiterUnavailableError());
        const response = await call('get_quote');
        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toMatchObject({
            error: { code: 'rate_limiter_unavailable' },
        });
        expect(mockExecute).not.toHaveBeenCalled();
    });
});

describe('POST /api/v1/tools/{name} — 실행과 응답', () => {
    it('검증된 인자와 principal로 실행하고 { data, meta } + 한도 헤더로 답한다', async () => {
        mockExecute.mockResolvedValue({
            ok: true,
            data: { quotes: [{ symbol: 'AAPL' }] },
        });
        const response = await call('get_quote', { symbols: ['AAPL'] });
        expect(response.status).toBe(200);
        expect(response.headers.get('X-RateLimit-Limit')).toBe('60');
        expect(response.headers.get('X-RateLimit-Remaining')).toBe('59');
        expect(response.headers.get('X-RateLimit-Reset')).toBe('1792000020');
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        await expect(response.json()).resolves.toEqual({
            data: { quotes: [{ symbol: 'AAPL' }] },
            meta: { tool: 'get_quote' },
        });
        const [spec, args, who, locale] = mockExecute.mock.calls[0];
        expect(spec.name).toBe('get_quote');
        expect(args).toEqual({ symbols: ['AAPL'] });
        expect(who).toBe(principal);
        expect(locale).toBe('en');
    });

    it('결과가 잘렸으면 meta.truncated: true를 싣는다', async () => {
        mockExecute.mockResolvedValue({
            ok: true,
            data: { truncated: true, preview: '{"items":[' },
            truncated: true,
        });
        const response = await call('get_quote');
        await expect(response.json()).resolves.toEqual({
            data: { truncated: true, preview: '{"items":[' },
            meta: { tool: 'get_quote', truncated: true },
        });
    });

    it('잘리지 않았으면 meta에 truncated 키가 없다', async () => {
        mockExecute.mockResolvedValue({
            ok: true,
            data: { quotes: [] },
            truncated: false,
        });
        const body = (await (await call('get_quote')).json()) as {
            meta: Record<string, unknown>;
        };
        expect(body.meta).toEqual({ tool: 'get_quote' });
    });

    it('실행기 오류는 매핑된 상태와 한도 헤더로 답한다', async () => {
        mockExecute.mockResolvedValue({
            ok: false,
            status: 400,
            code: 'invalid_symbol',
            message: 'A symbol argument is not a valid ticker shape.',
        });
        const response = await call('get_quote', { symbols: ['??'] });
        expect(response.status).toBe(400);
        expect(response.headers.get('X-RateLimit-Remaining')).toBe('59');
        await expect(response.json()).resolves.toMatchObject({
            error: { code: 'invalid_symbol' },
        });
    });

    it('인자 없는 도구는 빈 본문으로 호출할 수 있다', async () => {
        const response = await call('get_my_portfolio', '');
        expect(response.status).toBe(200);
    });

    it('예상 밖 throw는 내부 상세 없는 500 JSON', async () => {
        mockExecute.mockRejectedValue(new Error('secret connection string'));
        const response = await call('get_quote');
        expect(response.status).toBe(500);
        expect(await response.text()).not.toContain('secret');
    });
});
