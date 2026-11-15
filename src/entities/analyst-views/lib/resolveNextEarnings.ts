import type { AnalystEarningsHint, EarningsSession } from '../model';

/**
 * DB/FMP 일정과 Yahoo 실적 힌트를 대조한 결과 — 에이전트 도구와 펀더멘털 탭 사실 문장이 같은 판정을 쓴다.
 */
export interface ResolvedNextEarnings {
    /** 보여 줄 날짜. 일정이 없으면 `null`. */
    date: string | null;
    /** 확정 여부 3상태(`true`·`false`·모름). */
    confirmed: boolean | null;
    /** 확정된 날짜에만 채운다(Yahoo가 확정이라고 말한 경우). */
    session: EarningsSession | null;
    callAt: string | null;
    /** 확정되지 않은 두 날짜가 서로 다를 때만 채운다. `session`과 함께 나오지 않는다. */
    alt: { date: string; source: 'yahoo'; estimate: boolean | null } | null;
}

export interface ResolveNextEarningsInput {
    /** DB/FMP 행의 날짜. */
    scheduledDate: string | null;
    /** 행이 가진 확정 플래그(한국 행은 값이 있고, FMP 행은 `null`). */
    scheduledConfirmed: boolean | null;
    hint: AnalystEarningsHint | null;
    /** 시장 시간대의 오늘(`YYYY-MM-DD`). 날짜는 문자열 비교가 달력 비교다. */
    today: string;
}

/**
 * 규칙:
 * - 같은 날짜: Yahoo의 3상태 `isEstimate`가 확정 여부를 정한다(`false`→확정, `true`→추정, `null`→기존 값).
 *   세션·콜 시각은 Yahoo가 확정이라고 한 날짜에만 싣는다.
 * - 날짜가 다르고 Yahoo가 확정(`isEstimate === false`)이며 오늘 이후: Yahoo 날짜가 이긴다. FMP의 날짜는
 *   지난 분기에서 투영한 값이고 Yahoo의 확정일은 회사 공지에서 온다.
 * - 날짜가 다르고 둘 다 오늘 이후이며 Yahoo가 확정이 아님: 일정 행을 그대로 두고 Yahoo 날짜를 `alt`로 붙인다.
 * - 그 밖(한쪽이 이미 지남 등): 일정 행 그대로. Yahoo는 발표 후에도 지난 날짜를 둔다.
 *
 * 범위: 이 대조는 에이전트 도구와 펀더멘털 탭 사실 문장만 쓴다. 일정을 직접 읽는 다른 표면(뉴스 탭 이벤트 캘린더,
 * AI 분석의 `nextEarningsAt`)은 아직 대조 전의 DB/FMP 날짜를 보여 준다 — 대조를 `entities/earnings-report`로
 * 옮기는 것은 후속 작업이다.
 */
export function resolveNextEarnings(
    input: ResolveNextEarningsInput
): ResolvedNextEarnings {
    const { scheduledDate, scheduledConfirmed, hint, today } = input;
    const unchanged: ResolvedNextEarnings = {
        date: scheduledDate,
        confirmed: scheduledConfirmed,
        session: null,
        callAt: null,
        alt: null,
    };
    if (scheduledDate === null || hint === null) return unchanged;

    const fromHint: ResolvedNextEarnings = {
        date: hint.date,
        confirmed:
            hint.isEstimate === null ? scheduledConfirmed : !hint.isEstimate,
        session: hint.isEstimate === false ? hint.session : null,
        callAt:
            hint.isEstimate === false && hint.session !== null
                ? (hint.callAt ?? null)
                : null,
        alt: null,
    };
    if (hint.date === scheduledDate) return fromHint;
    if (hint.isEstimate === false && hint.date >= today) return fromHint;
    if (scheduledDate >= today && hint.date >= today) {
        return {
            ...unchanged,
            alt: {
                date: hint.date,
                source: 'yahoo',
                estimate: hint.isEstimate,
            },
        };
    }
    return unchanged;
}
