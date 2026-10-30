/**
 * 로케일 숫자 표기 헬퍼 — 밸류에이션 배수(PER·PBR 등)용.
 */
import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import { cachedNumberFormat } from '@/shared/lib/intlFormatCache';

/** 최대 `digits`자리 소수로 로케일 표기한다. 로케일은 `INTL_LOCALE`에서만 정한다. */
export function formatDecimal(
    value: number,
    digits: number,
    locale: Locale
): string {
    return cachedNumberFormat(INTL_LOCALE[locale], {
        maximumFractionDigits: digits,
    }).format(value);
}
