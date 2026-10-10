/** 가이드 데모 차트의 좌표 계산 (DOM 없는 순수 함수). */

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
    const ticks: number[] = [];
    for (let value = start; value <= max + step * 1e-9; value += step) {
        ticks.push(Number(value.toFixed(10)));
    }
    return ticks;
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

export interface LabelBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** 글자 수로 라벨 폭을 어림한다 (viewBox 단위). */
export function estimateLabelWidth(text: string, fontSize: number): number {
    let units = 0;
    for (const char of text) {
        units += char.charCodeAt(0) > 0x2e80 ? 1 : 0.58;
    }
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

/**
 * 이미 놓인 라벨·장애물(봉)과 겹치지 않는 자리를 찾는다. 후보는 제자리, 한 줄씩 민 자리,
 * 겹치는 박스의 위/아래 가장자리에 딱 붙인 자리, 거기에 좌우로 조금 민 자리이고,
 * `direction`(-1 위, +1 아래) 쪽으로 덜 움직인 후보를 고른다 (좌우 이동은 세로보다 싸게 쳐서
 * 라벨이 자기 표식에서 멀리 떠나지 않게 한다). 놓은 박스는 `placed`에 쌓이고 최종 박스를 돌려준다.
 * `obstacles`는 쌓이지 않는 고정 장애물(봉의 몸통·꼬리)이다.
 */
export function placeLabel(
    placed: LabelBox[],
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
    const ys = new Set<number>([start.y]);
    for (let step = 1; step <= MAX_ROW_STEPS; step++) {
        ys.add(start.y + step * stride);
        ys.add(start.y - step * stride);
    }
    for (const other of blockers) {
        ys.add(other.y - start.height - EDGE_GAP);
        ys.add(other.y + other.height + EDGE_GAP);
    }
    const dxs = [0];
    for (let step = 1; step <= MAX_SHIFT_STEPS; step++) {
        dxs.push(step * SHIFT_STRIDE, -step * SHIFT_STRIDE);
    }
    const minX = bounds.left ?? -Infinity;
    const maxX = bounds.right ?? Infinity;
    let best: LabelBox | null = null;
    let bestCost = Infinity;
    for (const dx of dxs) {
        const x = start.x + dx;
        if (x < minX || x + start.width > maxX) continue;
        for (const y of ys) {
            if (y < bounds.top || y + start.height > bounds.bottom) continue;
            const delta = y - start.y;
            const cost =
                (delta * direction > 0
                    ? Math.abs(delta)
                    : Math.abs(delta) * AGAINST_DIRECTION_PENALTY) +
                Math.abs(dx) * SHIFT_WEIGHT;
            if (cost >= bestCost) continue;
            const candidate = { ...start, x, y };
            if (blockers.some(other => overlaps(candidate, other))) continue;
            best = candidate;
            bestCost = cost;
        }
    }
    const result = best ?? start;
    placed.push(result);
    return result;
}

/** 큰 수를 K/M/B로 줄인다 (패널 눈금 라벨 폭 절약). */
export function formatCompact(value: number): string {
    const abs = Math.abs(value);
    if (abs >= 1e9) return `${(value / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
    if (abs >= 1e6) return `${(value / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
    if (abs >= 1e4) return `${(value / 1e3).toFixed(0)}K`;
    return String(Math.round(value));
}

/** null을 건너뛰어 끊어진 구간별 점 목록으로 나눈다 (선을 이을 때 null에서 끊는다). */
export function splitRuns(
    values: readonly (number | null)[],
    xOf: (index: number) => number,
    yOf: (value: number) => number
): { x: number; y: number }[][] {
    const runs: { x: number; y: number }[][] = [];
    let current: { x: number; y: number }[] = [];
    values.forEach((value, index) => {
        if (value === null || !Number.isFinite(value)) {
            if (current.length > 0) runs.push(current);
            current = [];
            return;
        }
        current.push({ x: xOf(index), y: yOf(value) });
    });
    if (current.length > 0) runs.push(current);
    return runs;
}

export function toPoints(points: readonly { x: number; y: number }[]): string {
    return points
        .map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
        .join(' ');
}
