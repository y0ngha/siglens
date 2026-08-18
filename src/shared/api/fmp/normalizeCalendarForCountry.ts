import type {
    CalendarImpact,
    EconomicCalendarEvent,
} from '@y0ngha/siglens-core';

const IMPACTS: readonly CalendarImpact[] = ['Low', 'Medium', 'High'];

/**
 * FMP economic-calendar 응답을 **지정 국가**의 이벤트로 정규화한다.
 *
 * core의 `normalizeEconomicCalendar`는 `country === 'US'`를 하드코딩한다 — 한국
 * 이벤트를 받으려면 그 함수를 쓸 수 없다. 국가 필터는 데이터 소스 지식이지
 * 분석 도메인이 아니므로(`docs/architecture/SCOPE.md`: 프로바이더 구현은 siglens)
 * 여기서 소유한다. 그 외 정규화 규칙(필수 필드, impact enum, 날짜 오름차순)은
 * core와 동일하게 맞춰 두 경로의 결과 형상이 갈리지 않게 한다.
 *
 * **실측(2026-08-18)**: 3개월 창 5,893건 중 `country: 'KR'`이 88건. 180일 창에서는
 * KR 94건, 그중 `actual`이 채워진 것 63건 — 기준금리·CPI·실업률·GDP·국고채 낙찰금리가
 * 모두 들어 있다.
 *
 * @param raw - FMP 응답(형상 임의). 배열이 아니면 빈 목록.
 * @param country - ISO-3166 alpha-2 코드(`'US'` / `'KR'`).
 */
export function normalizeCalendarForCountry(
    raw: unknown,
    country: string
): EconomicCalendarEvent[] {
    if (!Array.isArray(raw)) return [];

    return raw
        .flatMap(item => {
            if (typeof item !== 'object' || item === null) return [];
            const obj = item as Record<string, unknown>;
            if (asString(obj.country) !== country) return [];

            const date = asString(obj.date);
            const event = asString(obj.event);
            if (date === '' || event === '') return [];

            return [
                {
                    date,
                    event,
                    impact: asImpact(obj.impact),
                    actual: asNumberOrNull(obj.actual),
                    estimate: asNumberOrNull(obj.estimate),
                    previous: asNumberOrNull(obj.previous),
                    unit: asString(obj.unit),
                } satisfies EconomicCalendarEvent,
            ];
        })
        .toSorted((a, b) => a.date.localeCompare(b.date));
}

function asString(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function asImpact(value: unknown): CalendarImpact {
    return IMPACTS.includes(value as CalendarImpact)
        ? (value as CalendarImpact)
        : 'Low';
}

/**
 * `Number(...)`로 강제하지 않는다 — `Number(null)`은 0이고 그건 유한수라, 발표되지
 * 않은 지표(`actual: null`)가 "0으로 발표됨"이 된다.
 */
function asNumberOrNull(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
