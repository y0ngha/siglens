// vi.mock → imports 순서 (MISTAKES.md Tests §17)
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: () => false }));

import { afterEach, describe, expect, it, vi } from 'vitest';
import { FmpMarketProvider } from '@/shared/api/fmp/FmpMarketProvider';
import { YahooMarketProvider } from '@/shared/api/yahoo/YahooMarketProvider';
import {
    getMarketDataProvider,
    marketDataProviderFor,
} from '@/shared/api/market/getMarketDataProvider';

// NOTE: The E2E branch (`require('./FakeMarketProvider')`) is not tested here
// because vitest's ESM runner cannot resolve CJS `require()` relative paths
// (same constraint as getCongressTradesProvider.test.ts / getFundamentalDataProvider.test.ts).
// The E2E path is exercised by Playwright E2E tests that run the full Next.js server
// with E2E_TEST=1.

describe('getMarketDataProvider', () => {
    it('같은 인스턴스를 반환한다(singleton)', () => {
        expect(getMarketDataProvider()).toBe(getMarketDataProvider());
    });
    it('FmpMarketProvider 인스턴스를 반환한다', () => {
        expect(getMarketDataProvider()).toBeInstanceOf(FmpMarketProvider);
    });
});

/**
 * 미국·크립토는 FMP지만 KRX는 FMP 플랜에 없어 yahoo를 쓴다 — 대시보드 캐시마다
 * 이 분기를 되풀이하면 한 곳만 빠져도 한국 페이지가 조용히 빈 시세를 그린다
 * (`marketDataProviderFor` JSDoc). 그 단일 분기점이 실제로 scope를 가르는지 검증한다.
 */
describe('marketDataProviderFor', () => {
    afterEach(() => {
        vi.resetModules();
    });

    it('scope="kr"이면 YahooMarketProvider 인스턴스를 반환한다', () => {
        expect(marketDataProviderFor('kr')).toBeInstanceOf(YahooMarketProvider);
    });

    it('scope="kr"에 대해서도 같은 인스턴스를 반환한다(singleton)', () => {
        expect(marketDataProviderFor('kr')).toBe(marketDataProviderFor('kr'));
    });

    it('scope="us"면 getMarketDataProvider()(FmpMarketProvider)로 위임한다', () => {
        expect(marketDataProviderFor('us')).toBe(getMarketDataProvider());
        expect(marketDataProviderFor('us')).toBeInstanceOf(FmpMarketProvider);
    });

    it('scope="crypto"도 kr이 아니므로 getMarketDataProvider()로 위임한다', () => {
        expect(marketDataProviderFor('crypto')).toBe(getMarketDataProvider());
    });
});
