import { FmpFundamentalClient } from './fundamentalClient';
import { CachedFundamentalProvider } from './CachedFundamentalProvider';
import { CachedFinancialStatementsProvider } from './CachedFinancialStatementsProvider';
import { FmpFinancialStatementsClient } from './financialStatementsClient';
import { createE2EGatedSingleton } from '@/shared/api/createE2EGatedSingleton';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import { YahooFundamentalProvider } from '@/shared/api/yahoo/YahooFundamentalProvider';
import type { FundamentalProviderWithRawPeers } from './fundamentalProvider.types';

/**
 * FMP(미국·크립토) 경로. E2E에서는 Fake로 대체된다.
 *
 * 현금흐름·성장률은 재무제표 캐시(`financials:*:<SYM>:annual`)에서 꺼낸다 — 같은 FMP
 * 응답을 펀더멘털 키로 한 번 더 받지 않기 위해서다(`LatestAnnualStatementsSource` 참고).
 * 재무제표 provider 싱글턴과 인스턴스는 다르지만, 공유하는 것은 Redis 키와
 * `getOrSetCache`의 프로세스 단위 in-flight 맵이라 FMP 호출은 하나로 접힌다.
 */
const getFmpProvider: () => FundamentalProviderWithRawPeers =
    createE2EGatedSingleton(
        () =>
            new CachedFundamentalProvider(
                new FmpFundamentalClient(),
                new CachedFinancialStatementsProvider(
                    new FmpFinancialStatementsClient()
                ),
                // peer 목록에 섞여 오는 한국 종목은 yahoo 경로로 per/psr을 받는다(FMP는 402).
                peer => getFundamentalDataProvider(peer).getKeyMetricsTtm(peer)
            ),
        () => {
            // Sync factory — no dynamic import possible here, so the fake loads via a
            // gated require. Server-only and dead when E2E_TEST is unset (Turbopack
            // still bundles it into the server output).
            // Safe cast: require() returns the exact module object at runtime, but TS
            // cannot infer its shape from synchronous require(), so we assert it
            // matches the static import type of the same module.
            const { FakeFundamentalDataProvider } =
                require('./FakeFundamentalDataProvider') as typeof import('./FakeFundamentalDataProvider');
            return new FakeFundamentalDataProvider();
        }
    );

/**
 * KRX 경로(yahoo). E2E에서는 FMP와 같은 Fake를 쓴다 — E2E는 네트워크에 나가지 않으며,
 * 한국 종목 시나리오도 결정적 픽스처로 렌더되어야 한다.
 */
const getKrProvider: () => FundamentalProviderWithRawPeers =
    createE2EGatedSingleton(
        // Fake와 달리 `require`를 쓰지 않는다 — 이건 E2E에서만 살아나는 dead code가
        // 아니라 실제 프로덕션 경로라 Turbopack의 dead-code 분석 대상이 아니고,
        // 정적 import여야 테스트에서도 모듈이 해석된다.
        () => new CachedFundamentalProvider(new YahooFundamentalProvider()),
        () => {
            const { FakeFundamentalDataProvider } =
                require('./FakeFundamentalDataProvider') as typeof import('./FakeFundamentalDataProvider');
            return new FakeFundamentalDataProvider();
        }
    );

/**
 * Returns the app's fundamental data provider (FMP in prod, fake under E2E_TEST).
 *
 * `symbol`을 넘기면 시장에 맞는 provider를 고른다 — 한국 종목(`005930.KS`)은 FMP 플랜이
 * 커버하지 않아 yahoo로 가야 한다. 인자를 생략하면 종전대로 FMP 경로를 반환하므로,
 * 심볼을 모르는 호출부(모듈 레벨 상수 등)의 동작은 바뀌지 않는다.
 *
 * 두 provider 모두 싱글턴이라 호출마다 인스턴스가 생기지 않는다.
 */
export function getFundamentalDataProvider(
    symbol?: string
): FundamentalProviderWithRawPeers {
    return symbol !== undefined && isKrEquitySymbol(symbol)
        ? getKrProvider()
        : getFmpProvider();
}
