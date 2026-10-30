/**
 * 점수표 축 카드가 한 줄씩 보여 주는 근거 한 줄의 타입과, 조건부 줄을 걸러 내는 도우미.
 */

/** 점수표 카드가 축마다 보여 주는 근거 한 줄 — 카탈로그 키(`widgets.investor-flows.ev.<id>`)와 보간 값이다. */
export interface AxisEvidenceLine {
    id: string;
    values: Record<string, string>;
}

/** 조건을 못 채운 줄(`null`)을 빼고 남은 줄만 순서대로 돌려준다 — 줄마다 "있을 때만" 조건을 선언적으로 적기 위한 도우미. */
export function presentLines(
    lines: readonly (AxisEvidenceLine | null)[]
): AxisEvidenceLine[] {
    return lines.filter((line): line is AxisEvidenceLine => line !== null);
}
