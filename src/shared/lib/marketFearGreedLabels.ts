import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import { cachedNumberFormat } from '@/shared/lib/intlFormatCache';

/**
 * 시장 공포·탐욕 지수를 제공하는 시장.
 *
 * `NavRegionId`와 값이 같아졌지만 재사용하지 않는다 — 내비에 지역을 연다고 그
 * 지역의 지수가 생기는 것이 아니다. 암호화폐는 채권 요인이 없는 전용 6요인 지수
 * (`computeCryptoFearGreedIndex`)가 생긴 뒤에야 여기 들어왔다.
 */
export type FearGreedMarketId = 'us' | 'kr' | 'crypto';

// Intl.NumberFormat instances are expensive to construct, so we cache one per
// (locale, sign mode) and reuse them across all factors. 예전에는 `'ko-KR'` 고정
// 모듈 상수였다 — 로케일은 `INTL_LOCALE`에서만 정한다.
// Every market factor's rawValue is a ratio, so one 2dp precision fits all.
// What differs is the sign: US/KR factors (and crypto momentum, downside
// volatility, safe haven) are signed distances or return spreads, while three
// crypto factors are [0, 1] shares — "+50.00%" would read as a change that
// does not exist, so shares render unsigned.
function marketFactorFormatter(
    signed: boolean,
    locale: Locale
): Intl.NumberFormat {
    return cachedNumberFormat(INTL_LOCALE[locale], {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        ...(signed ? { signDisplay: 'always' as const } : {}),
    });
}

/**
 * Crypto factors whose rawValue is a share in [0, 1] (core
 * `CryptoFearGreedFactorKey`). `breadth` is listed here only for crypto — the
 * US/KR `breadth` is a return spread and stays signed.
 */
const CRYPTO_SHARE_FACTOR_KEYS: ReadonlySet<string> = new Set([
    'breadth',
    'alt_season',
    'volume_flow',
]);

/**
 * Raw value 표시 포맷터 — 2dp 퍼센트. 부호 있는 거리·수익률 차는 `+`/`-`를
 * 붙이고, 암호화폐의 비율 요인(시장 폭·알트 시즌·거래량 흐름)은 부호 없이 낸다.
 */
export function formatMarketFactorRaw(
    rawValue: number,
    key: string,
    market: FearGreedMarketId,
    locale: Locale
): string {
    const isShare = market === 'crypto' && CRYPTO_SHARE_FACTOR_KEYS.has(key);
    return marketFactorFormatter(!isShare, locale).format(rawValue);
}
