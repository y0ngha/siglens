import { compareIsoDate } from './investorFlowsDates';

/** 정렬에 필요한 최소 필드 — 같은 필러의 제출 순서를 정한다. */
interface CikFiling {
    cik: string;
    filingDate: string;
    accession: string;
}

/** 코드 유닛 순서 3분기 비교(-1/0/1) — `localeCompare`와 달리 `-`·숫자 순서가 로케일에 따라 바뀌지 않는다. */
function compareCodeUnits(a: string, b: string): number {
    return Number(a > b) - Number(a < b);
}

/**
 * 같은 필러(cik)의 제출을 한 그룹으로 묶고 그룹 안은 제출일 → accession 오름차순으로 정렬한다. 정정 규칙이 순서에 의존해
 * 그룹 안은 직렬로 처리해야 하고 그룹끼리만 병렬이다. 그룹 순서는 입력에서 cik가 처음 나온 순서.
 */
export function groupFilingsByCik<T extends CikFiling>(
    targets: readonly T[]
): T[][] {
    const groups = Map.groupBy(targets, target => target.cik);
    return [...groups.values()].map(group =>
        group.toSorted(
            (a, b) =>
                compareIsoDate(a.filingDate, b.filingDate) ||
                compareCodeUnits(a.accession, b.accession)
        )
    );
}
