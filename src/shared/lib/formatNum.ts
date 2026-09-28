import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import { cachedNumberFormat } from '@/shared/lib/intlFormatCache';

/**
 * 숫자를 로케일 규칙(천 단위 구분자)으로 포맷한 뒤 단위 접미사를 붙여 반환한다.
 * `v`가 null 또는 NaN/±Infinity(비유한수)이면 'N/A'를 반환한다.
 *
 * @param v - 포맷할 숫자. null/NaN/±Infinity이면 'N/A' 반환.
 * @param unit - 숫자 뒤에 붙을 단위 문자열 (예: '원', '%', 'B').
 * @param locale - 표시 로케일. 기본값을 두지 않는다 — 빠지면 조용히 ko로 돌아간다.
 */
export function formatNum(
    v: number | null,
    unit: string,
    locale: Locale
): string {
    if (!Number.isFinite(v)) return 'N/A';
    // 예전에는 `'ko-KR'` 고정 모듈 상수였다 — 로케일은 `INTL_LOCALE`에서만 정한다.
    const formatter = cachedNumberFormat(INTL_LOCALE[locale]);
    // `!Number.isFinite` guard above ensures v is a finite number here.
    return `${formatter.format(v as number)}${unit}`;
}
