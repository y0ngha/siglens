/** 이 값 이하의 백분위는 극단(하위)으로 강조한다. */
export const EXTREME_PERCENTILE_LOW = 10;
/** 이 값 이상의 백분위는 극단(상위)으로 강조한다. */
export const EXTREME_PERCENTILE_HIGH = 90;

/**
 * 반올림한 백분위가 양 끝 10% 안에 드는지 — 하위 10(포함)과 상위 90(포함)을 대칭으로 본다.
 * 경계값 10과 90은 둘 다 극단이다. 화면에 찍히는 정수 백분위와 같은 값으로 판정한다.
 */
export function isExtremePercentile(roundedPercentile: number): boolean {
    return (
        roundedPercentile <= EXTREME_PERCENTILE_LOW ||
        roundedPercentile >= EXTREME_PERCENTILE_HIGH
    );
}
