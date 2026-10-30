import type { OverallAxis } from '@y0ngha/siglens-core';

/**
 * 서버가 재분석 쿨다운을 못 잡아 새 분석을 거절한 경우. 일반 에러와 구분하는 이유는
 * 직전 결과를 지우지 않고 안내만 덧붙이기 위해서다 — 재분석을 눌렀다는 이유로 보고
 * 있던 분석을 잃으면 안 된다(`useAnalysis`도 같은 계약을 따른다).
 */
export class OverallCooldownError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'OverallCooldownError';
    }
}

/**
 * 분석 실패를 axis와 함께 나른다. 게이트 오류·한도 오류처럼 axis가 없는 실패는
 * `axis`가 `undefined`다.
 */
export class OverallAnalysisError extends Error {
    constructor(
        message: string,
        public readonly axis?: OverallAxis
    ) {
        super(message);
        this.name = 'OverallAnalysisError';
    }
}
