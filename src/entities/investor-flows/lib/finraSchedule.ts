import { addDays, eachDate, isWeekend } from './investorFlowsDates';

/** 일별 거래량 파일을 찾아볼 날짜들 — `after`(제외) 다음 날부터 `today`(포함)까지의 평일, 오름차순. */
export function shortVolumeCandidateDates(
    after: string,
    today: string
): string[] {
    return eachDate(addDays(after, 1), today).filter(date => !isWeekend(date));
}

/** `date` 이하에서 가장 가까운 평일. */
function onOrBeforeWeekday(date: string): string {
    let d = date;
    while (isWeekend(d)) d = addDays(d, -1);
    return d;
}

function lastDayOfMonth(year: number, month: number): string {
    return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

/**
 * 공매도 잔고 결제일 후보. FINRA는 매월 15일과 말일(주말이면 앞선 영업일)을 결제일로 쓴다.
 * 공휴일은 알 수 없어서, 각 후보를 **앞선 평일 몇 개까지** 변형으로 함께 돌려준다 — 호출부는
 * 변형을 순서대로 받아 보다가 처음 있는 파일을 그 결제일로 쓴다.
 *
 * @param lookbackDays 오늘로부터 거슬러 올라갈 일수
 * @returns 결제일(오름차순)마다 `[기본, 하루 전, …]` 변형 목록
 */
export function shortInterestCandidateGroups(
    today: string,
    lookbackDays: number,
    variants = 4
): string[][] {
    const from = addDays(today, -lookbackDays);
    const settlements = new Set<string>();
    const [fromYear, fromMonth] = [
        Number(from.slice(0, 4)),
        Number(from.slice(5, 7)),
    ];
    const [toYear, toMonth] = [
        Number(today.slice(0, 4)),
        Number(today.slice(5, 7)),
    ];
    for (
        let y = fromYear, m = fromMonth;
        y < toYear || (y === toYear && m <= toMonth);
    ) {
        for (const nominal of [
            `${y}-${String(m).padStart(2, '0')}-15`,
            lastDayOfMonth(y, m),
        ]) {
            const settlement = onOrBeforeWeekday(nominal);
            if (settlement >= from && settlement <= today) {
                settlements.add(settlement);
            }
        }
        if (m === 12) {
            y += 1;
            m = 1;
        } else {
            m += 1;
        }
    }
    return [...settlements].sort().map(settlement => {
        const group = [settlement];
        let d = settlement;
        while (group.length < variants) {
            d = onOrBeforeWeekday(addDays(d, -1));
            group.push(d);
        }
        return group;
    });
}
