/** 가이드 데모 차트의 좌표 계산 (DOM 없는 순수 함수). */

/** 값 → 화면 좌표 변환 함수. 범위 밖 값도 자르지 않고 그대로 옮기므로, 영역을 벗어났는지는 호출부가 판정한다. */
export interface LinearScale {
    (value: number): number;
}

/** 값 범위 [d0, d1]을 화면 구간 [r0, r1]에 선형으로 옮기는 함수를 만든다. */
export function linearScale(
    d0: number,
    d1: number,
    r0: number,
    r1: number
): LinearScale {
    const span = d1 - d0;
    if (span === 0) return () => (r0 + r1) / 2;
    return value => r0 + ((value - d0) / span) * (r1 - r0);
}

/** 1, 2, 5 × 10^n 단계로 눈금 간격을 고른다. */
export function niceStep(rawStep: number): number {
    const exponent = Math.floor(Math.log10(rawStep));
    const base = 10 ** exponent;
    const fraction = rawStep / base;
    if (fraction <= 1) return base;
    if (fraction <= 2) return 2 * base;
    if (fraction <= 5) return 5 * base;
    return 10 * base;
}

/** [min, max] 안에 들어가는 눈금 값을 대략 `target`개 만든다. */
export function niceTicks(min: number, max: number, target: number): number[] {
    if (!(max > min)) return [min];
    const step = niceStep((max - min) / Math.max(1, target));
    const start = Math.ceil(min / step) * step;
    // 부동소수 오차로 `max` 바로 위에 떨어진 마지막 눈금도 포함한다.
    const count = Math.floor((max + step * 1e-9 - start) / step) + 1;
    return Array.from({ length: Math.max(0, count) }, (_, index) =>
        Number((start + index * step).toFixed(10))
    );
}

/** 눈금 간격에 맞는 소수 자릿수로 가격 라벨을 만든다. */
export function formatTick(value: number, step: number): string {
    const decimals = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step)));
    return value.toFixed(decimals);
}

/** 눈금 배열의 간격(없으면 1). */
export function tickStep(ticks: readonly number[]): number {
    return ticks.length > 1 ? ticks[1] - ticks[0] : 1;
}

/** 라벨이 차지하는 사각형 (viewBox 단위). */
export interface LabelBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** 글자 수로 라벨 폭을 어림한다 (viewBox 단위). */
export function estimateLabelWidth(text: string, fontSize: number): number {
    const units = [...text].reduce(
        (sum, char) => sum + (char.charCodeAt(0) > 0x2e80 ? 1 : 0.58),
        0
    );
    return units * fontSize + 4;
}

function overlaps(a: LabelBox, b: LabelBox): boolean {
    return (
        a.x < b.x + b.width &&
        b.x < a.x + a.width &&
        a.y < b.y + b.height &&
        b.y < a.y + a.height
    );
}

const MAX_SHIFT_STEPS = 10;
const SHIFT_STRIDE = 6;
const SHIFT_WEIGHT = 0.7;
/** 제자리 기준으로 위아래 몇 줄까지 후보로 삼을지. */
const MAX_ROW_STEPS = 12;
/** `direction` 반대쪽으로 움직이는 후보에 곱하는 비용 가중치 (선호 방향을 우선한다). */
const AGAINST_DIRECTION_PENALTY = 1.4;
/** 겹치는 박스 가장자리에 붙일 때 남기는 틈(viewBox 단위). */
const EDGE_GAP = 1;

/** 1부터 `max`까지의 정수. 제자리에서 몇 칸 민 후보를 위·아래(좌·우) 양쪽으로 펼칠 때 쓴다. */
function stepsUpTo(max: number): number[] {
    return Array.from({ length: max }, (_, index) => index + 1);
}

/**
 * 이미 놓인 라벨·장애물(봉)과 겹치지 않는 자리를 찾는다. 후보는 제자리, 한 줄씩 민 자리,
 * 겹치는 박스의 위/아래 가장자리에 딱 붙인 자리, 거기에 좌우로 조금 민 자리이고,
 * `direction`(-1 위, +1 아래) 쪽으로 덜 움직인 후보를 고른다 (좌우 이동은 세로보다 싸게 쳐서
 * 라벨이 자기 표식에서 멀리 떠나지 않게 한다). 최종 박스를 돌려줄 뿐 `placed`를 바꾸지 않는다 —
 * 다음 라벨을 놓을 때 호출부가 결과를 `placed`에 더해 넘긴다.
 * `obstacles`는 쌓이지 않는 고정 장애물(봉의 몸통·꼬리)이다.
 */
