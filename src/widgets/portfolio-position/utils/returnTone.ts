/**
 * 손익 부호 → 색 토큰. 이 위젯의 모든 손익 표시(빌딩 리드아웃·마커, 보유 카드, 내 위치 카드, 포지션
 * 요약의 평가손익·수익률)가 같은 규칙을 쓴다 — 정확히 0은 이익도 손실도 아니라 중립색이다
 * (`signColorClass`는 0을 이익색으로 칠한다).
 */

/** 수익률의 부호. */
export type ReturnSign = 'gain' | 'loss' | 'flat';

/** 수익률 부호를 판정한다. */
export function returnSign(returnPct: number): ReturnSign {
    if (returnPct > 0) return 'gain';
    if (returnPct < 0) return 'loss';
    return 'flat';
}

const RETURN_TEXT_CLASS: Record<ReturnSign, string> = {
    gain: 'text-ui-success-text',
    loss: 'text-ui-danger-text',
    flat: 'text-secondary-400',
};

/** 손익 글자 색 — 리드아웃과 카드의 평가손익·수익률 칸. */
export function returnTextClass(returnPct: number): string {
    return RETURN_TEXT_CLASS[returnSign(returnPct)];
}

const MARKER_CLASS: Record<ReturnSign, string> = {
    gain: 'text-ui-success-text',
    loss: 'text-ui-danger-text',
    flat: 'text-secondary-100',
};

/**
 * ●현재가 마커 색. 평단이 없으면 수익/손실이 정의되지 않으므로 0%와 같은 중립색을 쓴다 —
 * 색이 의미를 가진 척하지 않는다. 마커는 어두운 건물 위에 놓여 중립색이 리드아웃보다 밝다.
 */
export function currentMarkerClass(returnPct: number, hasAvg: boolean): string {
    return MARKER_CLASS[hasAvg ? returnSign(returnPct) : 'flat'];
}
