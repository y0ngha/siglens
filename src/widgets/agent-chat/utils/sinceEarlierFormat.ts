import { getDescriptor } from '@/shared/config/marketProfile/registry';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import { cachedDateTimeFormat } from '@/shared/lib/intlFormatCache';
import { formatPrice, formatSignedPercent } from '@/shared/lib/priceFormat';

/**
 * 일봉 거래일(`YYYY-MM-DD`)을 "11월 18일"처럼 쓴다. 거래일은 날짜 그 자체라 UTC로 읽는다(시간대로 하루가
 * 밀리지 않게). 올해가 아니면 연도를 붙여, 몇 달 지난 분석이 올해 날짜로 읽히지 않게 한다.
 */
export function formatTradingDate(
    date: string,
    locale: Locale,
    now: Date
): string {
    const instant = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(instant.getTime())) return date;
    const thisYear = now.getUTCFullYear();
    return cachedDateTimeFormat(INTL_LOCALE[locale], {
        timeZone: 'UTC',
        ...(instant.getUTCFullYear() === thisYear ? {} : { year: 'numeric' }),
        month: 'long',
        day: 'numeric',
    }).format(instant);
}

/** 시장 프로필의 가격 표기(통화·소수 자릿수)로 쓴다. 로케일과 무관하게 시장 표기다(다른 종목 카드와 같다). */
export function formatMarketPrice(
    value: number,
    marketProfile: MarketProfileId
): string {
    return formatPrice(value, getDescriptor(marketProfile).priceFormat);
}

/** "+3.2%" — 분석일 종가 대비 지금 값의 변화. 기준값이 양수가 아니면 `null`(퍼센트를 지어내지 않는다). */
export function formatChangeSinceThen(
    now: number,
    then: number
): string | null {
    if (!Number.isFinite(now) || !Number.isFinite(then) || then <= 0)
        return null;
    return formatSignedPercent((now / then - 1) * 100);
}
