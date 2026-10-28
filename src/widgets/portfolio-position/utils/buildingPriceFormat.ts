/**
 * 포지션 빌딩·카드의 가격 표기 — 통화(심볼에서 유도)에 맞춘 금액 문자열과, 폭이 고정된 SVG 라벨용
 * 축약 표기.
 */
import {
    currencyForSymbol,
    getDescriptor,
} from '@/shared/config/marketProfile/registry';
import {
    dynamicDecimals,
    formatPrice,
    formatUsdCurrency,
    formatUsdPrice,
} from '@/shared/lib/priceFormat';

/**
 * KRW와 sub-$1은 두 포매터가 같은 표기를 쓴다 — 원화는 소수점이 없고(`kr-equity` priceFormat이
 * integer라 `formatPrice`가 0자리를 낸다), 1달러 미만(암호화폐 등)은 고정 2자리가 "$0"으로 뭉개므로
 * `dynamicDecimals`로 유효자리를 보존한다. 그 밖의 USD만 호출부가 고른 포매터로 낸다.
 */
function formatAmountWith(
    value: number,
    symbol: string,
    formatUsd: (value: number) => string
): string {
    if (currencyForSymbol(symbol) === 'KRW') {
        return formatPrice(value, getDescriptor('kr-equity').priceFormat);
    }
    if (value !== 0 && Math.abs(value) < 1) {
        return `$${value.toFixed(dynamicDecimals(value))}`;
    }
    return formatUsd(value);
}

/**
 * "$300" / "₩274,500" — 값 하나만 보여 주는 자리용. 통화는 심볼에서 유도하고(`currencyForSymbol`),
 * USD는 후행 0을 자른다(`$300`이 `$300.00`보다 낫다).
 */
export function formatAmount(value: number, symbol: string): string {
    return formatAmountWith(value, symbol, v => `$${formatUsdPrice(v)}`);
}

/**
 * 여러 가격을 **한 문장 안에** 나란히 쓰는 자리용 — USD는 소수 2자리를 고정한다. 후행 0을 자르면
 * "범위는 $224.69 ~ $344.57이고, 현재가 $309.9는"처럼 자릿수가 들쭉날쭉해져 오타처럼 읽힌다.
 */
export function formatAmountAligned(value: number, symbol: string): string {
    return formatAmountWith(value, symbol, formatUsdCurrency);
}

/**
 * in-SVG 라벨은 고정 viewBox 폭이라 고가 종목(예: BRK.A $600,000+)에서 잘릴 수 있어 이 라벨에서만
 * 축약한다. 기준은 통화마다 다르다 — 원화는 자릿수가 커서 USD 기준(10만)을 쓰면 흔한 ₩274,500
 * 종목까지 "₩275K"로 줄어든다(원화 독자에게 K 단위는 낯설고, 전체 값도 라벨 폭 안에 들어간다).
 * aria-label은 정밀도를 위해 항상 전체 값을 쓴다.
 */
const IN_SVG_COMPACT_THRESHOLD: Record<'USD' | 'KRW', number> = {
    USD: 100_000,
    KRW: 10_000_000,
};

const CURRENCY_PREFIX: Record<'USD' | 'KRW', string> = { USD: '$', KRW: '₩' };

const THOUSAND = 1_000;
const MILLION = 1_000_000;

/** 천 단위(K)로 줄이고, 반올림이 1000K에 닿으면(999,600 → "1000K") 백만 단위(M, 소수 1자리)로 올린다. */
function compactAmount(value: number): string {
    const thousands = Math.round(value / THOUSAND);
    if (Math.abs(thousands) < THOUSAND) return `${thousands}K`;
    return `${Number((value / MILLION).toFixed(1))}M`;
}

/** Exported so the clipping-regression test can build the exact string the
 * component renders (avoids a second, potentially-drifting copy in the test). */
export function formatCompactForSvgLabel(
    value: number,
    symbol: string
): string {
    const currency = currencyForSymbol(symbol) === 'KRW' ? 'KRW' : 'USD';
    if (Math.abs(value) < IN_SVG_COMPACT_THRESHOLD[currency])
        return formatAmount(value, symbol);
    return `${CURRENCY_PREFIX[currency]}${compactAmount(value)}`;
}
