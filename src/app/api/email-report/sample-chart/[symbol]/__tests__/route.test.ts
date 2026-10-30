// 샘플 차트는 데이터 제공자를 부르지 않는다. 제공자로 이어지는 모듈을 import하는 순간
// 테스트가 깨지도록 factory가 던지게 한다 — 호출 횟수를 세는 목은 import 자체를 못 잡는다.
vi.mock('@/entities/bars/server/loadBarsData', () => {
    throw new Error('sample chart must not load bars from a provider');
});
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => {
    throw new Error('sample chart must not touch the market data provider');
});
vi.mock('@/shared/api/fmp/httpClient', () => {
    throw new Error('sample chart must not call FMP');
});

import {
    dynamic,
    dynamicParams,
    generateStaticParams,
    GET,
} from '@/app/api/email-report/sample-chart/[symbol]/route';

// 이미지 렌더러(@vercel/og)는 내장 글꼴·wasm을 `file:`/`data:` URL로 `fetch`한다. 막아야 하는 건
// 시세 제공자로 나가는 `http(s)` 호출이라, 그것만 던지고 나머지는 원본으로 통과시킨다.
const realFetch = globalThis.fetch;
const networkCalls: string[] = [];
const fetchSpy = vi.fn(
    (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        const url = input instanceof Request ? input.url : String(input);
        if (/^https?:/i.test(url)) {
            networkCalls.push(url);
            throw new Error(`sample chart must not use the network: ${url}`);
        }
        return realFetch(input, init);
    }
);

function request(symbol: string): Promise<Response> {
    return GET(new Request(`https://siglens.io/x/${symbol}`), {
        params: Promise.resolve({ symbol }),
    });
}

describe('GET /api/email-report/sample-chart/[symbol]', () => {
    beforeEach(() => {
        networkCalls.length = 0;
        vi.stubGlobal('fetch', fetchSpy);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it.each(['NVDA', 'AAPL'])(
        '%s는 네트워크 없이 PNG를 돌려준다',
        async symbol => {
            const response = await request(symbol);

            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toBe('image/png');
            expect(response.headers.get('cache-control')).toContain(
                'max-age=86400'
            );
            const bytes = new Uint8Array(await response.arrayBuffer());
            expect(Array.from(bytes.subarray(0, 4))).toEqual([
                0x89, 0x50, 0x4e, 0x47,
            ]);
            expect(networkCalls).toEqual([]);
        },
        30_000
    );

    it('샘플에 없는 종목은 404다', async () => {
        const response = await request('MSFT');

        expect(response.status).toBe(404);
        expect(networkCalls).toEqual([]);
    });

    it('정적 라우트이며 샘플 종목만 미리 만든다', () => {
        expect(dynamic).toBe('force-static');
        expect(dynamicParams).toBe(false);
        expect(generateStaticParams()).toEqual([
            { symbol: 'NVDA' },
            { symbol: 'AAPL' },
        ]);
    });
});