export function placeLabel(
    placed: readonly LabelBox[],
    box: LabelBox,
    direction: -1 | 1,
    bounds: { top: number; bottom: number; left?: number; right?: number },
    obstacles: readonly LabelBox[] = []
): LabelBox {
    const clampY = (candidate: LabelBox): LabelBox => ({
        ...candidate,
        y: Math.min(
            Math.max(candidate.y, bounds.top),
            bounds.bottom - candidate.height
        ),
    });
    const start = clampY(box);
    const stride = box.height + EDGE_GAP;
    const reach = SHIFT_STRIDE * MAX_SHIFT_STEPS;
    const blockers = [...placed, ...obstacles].filter(
        other =>
            other.x < start.x + start.width + reach &&
            start.x - reach < other.x + other.width
    );
    const ys = new Set<number>([
        start.y,
        ...stepsUpTo(MAX_ROW_STEPS).flatMap(step => [
            start.y + step * stride,
            start.y - step * stride,
        ]),
        ...blockers.flatMap(other => [
            other.y - start.height - EDGE_GAP,
            other.y + other.height + EDGE_GAP,
        ]),
    ]);
    const dxs = [
        0,
        ...stepsUpTo(MAX_SHIFT_STEPS).flatMap(step => [
            step * SHIFT_STRIDE,
            -step * SHIFT_STRIDE,
        ]),
    ];
    const minX = bounds.left ?? -Infinity;
    const maxX = bounds.right ?? Infinity;
    const cost = (candidate: LabelBox): number => {
        const delta = candidate.y - start.y;
        const vertical =
            delta * direction > 0
                ? Math.abs(delta)
                : Math.abs(delta) * AGAINST_DIRECTION_PENALTY;
        return vertical + Math.abs(candidate.x - start.x) * SHIFT_WEIGHT;
    };
    // 후보는 dx 바깥·y 안쪽 순서로 나열하고, 비용이 같으면 먼저 나온 후보를 유지한다.
    const best = dxs
        .flatMap(dx => [...ys].map(y => ({ ...start, x: start.x + dx, y })))
        .filter(
            c =>
                c.x >= minX &&
                c.x + c.width <= maxX &&
                c.y >= bounds.top &&
                c.y + c.height <= bounds.bottom &&
                !blockers.some(other => overlaps(c, other))
        )
        .reduce<LabelBox | null>(
            (acc, c) => (acc === null || cost(c) < cost(acc) ? c : acc),
            null
        );
    return best ?? start;
}

/** 큰 수를 K/M/B로 줄인다 (패널 눈금 라벨 폭 절약). */
export function formatCompact(value: number): string {
    const abs = Math.abs(value);
    if (abs >= 1e9) return `${(value / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
    if (abs >= 1e6) return `${(value / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
    if (abs >= 1e4) return `${(value / 1e3).toFixed(0)}K`;
    return String(Math.round(value));
}

/** 화면 좌표(viewBox 단위)의 한 점. `splitRuns`가 내고 `toPoints`가 SVG `points` 문자열로 바꾼다. */
export interface ChartPoint {
    readonly x: number;
    readonly y: number;
}

/** null을 건너뛰어 끊어진 구간별 점 목록으로 나눈다 (선을 이을 때 null에서 끊는다). */
export function splitRuns(
    values: readonly (number | null)[],
    xOf: (index: number) => number,
    yOf: (value: number) => number
): ChartPoint[][] {
    // 끊김(null·비유한값)을 만나면 진행 중이던 구간을 닫는다.
    const { done, current } = values.reduce<{
        done: ChartPoint[][];
        current: ChartPoint[];
    }>(
        (acc, value, index) =>
            value === null || !Number.isFinite(value)
                ? { done: closeRun(acc.done, acc.current), current: [] }
                : {
                      done: acc.done,
                      current: [
                          ...acc.current,
                          { x: xOf(index), y: yOf(value) },
                      ],
                  },
        { done: [], current: [] }
    );
    return closeRun(done, current);
}

function closeRun(done: ChartPoint[][], current: ChartPoint[]): ChartPoint[][] {
    return current.length > 0 ? [...done, current] : done;
}

/** 점 목록 → SVG `points` 속성 문자열(소수 한 자리). */
export function toPoints(points: readonly ChartPoint[]): string {
    return points
        .map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
        .join(' ');
}
