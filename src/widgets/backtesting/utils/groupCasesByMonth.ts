import type { BacktestCase } from '@y0ngha/siglens-core';

/** `YYYY-MM-DD`에서 월 키(`YYYY-MM`)가 되는 앞부분 길이. */
export const MONTH_KEY_LENGTH = 7;

export interface CaseMonthGroup {
    /** `YYYY-MM` — 그룹 식별자이자 React key. */
    key: string;
    items: BacktestCase[];
    /** 이 월에 케이스가 있는 종목별 건수(첫 등장 순). 종목 탭의 월 건수 표시에 쓴다. */
    countByTicker: ReadonlyMap<string, number>;
}

const MONTH_KEY_PATTERN = /^(\d{4})-(\d{2})$/;

/**
 * 월 키(`YYYY-MM`)를 표시용 연·월 조각으로 쪼갠다. 월은 숫자(1~12)다.
 * 형식이 틀린 키는 던진다 — 그룹 키는 `groupCasesByMonth`가 만들므로 틀리면 데이터 결함이다.
 */
export function splitMonthKey(monthKey: string): {
    year: string;
    month: number;
} {
    const match = MONTH_KEY_PATTERN.exec(monthKey);
    if (match === null) throw new Error(`Invalid month key: ${monthKey}`);
    return { year: match[1], month: Number.parseInt(match[2], 10) };
}

/**
 * 케이스를 진입일 기준 최신 월 → 오래된 월 순의 월 그룹으로 묶는다. 같은 진입일끼리는
 * 입력 순서를 지킨다(`toSorted`는 안정 정렬). 입력 배열은 변형하지 않는다.
 */
export function groupCasesByMonth(
    cases: readonly BacktestCase[]
): CaseMonthGroup[] {
    const newestFirst = cases.toSorted((a, b) =>
        b.entryDate.localeCompare(a.entryDate)
    );
    // `Map.groupBy`는 첫 등장 순을 지키고 입력이 이미 최신순이라 그룹도 최신 월이 먼저다.
    const byMonth = Map.groupBy(newestFirst, c =>
        c.entryDate.slice(0, MONTH_KEY_LENGTH)
    );
    return Array.from(byMonth, ([key, items]) => ({
        key,
        items,
        countByTicker: new Map(
            Array.from(
                Map.groupBy(items, c => c.ticker),
                ([ticker, tickerItems]) => [ticker, tickerItems.length]
            )
        ),
    }));
}
