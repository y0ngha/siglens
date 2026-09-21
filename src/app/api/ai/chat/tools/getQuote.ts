import 'server-only';
import type { MarketQuote } from '@y0ngha/siglens-core';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { getDescriptor } from '@/shared/config/marketProfile';
import { MS_PER_DAY, MS_PER_SECOND } from '@/shared/config/time';
import { assessFreshness, type FreshnessView } from './freshness';
import type { ToolExecutor } from './index';
import { resolveAssetInfoOrNull } from './resolveAssetInfo';

const MAX_SYMBOLS = 3;

/**
 * `MarketQuote.timestamp` (core, unix seconds) is the provider's own quote
 * time, when the adapter reports one — `FmpMarketProvider`/`YahooMarketProvider`
 * both pass it through now (spec §3.8, audit B10). Falls
 * back to fetch time + `asOfIsFetchTime: true` only when the field is
 * absent, so a provider outage/degraded row that genuinely has no quote time
 * still gets an honest `asOf`.
 */
function quoteAsOf(quote: MarketQuote): {
    asOf: string;
    asOfIsFetchTime?: true;
    freshness?: FreshnessView;
} {
    if (quote.timestamp !== undefined && Number.isFinite(quote.timestamp)) {
        const asOfMs = quote.timestamp * MS_PER_SECOND;
        return {
            asOf: new Date(asOfMs).toISOString(),
            freshness: assessFreshness({
                asOfMs,
                maxAgeMs: QUOTE_MAX_AGE_MS,
                nowMs: Date.now(),
            }),
        };
    }
    return { asOf: new Date().toISOString(), asOfIsFetchTime: true };
}

/**
 * 시세가 "마지막 값에 동결됐다"고 볼 나이.
 *
 * 두 경우를 가른다. **정상 휴장은 절대 걸리면 안 되고**(금요일 종가를 연휴 뒤에
 * 물어도 정상), 상장폐지·티커 개명으로 **갱신이 멈춘** 시세는 걸려야 한다.
 *
 * 실측 사례(2026-09-21): `SQ`는 2025-02-13에 `XYZ`로 개명됐는데 FMP `quote`가
 * 그 시점의 값(83.46달러)을 19개월째 그대로 돌려줬다. 우리는 그걸 통과시켜
 * "현재가 83.46달러, 전일 대비 +0.57%"로 제시했다 — 그날 실제 XYZ는 76.28달러로
 * 8.6% 차이였다.
 *
 * **14일인 이유는 KRX다.** 처음엔 7일로 잡았는데, 한국 연휴 클러스터가 그걸
 * 넘는다: 2025년 추석·개천절·한글날이 겹쳐 KRX가 10/3·6·7·8·9 휴장했고, 양쪽
 * 주말까지 더하면 마지막 체결(10/2 15:30 KST)과 다음 개장(10/10) 사이가 약
 * 7일 17시간이다. 그 자리에서 정상 종가가 `stale`로 찍힌다. KR 시세도
 * `timestamp`를 싣는다(`YahooMarketProvider`의 `regularMarketTime`).
 *
 * 자산군별로 나누지 않는다. 크립토는 24시간 거래라 훨씬 짧게 잡을 수도 있지만,
 * 이 값의 목적은 "장이 쉬었다"가 아니라 "이 심볼은 더 이상 갱신되지 않는다"를
 * 잡는 것이고 그건 자산군과 무관하다. 14일은 어느 시장의 정상 휴장보다도 길고,
 * 개명·폐지로 동결된 시세(월 단위)보다는 한참 짧다.
 *
 * 테스트가 이 상수를 **직접 import해** 양쪽 경계를 고정한다 — 값을 복제하면
 * 상수를 줄여도 테스트가 같이 줄어들어 아무것도 못 잡는다.
 */
export const QUOTE_MAX_AGE_MS = 14 * MS_PER_DAY;

/**
 * Per-symbol profile → session spec (KR = Yahoo, US/crypto = FMP), quoted
 * through `fmpSymbol` when the canonical symbol differs from the one the
 * provider expects (e.g. indices). `quoteDelayMinutes` is surfaced so the
 * model doesn't present a 20-minute-delayed KR quote as real-time.
 */
export const getQuoteTool: ToolExecutor = async args => {
    const symbols = (args.symbols as string[])
        .slice(0, MAX_SYMBOLS)
        .map(s => s.toUpperCase());
    // `allSettled`, not `all` — one symbol's provider error (e.g. FMP rate
    // limit on a single ticker) must not blank out every other requested
    // quote in the same call.
    const settled = await Promise.allSettled(
        symbols.map(async symbol => {
            const [profile, asset] = await Promise.all([
                resolveMarketProfile(symbol),
                resolveAssetInfoOrNull(symbol, 'get_quote'),
            ]);
            const quote = await getCachedMarketDataProvider(
                sessionSpecFor(profile)
            ).getQuote(asset?.fmpSymbol ?? symbol);
            if (quote === null) return { symbol, found: false };
            const descriptor = getDescriptor(profile);
            return {
                symbol,
                found: true,
                price: quote.price,
                changesPercentage: quote.changesPercentage,
                currency: descriptor.priceFormat.currency,
                marketProfile: profile,
                quoteDelayMinutes: descriptor.quoteDelayMinutes,
                ...quoteAsOf(quote),
            };
        })
    );
    const quotes = settled.map((result, i) =>
        result.status === 'fulfilled'
            ? result.value
            : { symbol: symbols[i]!, found: false }
    );
    return {
        asOf: new Date().toISOString(),
        source: 'market data provider (60s in-session cache)',
        quotes,
    };
};
