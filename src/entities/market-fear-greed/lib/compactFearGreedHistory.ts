import type { FearGreedReading } from '@y0ngha/siglens-core';

/**
 * 허브가 캐시에 싣는 형태로 walk-forward 이력을 줄인다.
 *
 * 앞쪽 워밍업 구간(`score === null`)만 잘라 낸다. 중간의 빈 날은 남긴다: core의 극단 구간
 * 판정(`zoneEntryIndices`)은 "라벨이 있는 직전 세션"이 있어야 진입으로 세므로, 앞쪽 null을
 * 없애도 에피소드는 바뀌지 않지만 중간 null을 없애면 끊김이 사라져 에피소드가 달라진다.
 *
 * 점수는 화면(히어로·제목·JSON-LD)과 같은 정수로 반올림한다. 소수를 그대로 두면 마지막 행이
 * x.495~x.5에서 히어로와 다른 숫자를 말할 수 있다. 라벨은 core가 반올림 전 점수로 매긴 값을
 * 그대로 둔다 — 구간 경계를 다시 계산하지 않는다.
 */
export function compactFearGreedHistory(
    history: readonly FearGreedReading[]
): FearGreedReading[] {
    const firstScored = history.findIndex(point => point.score !== null);
    if (firstScored === -1) return [];
    return history.slice(firstScored).map(({ date, score, label }) => ({
        date,
        score: score === null ? null : Math.round(score),
        label,
    }));
}
