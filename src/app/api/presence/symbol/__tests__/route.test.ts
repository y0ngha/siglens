import { constants } from 'node:http2';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_BAD_REQUEST } = constants;

const HUMAN_UA = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/140.0.0.0';
const BOT_UA =
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

const recordView = vi.fn().mockResolvedValue(undefined);
const pruneOlderThan = vi.fn().mockResolvedValue(undefined);
let requestHeaders = new Headers();

vi.mock('next/headers', () => ({
    headers: () => Promise.resolve(requestHeaders),
}));

// `after()`만 갈아끼운다 — 통째로 대체하면 isBot이 쓰는 userAgent가 사라진다.
vi.mock('next/server', async importOriginal => {
    const actual = await importOriginal<typeof import('next/server')>();
    return {
        ...actual,
        after: (fn: () => unknown) => {
            void fn();
        },
    };
});

const getDatabaseClient = vi.fn(() => ({ db: {} }));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => getDatabaseClient(),
}));

vi.mock('@/entities/symbol-view', () => ({
    DrizzleSymbolViewRepository: class {
        recordView = recordView;
        pruneOlderThan = pruneOlderThan;
    },
}));

/** 라우트가 모듈 스코프에 마지막 prune 날짜를 들고 있어 매번 새로 import한다. */
async function importRoute() {
    vi.resetModules();
    return import('@/app/api/presence/symbol/route');
}

function post(body: unknown): Request {
    return new Request('https://siglens.io/api/presence/symbol', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });
}

describe('POST /api/presence/symbol', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDatabaseClient.mockReturnValue({ db: {} });
        vi.stubEnv('NODE_ENV', 'production');
        requestHeaders = new Headers({ 'user-agent': HUMAN_UA });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('정상 요청은 대문자 심볼로 기록하고 204를 준다', async () => {
        const { POST } = await importRoute();
        const res = await POST(post({ symbol: 'aapl' }));

        expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
        expect(recordView).toHaveBeenCalledWith(
            expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
            'AAPL'
        );
    });

    it.each(['005930.KS', 'BTCUSD', 'BRK.B'])(
        '%s 형상을 받는다',
        async symbol => {
            const { POST } = await importRoute();
            await POST(post({ symbol }));
            expect(recordView).toHaveBeenCalledWith(expect.any(String), symbol);
        }
    );

    it('봇은 기록하지 않는다', async () => {
        requestHeaders = new Headers({ 'user-agent': BOT_UA });
        const { POST } = await importRoute();
        const res = await POST(post({ symbol: 'AAPL' }));
        expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
        expect(recordView).not.toHaveBeenCalled();
    });

    it('프로덕션이 아니면 기록하지 않는다', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        const { POST } = await importRoute();
        await POST(post({ symbol: 'AAPL' }));
        expect(recordView).not.toHaveBeenCalled();
    });

    it.each([
        ['깨진 JSON', '{'],
        ['심볼 없음', {}],
        ['문자열 아님', { symbol: 42 }],
        ['해외 거래소 접미사', { symbol: 'HVO.L' }],
        ['형상 불량', { symbol: '../../etc' }],
    ])('%s → 400', async (_label, body) => {
        const { POST } = await importRoute();
        const res = await POST(post(body));
        expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST);
        expect(recordView).not.toHaveBeenCalled();
    });

    it('DB 실패는 삼키고 204 — 정리도 건너뛴다', async () => {
        recordView.mockRejectedValueOnce(new Error('neon down'));
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const { POST } = await importRoute();
        const res = await POST(post({ symbol: 'AAPL' }));

        expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
        expect(pruneOlderThan).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    it('인스턴스당 하루 한 번 90일 이전 행을 정리한다', async () => {
        const { POST } = await importRoute();
        await POST(post({ symbol: 'AAPL' }));
        await POST(post({ symbol: 'NVDA' }));

        expect(pruneOlderThan).toHaveBeenCalledTimes(1);
        expect(pruneOlderThan).toHaveBeenCalledWith(
            expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
        );
    });
});
