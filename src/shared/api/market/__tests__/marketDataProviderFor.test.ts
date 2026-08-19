import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));

class FakeFmp {
    readonly kind = 'fmp';
}
class FakeYahoo {
    readonly kind = 'yahoo';
}

vi.mock('@/shared/api/fmp/FmpMarketProvider', () => ({
    FmpMarketProvider: FakeFmp,
}));
vi.mock('@/shared/api/yahoo/YahooMarketProvider', () => ({
    YahooMarketProvider: FakeYahoo,
}));

/**
 * `marketDataProviderFor`는 모듈 레벨 싱글턴을 들고 있어 env를 바꿔 가며 검증하려면
 * 매 케이스마다 모듈을 다시 들여야 한다.
 */
async function loadModule() {
    vi.resetModules();
    return import('@/shared/api/market/getMarketDataProvider');
}

describe('marketDataProviderFor', () => {
    const originalE2E = process.env.E2E_TEST;

    beforeEach(() => {
        delete process.env.E2E_TEST;
    });
    afterEach(() => {
        if (originalE2E === undefined) delete process.env.E2E_TEST;
        else process.env.E2E_TEST = originalE2E;
    });

    it('(Happy) kr scope는 yahoo provider로 간다 — FMP 플랜에 KRX가 없다', async () => {
        const { marketDataProviderFor } = await loadModule();

        expect(marketDataProviderFor('kr')).toBeInstanceOf(FakeYahoo);
    });

    it('(Happy) us scope는 FMP provider로 간다', async () => {
        const { marketDataProviderFor } = await loadModule();

        expect(marketDataProviderFor('us')).toBeInstanceOf(FakeFmp);
    });

    it('(Happy) kr provider는 싱글턴이라 호출마다 새로 만들지 않는다', async () => {
        const { marketDataProviderFor } = await loadModule();

        expect(marketDataProviderFor('kr')).toBe(marketDataProviderFor('kr'));
    });

    // E2E 분기(`isE2E()` → FakeMarketProvider)는 여기서 검증하지 않는다 —
    // 소스가 `require('./FakeMarketProvider')`로 조건부 로드하는데 vitest ESM은
    // 확장자 없는 require를 해석하지 못한다. 실제 배선은 e2e 스위트가 검증한다.
});
