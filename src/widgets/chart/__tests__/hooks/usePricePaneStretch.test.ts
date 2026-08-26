// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import {
    MIN_PRICE_PANE_STRETCH,
    MIN_SUB_PANE_PX,
    usePricePaneStretch,
} from '@/widgets/chart/hooks/usePricePaneStretch';
import type { PaneIndices } from '@/widgets/chart/types';

vi.mock('lightweight-charts', () => ({}));

const PANE_INDICES = {} as PaneIndices;

/**
 * 감사가 실측한 모바일 기하: 246px 차트에서 pane들이 실제로 나눠 갖는 예산은
 * 시간축(~26px)과 구분선을 뺀 214px이다(보조 pane 6개 실측 개당 ~18px,
 * 변경 전 ~26px과 일치한다). `getHeight()` 합이 곧 이 값이다.
 */
const MOBILE_PANE_BUDGET_PX = 214;

/** 데스크톱 — 픽셀 상한이 걸리지 않을 만큼 여유 있는 높이. */
const DESKTOP_PANE_BUDGET_PX = 600;

/**
 * LWC의 높이 분배를 그대로 재현한다: `ChartWidget._adjustSizeImpl`이
 * `stretchFactor × (전체높이 / stretch합)`을 쓰고 하한은 2px이다.
 *
 * 훅이 stretch를 **어떻게 고르는지**는 여기 없다 — 라이브러리가 그 결과를
 * 어떻게 픽셀로 바꾸는지만 있다. 예전 테스트는 `S / (S + 보조개수)`로 몫을
 * 되풀이 계산했는데, 그건 "보조 pane은 전부 1"이라는 가정을 테스트 안에
 * 복사한 것이라 바로 그 가정이 깨지는 드래그 케이스를 잡을 수 없었다.
 */
function distribute(stretches: number[], totalHeightPx: number): number[] {
    const totalStretch = stretches.reduce((sum, value) => sum + value, 0);
    return stretches.map(stretch =>
        Math.max(2, (stretch * totalHeightPx) / totalStretch)
    );
}

function makeChart(stretches: number[], totalHeightPx: number) {
    const heights = distribute(stretches, totalHeightPx);
    const setStretchFactor = vi.fn();
    const panes = stretches.map((stretch, index) => ({
        getStretchFactor: () => stretch,
        getHeight: () => heights[index],
        setStretchFactor: index === 0 ? setStretchFactor : vi.fn(),
    }));
    return { chart: { panes: () => panes }, setStretchFactor };
}

function makeChartRef(chart: unknown) {
    return { current: chart } as Parameters<typeof usePricePaneStretch>[0];
}

async function flushFrame(): Promise<void> {
    await act(
        async () =>
            new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    );
}

/** 훅을 돌리고 pane 0에 실제로 적용된 stretch를 돌려준다. 미호출이면 null. */
async function applyStretch(
    stretches: number[],
    totalHeightPx = MOBILE_PANE_BUDGET_PX
): Promise<number | null> {
    const { chart, setStretchFactor } = makeChart(stretches, totalHeightPx);
    renderHook(() => usePricePaneStretch(makeChartRef(chart), PANE_INDICES));
    await flushFrame();

    if (setStretchFactor.mock.calls.length === 0) return null;
    return setStretchFactor.mock.calls[0][0] as number;
}

/** 훅 적용 후 LWC가 실제로 그리게 될 pane 높이들. */
async function resultingHeights(
    stretches: number[],
    totalHeightPx = MOBILE_PANE_BUDGET_PX
): Promise<number[]> {
    const applied = await applyStretch(stretches, totalHeightPx);
    const next =
        applied === null ? stretches : [applied, ...stretches.slice(1)];
    return distribute(next, totalHeightPx);
}

/** 보조 pane이 전부 기본값 1인, N개짜리 배치. */
function uniform(subPaneCount: number): number[] {
    return [MIN_PRICE_PANE_STRETCH, ...Array<number>(subPaneCount).fill(1)];
}

function sum(values: number[]): number {
    return values.reduce((total, value) => total + value, 0);
}

/** 부동소수 비교용 여유. */
const EPSILON = 1e-9;

