/** 미니 차트 viewBox 폭 — `Sparkline`이 같은 값으로 viewBox를 잡는다. */
export const SPARKLINE_WIDTH = 64;
/** 미니 차트 viewBox 높이 — 폭과 함께 `Sparkline`의 종횡비(64:24)를 정한다. */
export const SPARKLINE_HEIGHT = 24;
/** 선이 위아래 가장자리에 붙어 잘리지 않게 두는 여백(viewBox 단위). */
const PAD = 2;
/** 값이 모두 같을 때(변동 0) 선을 그릴 높이 비율 — 가운데 수평선. */
const FLAT_RATIO = 0.5;

/** `values`를 viewBox 좌표의 polyline `points`로 바꾼다. 값이 모두 같으면 가운데 수평선이다. */
export function sparklinePoints(values: readonly number[]): string {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const step = SPARKLINE_WIDTH / (values.length - 1);
    return values
        .map((value, index) => {
            const ratio = range === 0 ? FLAT_RATIO : (value - min) / range;
            const y =
                SPARKLINE_HEIGHT - PAD - ratio * (SPARKLINE_HEIGHT - PAD * 2);
            return `${(index * step).toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
}
