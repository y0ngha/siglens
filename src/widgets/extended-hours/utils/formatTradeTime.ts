/**
 * 확장 세션 체결 시각 포맷 헬퍼(ET 고정).
 */
import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import { cachedDateTimeFormat } from '@/shared/lib/intlFormatCache';

/**
 * 체결 시각을 ET 벽시계 `HH:mm`으로. 확장 세션은 ET 기준(04:00~20:00)으로 정의되고 라벨에
 * `ET`가 붙으므로 사용자 타임존이 아니라 ET로 고정한다. 24시간제를 명시해 로케일별
 * 오전/오후 표기 차이를 없앤다.
 */
export function formatTradeTime(ms: number, locale: Locale): string {
    return cachedDateTimeFormat(INTL_LOCALE[locale], {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).format(new Date(ms));
}
