import 'server-only';
import { getYahooFundamentals } from './yahooFundamentalSource';
import { sym } from '@/shared/api/fmp/symKey';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { FMP_FUNDAMENTAL_CACHE_TTL_SECONDS } from '@/shared/config/time';

/**
 * yahoo `summaryDetail`/`defaultKeyStatistics`에서 꺼낸 배당 필드. 수익률은 yahoo 원값(소수, 0.018 = 1.8%)이다.
 * 날짜는 Redis(JSON) 왕복을 견디도록 ISO 문자열로 바꿔 둔다.
 */
export interface YahooDividendSummary {
    /** 연 배당률(주당, 현재 공시 기준). */
    dividendRate: number | null;
    /** 최근 12개월 주당 배당 합. */
    trailingAnnualDividendRate: number | null;
    dividendYield: number | null;
    trailingAnnualDividendYield: number | null;
    /** 직전 배당락일(`YYYY-MM-DD`). */
    exDividendDate: string | null;
    /** 마지막 1회 배당금(주당). */
    lastDividendValue: number | null;
    /** 마지막 배당 일자(`YYYY-MM-DD`). */
    lastDividendDate: string | null;
}

function numberOrNull(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** yahoo는 날짜를 `Date`(또는 캐시를 거친 ISO 문자열·epoch 초)로 준다. 해석이 안 되면 null. */
function isoDateOrNull(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const date =
        value instanceof Date
            ? value
            : new Date(
                  typeof value === 'number' ? value * 1000 : String(value)
              );
    return Number.isFinite(date.getTime())
        ? date.toISOString().slice(0, 10)
        : null;
}

/**
 * 한국 종목의 배당 요약. `null`은 yahoo가 요약 자체를 못 준 경우(장애·미지원)이고, 요약은 왔지만
 * 배당 필드가 전부 비어 있으면 모든 필드가 null인 객체다 — 호출부가 "모름"으로 읽는다.
 * 키 `dividends:yahoo:<SYM>` — 24h. `null`(장애)은 캐시하지 않도록 throw로 바꿔 `getOrSetCache`의
 * 쓰기를 건너뛴다.
 */
export async function getYahooDividendSummary(
    symbol: string
): Promise<YahooDividendSummary | null> {
    const upper = sym(symbol);
    try {
        return await getOrSetCache(
            `dividends:yahoo:${upper}`,
            FMP_FUNDAMENTAL_CACHE_TTL_SECONDS,
            async () => {
                const { summary } = await getYahooFundamentals(upper);
                if (summary === null) throw new Error('yahoo summary missing');
                const detail = summary.summaryDetail;
                const stats = summary.defaultKeyStatistics;
                return {
                    dividendRate: numberOrNull(detail?.dividendRate),
                    trailingAnnualDividendRate: numberOrNull(
                        detail?.trailingAnnualDividendRate
                    ),
                    dividendYield: numberOrNull(detail?.dividendYield),
                    trailingAnnualDividendYield: numberOrNull(
                        detail?.trailingAnnualDividendYield
                    ),
                    exDividendDate: isoDateOrNull(detail?.exDividendDate),
                    lastDividendValue: numberOrNull(stats?.lastDividendValue),
                    lastDividendDate: isoDateOrNull(stats?.lastDividendDate),
                } satisfies YahooDividendSummary;
            }
        );
    } catch (error) {
        console.warn('[yahooDividend] summary unavailable', upper, error);
        return null;
    }
}
