/**
 * 캘린더 이벤트의 예상·이전·실제 값 줄 — 값이 있는 조각만 이어 붙인다.
 */
import type { Locale } from '@/shared/i18n/locales';
import { formatNum } from '@/shared/lib/formatNum';
import type { CalendarGridEvent } from '../model/calendarTypes';

/** 값 줄의 예상·이전·실제 조각 구분자. */
export const VALUE_PART_SEPARATOR = ' | ';

type ValuePartKey =
    | 'EconomicCalendarGrid.forecastPart'
    | 'EconomicCalendarGrid.previousPart'
    | 'EconomicCalendarGrid.actualPart';

/** 값 줄 조각을 푸는 번역 함수 — `widgets.economy` 번역자를 좁힌 형태. */
export type ValuePartTranslator = (
    key: ValuePartKey,
    values: { v0: string }
) => string;

/**
 * 예상·이전·실제 값 줄을 **값이 있는 것만** 이어 붙인다. FMP가 값을 안 주는 지표(대부분
 * 연설·경매 일정)에 `N/A`를 줄지어 띄우지 않도록 유한수가 아닌 값은 라벨째 뺀다.
 *
 * 예상·이전이 둘 다 없는데 실제가 `0`이면 FMP가 아직 안 채운 자리표시값이므로 실제도 뺀다 —
 * 그대로 두면 `실제 0%`가 마치 발표된 결과처럼 읽힌다.
 */
export function buildValueParts(
    ev: CalendarGridEvent,
    t: ValuePartTranslator,
    locale: Locale
): string[] {
    const { estimate, previous, actual, unit } = ev;
    const hasBaseline = Number.isFinite(estimate) || Number.isFinite(previous);
    const showActual = Number.isFinite(actual) && (hasBaseline || actual !== 0);
    return [
        Number.isFinite(estimate)
            ? t('EconomicCalendarGrid.forecastPart', {
                  v0: formatNum(estimate, unit, locale),
              })
            : null,
        Number.isFinite(previous)
            ? t('EconomicCalendarGrid.previousPart', {
                  v0: formatNum(previous, unit, locale),
              })
            : null,
        showActual
            ? t('EconomicCalendarGrid.actualPart', {
                  v0: formatNum(actual, unit, locale),
              })
            : null,
    ].filter((part): part is string => part !== null);
}
