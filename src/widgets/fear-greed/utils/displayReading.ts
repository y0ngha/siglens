import { scoreToLabel, type FearGreedLabel } from '@y0ngha/siglens-core';

/** 화면에 찍는 점수와, 그 점수에 대응하는 라벨. */
interface DisplayReading {
    score: number;
    label: FearGreedLabel;
}

/**
 * 원점수를 화면 표기(반올림 정수)로 바꾸고, 라벨도 **그 정수로** 다시 구한다.
 *
 * 숫자·바늘·라벨이 한 값을 가리켜야 한다. 반올림한 점수에 반올림 전 점수의 라벨을 붙이면
 * 구간 경계 근처(예: 44.6 → "45"인데 라벨은 공포)에서 숫자는 중립 구간인데 라벨은 공포로
 * 갈라진다. 구간 기준은 core(`scoreToLabel`)가 정하고 여기서는 바꾸지 않는다.
 */
export function toDisplayReading(rawScore: number): DisplayReading {
    const score = Math.round(rawScore);
    return { score, label: scoreToLabel(score) };
}
