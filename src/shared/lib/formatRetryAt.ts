import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import { cachedDateTimeFormat } from '@/shared/lib/intlFormatCache';

/**
 * 한도 재시도 시각 표기. 날짜를 함께 쓴다 — 일 한도는 다음 날 자정(UTC)에 풀려서
 * 시각만 쓰면 "오늘 09:00"인지 "내일 09:00"인지 읽히지 않는다. 시간대는 브라우저 것이다.
 */
const RETRY_AT_FORMAT: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
};

/** epoch ms를 사용자 로케일의 "월 일 시:분"으로 포맷한다. */
export function formatRetryAt(retryAt: number, locale: Locale): string {
    return cachedDateTimeFormat(INTL_LOCALE[locale], RETRY_AT_FORMAT).format(
        retryAt
    );
}
