/**
 * 등급 변경 행의 날짜 표기와 React 키 — 둘 다 이벤트 데이터에서 순수하게 만든다.
 */
import type { GradesEvent } from '@y0ngha/siglens-core';
import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import { cachedDateTimeFormat } from '@/shared/lib/intlFormatCache';

/**
 * 공시일은 날짜만 있는 값이라 `timeZone: 'UTC'`로 고정한다 — 로컬 TZ로 포맷하면 서버(UTC)와
 * 클라이언트에서 하루가 어긋나 하이드레이션이 깨진다.
 */
export function formatGradeDate(dateStr: string, locale: Locale): string {
    return cachedDateTimeFormat(INTL_LOCALE[locale], {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }).format(new Date(dateStr));
}

/**
 * 행 키. FMP는 같은 날 같은 회사가 같은 등급을 반복한 행을 돌려주므로 내용만으로는 유일하지 않다 —
 * 목록은 앞에서부터 늘어나기만 하고 재정렬되지 않으니 인덱스를 섞어 유일성을 보장한다.
 */
export function gradeRowKey(event: GradesEvent, index: number): string {
    return `${event.date}-${event.gradingCompany}-${event.newGrade}-${index}`;
}
