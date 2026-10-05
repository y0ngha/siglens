import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import { cachedDateTimeFormat } from '@/shared/lib/intlFormatCache';

const KST_TIME_ZONE = 'Asia/Seoul';

/** 수집 시각을 한국 시간으로 `10월 3일 05:00 KST` 꼴(로케일별)로 찍는다. 잘못된 값이면 `null`. */
export function formatCapturedAtKst(
    capturedAt: string,
    locale: Locale
): string | null {
    const date = new Date(capturedAt);
    if (Number.isNaN(date.getTime())) return null;
    const formatted = cachedDateTimeFormat(INTL_LOCALE[locale], {
        timeZone: KST_TIME_ZONE,
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(date);
    // 타임존 이름은 ICU 환경마다 달라("GMT+9") 고정 라벨을 붙인다 — 어느 시계인지가 핵심이다.
    return `${formatted} KST`;
}
