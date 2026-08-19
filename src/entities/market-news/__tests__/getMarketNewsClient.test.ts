import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));

class FakeFmpClient {
    readonly kind = 'fmp';
}
class FakeNaverClient {
    readonly kind = 'naver';
}

vi.mock('@/entities/market-news/lib/fmpMarketNewsClient', () => ({
    FmpMarketNewsClient: FakeFmpClient,
}));
vi.mock('@/entities/market-news/lib/naverMarketNewsClient', () => ({
    NaverMarketNewsClient: FakeNaverClient,
}));

/** 싱글턴이 모듈 레벨이라 env를 바꿔 검증하려면 매 케이스 모듈을 다시 들인다. */
async function loadModule() {
    vi.resetModules();
    return import('@/entities/market-news/lib/getMarketNewsClient');
}

describe('getMarketNewsClient', () => {
    const originalE2E = process.env.E2E_TEST;

    beforeEach(() => {
        delete process.env.E2E_TEST;
    });
    afterEach(() => {
        if (originalE2E === undefined) delete process.env.E2E_TEST;
        else process.env.E2E_TEST = originalE2E;
    });

    it('(Happy) kr 카테고리는 네이버 클라이언트로 간다', async () => {
        const { getMarketNewsClient } = await loadModule();

        expect(getMarketNewsClient('kr')).toBeInstanceOf(FakeNaverClient);
    });

    it.each(['general', 'stock', 'crypto', 'forex', 'articles'] as const)(
        '(Happy) %s 카테고리는 FMP 클라이언트로 간다',
        async category => {
            const { getMarketNewsClient } = await loadModule();

            expect(getMarketNewsClient(category)).toBeInstanceOf(FakeFmpClient);
        }
    );

    it('(Happy) 소스별 클라이언트는 각각 싱글턴이다', async () => {
        const { getMarketNewsClient } = await loadModule();

        expect(getMarketNewsClient('kr')).toBe(getMarketNewsClient('kr'));
        expect(getMarketNewsClient('stock')).toBe(
            getMarketNewsClient('general')
        );
        expect(getMarketNewsClient('kr')).not.toBe(
            getMarketNewsClient('stock')
        );
    });

    // E2E 분기(`isE2E()` → FakeMarketNewsClient)는 여기서 검증하지 않는다 —
    // 소스가 `require('./FakeMarketNewsClient')`로 조건부 로드하는데 vitest ESM은
    // 확장자 없는 require를 해석하지 못한다. 실제 배선은 e2e 스위트가 검증한다.
});
