/**
 * 실적 캘린더의 숫자·날짜 표기 — 통화는 심볼에서 유도하고 날짜·퍼센트는 로케일에 맞춘다.
 */
import {
    currencyFractionDigits,
    formatCompactAmount,
} from '@/shared/lib/priceFormat';
import { currencyForSymbol } from '@/shared/config/marketProfile/registry';
import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import {
    cachedDateTimeFormat,
    cachedNumberFormat,
} from '@/shared/lib/intlFormatCache';

/**
 * 통화는 심볼에서 유도한다 — 국내 종목은 원화다. 판정은 `currencyForSymbol` 한 곳에 위임한다.
 * shared `formatCompactCurrency`를 쓰지 않는 이유: 숫자 칸이 `4.5rem` 고정 너비라 ko-KR의 조/억 단위
 * ("US$1111.8억")는 줄바꿈된다. 좁은 칸에는 "$111.2B" 같은 en-US 축약이 필요해서 로케일·notation은
 * 유지한 채 통화만 바꾼다.
 */
const MONEY_FORMATTERS: Record<'USD' | 'KRW', Intl.NumberFormat> = {
    USD: new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: currencyFractionDigits('USD'),
    }),
    KRW: new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'KRW',
        maximumFractionDigits: currencyFractionDigits('KRW'),
    }),
};

/**
 * 서프라이즈 배지 전용 부호 퍼센트(`+2%`, `-3.4%`, 소수 0~1자리). shared `formatSignedPercent`
 * (`toFixed(1)` → `+2.0%`)와 일부러 다르다 — 배지의 기존 표기를 유지한다.
 */
export function formatSurprisePercent(value: number, locale: Locale): string {
    const formatter = cachedNumberFormat(INTL_LOCALE[locale], {
        signDisplay: 'always',
        maximumFractionDigits: 1,
    });
    return `${formatter.format(value)}%`;
}

/**
 * 날짜는 `timeZone: 'UTC'` 고정 — 날짜만 있는 문자열이 로컬 TZ에서 하루 밀리는 것과 서버/클라이언트
 * 렌더 불일치를 동시에 막는다.
 */
export function formatShortDate(dateStr: string, locale: Locale): string {
    return cachedDateTimeFormat(INTL_LOCALE[locale], {
        timeZone: 'UTC',
        month: 'short',
        day: 'numeric',
    }).format(new Date(dateStr));
}

/** EPS 등 주당 금액 표기 — `null`은 대시. */
export function formatCurrency(value: number | null, symbol: string): string {
    if (value === null) return '-';
    return MONEY_FORMATTERS[currencyForSymbol(symbol)].format(value);
}

/** 매출 표기 — 로케일의 축약 단위를 쓰고 통화는 심볼에서 정한다. `null`은 대시. */
export function formatRevenue(
    value: number | null,
    symbol: string,
    locale: Locale
): string {
    if (value === null) return '-';
    return formatCompactAmount(
        value,
        currencyForSymbol(symbol) === 'KRW' ? 'KRW' : 'USD',
        locale
    );
}