describe('usePricePaneStretch', () => {
    it('차트가 없으면 아무것도 하지 않는다', async () => {
        renderHook(() => usePricePaneStretch(makeChartRef(null), PANE_INDICES));

        await expect(flushFrame()).resolves.toBeUndefined();
    });

    it('pane이 하나도 없으면 아무것도 하지 않는다', async () => {
        expect(await applyStretch([])).toBeNull();
    });

    it('보조 pane이 없으면 LWC 기본값(2)을 유지한다', async () => {
        expect(await applyStretch([MIN_PRICE_PANE_STRETCH])).toBe(
            MIN_PRICE_PANE_STRETCH
        );
    });

    it('보조 pane 3개에서 가격 pane이 절반을 받는다', async () => {
        // 감사 실측: 246px 차트에서 86px(=40%)이었다.
        const heights = await resultingHeights(uniform(3));

        expect(heights[0] / sum(heights)).toBeGreaterThanOrEqual(0.5 - EPSILON);
    });

    /**
     * 구분선을 끌면 LWC가 끌린 두 pane에 **절대값** stretch를 써 넣는다.
     * 보조 pane이 전부 1이라고 가정한 개수 기반 계산(`max(2, N)`)은 여기서
     * 40%로 떨어졌다(브라우저 실측 44%).
     */
    it('구분선을 끌어 보조 pane이 비균등해져도 절반을 지킨다', async () => {
        // pane 0을 0.5로, pane 1을 2.5로 끈 뒤 지표를 둘 더 켠 상태.
        const dragged = [0.5, 2.5, 1, 1];

        for (const budget of [MOBILE_PANE_BUDGET_PX, DESKTOP_PANE_BUDGET_PX]) {
            const heights = await resultingHeights(dragged, budget);
            expect(heights[0] / sum(heights)).toBeGreaterThanOrEqual(
                0.5 - EPSILON
            );
        }
    });

    it('여유가 있으면 가격 pane 몫이 절반 아래로 내려가지 않는다', async () => {
        // 데스크톱 600px에서는 보조 pane 3개까지 개당 최소 높이가 넉넉하다.
        for (let subPanes = 1; subPanes <= 3; subPanes += 1) {
            const heights = await resultingHeights(
                uniform(subPanes),
                DESKTOP_PANE_BUDGET_PX
            );
            expect(heights[0] / sum(heights)).toBeGreaterThanOrEqual(
                0.5 - EPSILON
            );
        }
    });

    /**
     * 실제 보장: 보조 pane 높이 합은 `N × MIN_SUB_PANE_PX`와 LWC 기본 배치에서의
     * 높이 합 중 **작은 쪽** 아래로 내려가지 않는다. 앞의 절반 보장만 두면
     * 보조 pane 몫이 `1/(2+N)`에서 `1/(2N)`로 줄어드는데, 차트 상자가
     * 고정 `flex-3`이라 그 손실이 그대로 픽셀 손실이 된다.
     */
    it('보조 pane 예산은 최소 높이나 기본 배치 중 작은 쪽을 지킨다', async () => {
        const budgets = [MOBILE_PANE_BUDGET_PX, DESKTOP_PANE_BUDGET_PX, 120];

        for (const budget of budgets) {
            for (let subPanes = 1; subPanes <= 8; subPanes += 1) {
                const stretches = uniform(subPanes);
                const heights = await resultingHeights(stretches, budget);
                const defaultHeights = distribute(stretches, budget);

                const floorPx = Math.min(
                    sum(defaultHeights.slice(1)),
                    subPanes * MIN_SUB_PANE_PX
                );

                expect(sum(heights.slice(1))).toBeGreaterThanOrEqual(
                    floorPx - EPSILON
                );
            }
        }
    });

    /**
     * 감사가 지목한 회귀 구간: 246px 모바일에서 보조 pane이 6개를 넘으면
     * 개당 최소 높이를 지킬 여유가 아예 없다. 그럴 때는 가격 pane이 물러나
     * 변경 전 배치(`1/(2+N)`)를 그대로 유지해야 한다 — 개당 26px이 18px로
     * 내려앉던 게 이 구간이다.
     *
     * (데스크톱처럼 여유가 있는 높이에서는 이 부등식이 성립하지 않는 게
     * 정상이다. 보조 pane이 30px을 넘기고도 남으므로 남는 몫을 가격 pane에
     * 주는 것이 의도된 동작이다.)
     */
    it('모바일에서 보조 pane이 많으면 변경 전 배치보다 나빠지지 않는다', async () => {
        for (let subPanes = 6; subPanes <= 10; subPanes += 1) {
            const heights = await resultingHeights(uniform(subPanes));
            const total = sum(heights);

            for (const subHeight of heights.slice(1)) {
                expect(subHeight / total).toBeGreaterThanOrEqual(
                    1 / (2 + subPanes) - EPSILON
                );
            }
        }
    });

    it('가격 pane stretch는 LWC 기본값 아래로 내려가지 않는다', async () => {
        // 예산이 아무리 좁아도 가격 pane을 기본 배치보다 더 줄이지는 않는다.
        for (let subPanes = 1; subPanes <= 10; subPanes += 1) {
            expect(await applyStretch(uniform(subPanes), 40)).toBe(
                MIN_PRICE_PANE_STRETCH
            );
        }
    });
});
