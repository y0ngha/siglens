import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import { zonedDate } from '@/shared/lib/marketSessionDate';
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
 * 범위: 다음 실적일을 말하는 모든 표면이 이 대조를 쓴다 — 에이전트 `get_fundamentals`, 펀더멘털 탭 사실 문장,
 * 뉴스 탭 실적 카드, AI 분석(뉴스·종합)의 다음 실적(`getNextEarningsReport`). 사실 문장·뉴스 탭·AI 분석은 힌트를
 * `loadEarningsHintBounded`(같은 12h 캐시 엔트리)에서 읽고, 에이전트 도구는 자기 호출의 `getAnalystViews` lite 결과를
 * 그대로 쓴다(판정 함수만 같다).
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

/**
 * 그 종목 시장의 오늘(`YYYY-MM-DD`) — 실적일이 시장 달력 날짜라서다. 한국은 KST, 그 외는 미국 동부.
 * `resolveNextEarnings`의 `today`로 넘긴다.
 */
export function earningsMarketToday(symbol: string, now: Date): string {
    return zonedDate(
        now,
        isKrEquitySymbol(symbol) ? 'Asia/Seoul' : 'America/New_York'
    );
}
