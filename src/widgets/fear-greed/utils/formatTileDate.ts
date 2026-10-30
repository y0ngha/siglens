import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import { cachedDateTimeFormat } from '@/shared/lib/intlFormatCache';

/**
 * 비교 타일에 적는 기록 날짜(`YYYY-MM-DD`)를 로케일 표기로 바꾼다.
 *
 * 날짜는 거래일 자체라 시각이 없다. UTC 자정으로 읽고 UTC로 찍어야 보는 사람의
 * 시간대에 따라 하루 앞뒤로 밀리지 않는다.
 */
export function formatTileDate(isoDate: string, locale: Locale): string {
    return cachedDateTimeFormat(INTL_LOCALE[locale], {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }).format(new Date(`${isoDate}T00:00:00Z`));
}
