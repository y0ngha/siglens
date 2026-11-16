/**
 * 애널리스트 의견 목록의 한 행. 출처가 둘이다 — 미국 종목은 Yahoo 변경 이력(등급 + 목표가), 그 밖이나 Yahoo를 못
 * 읽었을 때는 기존 등급 이벤트(FMP·한국 프로바이더, 목표가 없음). 두 출처를 한 모양으로 맞춰 행 UI는 하나만 둔다.
 */
import type { GradesAction, GradesEvent } from '@y0ngha/siglens-core';
import type {
    AnalystAction,
    AnalystActionKind,
    AnalystTargetAction,
} from '@/entities/analyst-views/model';

export interface AnalystActionItem {
    /** `YYYY-MM-DD`. */
    date: string;
    firm: string;
    action: GradesAction;
    previousGrade: string | null;
    newGrade: string;
    /** 목표가 변화. 출처가 목표가를 주지 않으면(등급 이벤트) `null`. */
    target: {
        prior: number | null;
        current: number;
        direction: AnalystTargetAction | null;
    } | null;
}

const ACTION_OF: Record<AnalystActionKind, GradesAction> = {
    upgrade: 'upgrade',
    downgrade: 'downgrade',
    maintain: 'maintained',
    reiterate: 'maintained',
    initiate: 'initiated',
};

/** Yahoo가 방향을 주지 않으면 이전·현재 값으로 정한다. 이전 값이 없으면 방향을 말하지 않는다. */
function inferDirection(
    prior: number | null,
    current: number
): AnalystTargetAction | null {
    if (prior === null) return null;
    if (current > prior) return 'raise';
    if (current < prior) return 'lower';
    return 'maintain';
}

export function fromGradesEvent(event: GradesEvent): AnalystActionItem {
    return {
        date: event.date,
        firm: event.gradingCompany,
        action: event.action,
        previousGrade: event.previousGrade,
        newGrade: event.newGrade,
        target: null,
    };
}

/**
 * Yahoo 이력 한 행. 새 등급이 비면 이전 등급을 쓰고(등급 유지), 둘 다 없는 행은 그릴 등급이 없어 버린다.
 * 이전 등급이 새 등급과 같으면 "A → A"가 되지 않게 이전 등급을 비운다.
 */
export function fromAnalystAction(
    row: AnalystAction
): AnalystActionItem | null {
    const newGrade = row.toGrade ?? row.fromGrade;
    if (newGrade === null) return null;
    return {
        date: row.date,
        firm: row.firm,
        action: ACTION_OF[row.action],
        previousGrade:
            row.fromGrade !== null && row.fromGrade !== newGrade
                ? row.fromGrade
                : null,
        newGrade,
        target:
            row.target === null
                ? null
                : {
                      prior: row.priorTarget,
                      current: row.target,
                      direction:
                          row.targetAction ??
                          inferDirection(row.priorTarget, row.target),
                  },
    };
}
