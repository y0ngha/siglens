import { CachedFinancialStatementsProvider } from './CachedFinancialStatementsProvider';
import { FmpFinancialStatementsClient } from './financialStatementsClient';
import { createE2EGatedSingleton } from '@/shared/api/createE2EGatedSingleton';
import { isKrEquitySymbol } from '@/shared/config/marketProfile';
import { YahooFinancialStatementsProvider } from '@/shared/api/yahoo/YahooFinancialStatementsProvider';
import type { FinancialStatementsProvider } from '@y0ngha/siglens-core';

function loadFake(): FinancialStatementsProvider {
    // Sync factory — no dynamic import possible here, so the fake loads via a
    // gated require. Server-only and dead when E2E_TEST is unset (Turbopack
    // still bundles it into the server output).
    // Safe cast: require() returns the exact module object at runtime, but TS
    // cannot infer its shape from synchronous require(), so we assert it
    // matches the static import type of the same module.
    const { FakeFinancialStatementsProvider } =
        require('./FakeFinancialStatementsProvider') as typeof import('./FakeFinancialStatementsProvider');
    return new FakeFinancialStatementsProvider();
}

/** FMP(미국) 경로. E2E에서는 Fake로 대체된다. */
const getFmpProvider: () => FinancialStatementsProvider =
    createE2EGatedSingleton(
        () =>
            new CachedFinancialStatementsProvider(
                new FmpFinancialStatementsClient()
            ),
        loadFake
    );

/** KRX 경로(yahoo). E2E는 네트워크에 나가지 않으므로 FMP와 같은 Fake를 쓴다. */
const getKrProvider: () => FinancialStatementsProvider =
    createE2EGatedSingleton(
        // Fake와 달리 `require`를 쓰지 않는다 — 이건 E2E에서만 살아나는 dead code가
        // 아니라 실제 프로덕션 경로라 Turbopack의 dead-code 분석 대상이 아니고,
        // 정적 import여야 테스트에서도 모듈이 해석된다.
        () =>
            new CachedFinancialStatementsProvider(
                new YahooFinancialStatementsProvider()
            ),
        loadFake
    );

/**
 * Returns the app's financial statements provider (FMP in prod, fake under E2E_TEST).
 *
 * `symbol`을 넘기면 시장에 맞는 provider를 고른다 — 한국 종목은 FMP 플랜이 커버하지
 * 않아 yahoo로 가야 한다. 인자를 생략하면 종전대로 FMP 경로를 반환한다.
 */
export function getFinancialStatementsProvider(
    symbol?: string
): FinancialStatementsProvider {
    return symbol !== undefined && isKrEquitySymbol(symbol)
        ? getKrProvider()
        : getFmpProvider();
}
