// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import { THEME_ATTRIBUTE } from '@/shared/lib/theme';
import type { PaneLabelConfig } from '../../types';
import { usePaneLabels } from '../../hooks/usePaneLabels';

vi.mock('lightweight-charts', () => ({}));

const mockObserve = vi.fn();
const mockDisconnect = vi.fn();
/** 관찰 콜백. 테스트가 직접 때려 pane 재분배를 흉내낸다. */
let notify: (() => void) | null = null;

class MockResizeObserver {
    constructor(callback: () => void) {
        notify = callback;
    }
    observe = mockObserve;
    unobserve = vi.fn();
    disconnect = mockDisconnect;
}

vi.stubGlobal('ResizeObserver', MockResizeObserver);

afterAll(() => {
    vi.unstubAllGlobals();
});

function makeChartRef(chart: unknown = null) {
    return { current: chart } as Parameters<
        typeof usePaneLabels
    >[0]['chartRef'];
}

function makeContainerRef(container: HTMLDivElement | null = null) {
    return { current: container } as Parameters<
        typeof usePaneLabels
    >[0]['containerRef'];
}

/** pane 높이를 도중에 갈아끼울 수 있는 목 — pane 재분배를 흉내내기 위한 것. */
function makeChart(initialHeights: number[] = [200, 100]) {
    let heights = initialHeights;
    return {
        panes: vi.fn(() =>
            heights.map(height => ({ getHeight: () => height }))
        ),
        setHeights: (next: number[]): void => {
            heights = next;
        },
    };
}

async function flushFrame(): Promise<void> {
    await act(
        async () =>
            new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    );
}

/** jsdom은 색을 `rgb(...)`로 정규화한다. 같은 정규화를 거친 값끼리 비교한다. */
function asComputedColor(color: string): string {
    const probe = document.createElement('div');
    probe.style.backgroundColor = color;
    return probe.style.backgroundColor;
}

function renderLabels(
    chart: unknown,
    container: HTMLDivElement,
    labels: PaneLabelConfig[] = LABELS
) {
    return renderHook(() =>
        usePaneLabels({
            chartRef: makeChartRef(chart),
            containerRef: makeContainerRef(container),
            labels,
        })
    );
}

function labelIn(container: HTMLDivElement): HTMLDivElement {
    const el = container.querySelector<HTMLDivElement>('.pane-indicator-label');
    if (el === null) throw new Error('라벨이 만들어지지 않았다');
    return el;
}

const LABELS: PaneLabelConfig[] = [
    {
        paneIndex: 1,
        subLabels: [{ name: 'RSI', color: '#a78bfa' }],
    },
];

describe('usePaneLabels', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        notify = null;
        document.documentElement.removeAttribute(THEME_ATTRIBUTE);
    });

    it('returns void', () => {
        const { result } = renderHook(() =>
            usePaneLabels({
                chartRef: makeChartRef(),
                containerRef: makeContainerRef(),
                labels: [],
            })
        );

        expect(result.current).toBeUndefined();
    });

    it('does nothing when container is null', () => {
        const chart = makeChart();
        renderHook(() =>
            usePaneLabels({
                chartRef: makeChartRef(chart),
                containerRef: makeContainerRef(null),
                labels: LABELS,
            })
        );

        expect(chart.panes).not.toHaveBeenCalled();
    });

    it('does nothing when chart is null', () => {
        const container = document.createElement('div');
        renderHook(() =>
            usePaneLabels({
                chartRef: makeChartRef(null),
                containerRef: makeContainerRef(container),
                labels: LABELS,
            })
        );

        expect(
            container.querySelectorAll('.pane-indicator-label')
        ).toHaveLength(0);
    });

    it('does nothing when labels array is empty', () => {
        const container = document.createElement('div');
        const chart = makeChart();

        renderHook(() =>
            usePaneLabels({
                chartRef: makeChartRef(chart),
                containerRef: makeContainerRef(container),
                labels: [],
            })
        );

        expect(
            container.querySelectorAll('.pane-indicator-label')
        ).toHaveLength(0);
    });

    it('creates label elements in the container', () => {
        const container = document.createElement('div');
        const chart = makeChart();

        renderHook(() =>
            usePaneLabels({
                chartRef: makeChartRef(chart),
                containerRef: makeContainerRef(container),
                labels: LABELS,
            })
        );

        const labels = container.querySelectorAll('.pane-indicator-label');
        expect(labels).toHaveLength(1);
    });

    it('creates sub-label spans with correct text', () => {
        const container = document.createElement('div');
        const chart = makeChart();

        renderHook(() =>
            usePaneLabels({
                chartRef: makeChartRef(chart),
                containerRef: makeContainerRef(container),
                labels: LABELS,
            })
        );

        /* 서브라벨은 span 하나가 아니라 두 개다 — 바깥 span이 라벨 텍스트를,
           안쪽 span이 지표 색 점(●)을 담는다. 점에만 색을 칠해야 라이트
           테마에서 밝은 지표의 라벨이 읽히기 때문이다(`createSubLabelSpan` 참조). */
        const spans = container.querySelectorAll(
            '.pane-indicator-label > span'
        );
        expect(spans).toHaveLength(1);
        expect(spans[0].textContent).toContain('RSI');
        /* 점은 장식이므로 스크린리더에서 제외돼야 한다. */
        expect(
            spans[0].querySelector('span')?.getAttribute('aria-hidden')
        ).toBe('true');
    });

    it('cleans up labels on unmount', () => {
        const container = document.createElement('div');
        const chart = makeChart();

        const { unmount } = renderHook(() =>
            usePaneLabels({
                chartRef: makeChartRef(chart),
                containerRef: makeContainerRef(container),
                labels: LABELS,
            })
        );

        unmount();

        expect(
            container.querySelectorAll('.pane-indicator-label')
        ).toHaveLength(0);
    });

    /**
     * 부라벨은 **가로로** 놓이고 pane 높이로 잘려야 한다.
     *
     * 세로 스택이던 시절 MACD처럼 부라벨이 3개면 11px × 3 + 간격 6px × 2 = 45px가
     * 되어 36px짜리 보조 pane을 넘고 **아래 pane의 라벨과 겹쳐 찍혔다**
     * (모바일 500px 실측: `Histogram`과 `+DI(14)`가 한 줄에서 충돌).
     *
     * 두 속성을 함께 단언한다 — 방향만 보면 클램프가 사라져도 통과하고,
     * 클램프만 보면 세로로 되돌아가도 통과한다.
     */
    it('부라벨을 가로로 놓고 pane 높이로 자른다', () => {
        const container = document.createElement('div');
        renderHook(() =>
            usePaneLabels({
                chartRef: makeChartRef(makeChart()),
                containerRef: makeContainerRef(container),
                labels: LABELS,
            })
        );

        const el = container.querySelector<HTMLDivElement>(
            '.pane-indicator-label'
        );
        expect(el).not.toBeNull();
        expect(el?.style.flexDirection).toBe('row');
        expect(el?.style.flexWrap).toBe('wrap');
        expect(el?.style.overflow).toBe('hidden');
        // pane 1 높이 100 → 예산 84px → 온전한 줄 5개(5×17−6 = 79px).
        expect(el?.style.maxHeight).toBe('79px');
    });

    /**
     * **반응 경로 전체가 조용히 삭제 가능했다.**
     *
     * `recomputeTops`·RAF·`ResizeObserver`·`observe`·`disconnect`를 통째로 지워도,
     * `maxHeight` 재계산만 지워도, `top` 재계산만 지워도 스위트가 초록이었다.
     * 라벨을 만드는 것까지만 보고 **따라가는지**는 아무도 안 봤기 때문이다.
     * 아래 넷이 그 구멍을 각각 막는다.
     */
    it('pane이 재분배되면 top과 maxHeight가 함께 따라간다', () => {
        const container = document.createElement('div');
        const chart = makeChart([200, 100]);
        renderLabels(chart, container);

        const el = labelIn(container);
        expect(el.style.top).toBe('208px');
        expect(el.style.maxHeight).toBe('79px');

        // 지표를 더 켜서 pane 0이 줄고 pane 1이 늘어난 상황.
        chart.setHeights([120, 180]);
        act(() => notify?.());

        // 둘을 함께 본다 — 하나만 보면 나머지 한쪽이 지워져도 통과한다.
        expect(el.style.top).toBe('128px');
        expect(el.style.maxHeight).toBe('164px');
    });

    it('다음 프레임에 한 번 더 재서 stale한 pane 높이를 따라잡는다', async () => {
        // pane 추가 직후 LWC가 아직 높이를 갱신하지 않은 상태를 흉내낸다.
        const container = document.createElement('div');
        const chart = makeChart([200, 100]);
        renderLabels(chart, container);

        chart.setHeights([140, 160]);
        await flushFrame();

        const el = labelIn(container);
        expect(el.style.top).toBe('148px');
        expect(el.style.maxHeight).toBe('130px');
    });

    it('wrapper뿐 아니라 내부 canvas도 관찰한다', () => {
        // wrapper는 pane 재분배로 크기가 변하지 않는다 — canvas를 봐야 잡힌다.
        const container = document.createElement('div');
        container.appendChild(document.createElement('canvas'));
        container.appendChild(document.createElement('canvas'));

        renderLabels(makeChart(), container);

        expect(mockObserve).toHaveBeenCalledTimes(3);
    });

    it('unmount하면 observer를 끊는다', () => {
        const container = document.createElement('div');
        const { unmount } = renderLabels(makeChart(), container);

        expect(mockDisconnect).not.toHaveBeenCalled();
        unmount();

        expect(mockDisconnect).toHaveBeenCalled();
    });

    /**
     * 라벨은 지표선 **위에** 떠 있어서 배경 없이는 대비가 선이 지나가는 자리에
     * 따라 무너진다 — 다크 최악 1.13:1, 라이트 최악 2.93:1이었다. 범례가
     * `bg-secondary-900`으로 해결한 것과 같은 처방을 라벨에도 준다.
     */
    it('라벨에 불투명한 차트 배경을 깐다', () => {
        const container = document.createElement('div');
        renderLabels(makeChart(), container);

        const background = labelIn(container).style.backgroundColor;
        expect(background).not.toBe('');
        expect(background).toBe(asComputedColor(CHART_COLORS.background));
    });

    it('테마마다 그 테마의 차트 배경을 쓴다', () => {
        // 두 테마가 같은 값이면 한쪽이 굳은 것이다 — 색이 실제로 갈리는지 본다.
        const backgrounds = (['dark', 'light'] as const).map(theme => {
            document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
            const container = document.createElement('div');
            renderLabels(makeChart(), container);
            return labelIn(container).style.backgroundColor;
        });

        expect(backgrounds[0]).not.toBe(backgrounds[1]);
    });

    /**
     * TradingView 귀속 마크(`a#tv-attr-logo`, 35x19 @ left:10 bottom:10)는
     * 지울 수 없는 서드파티 요구사항이라 라벨이 비켜야 한다. 마지막 보조 pane이
     * 짧아지면 마크가 라벨 위에 얹혀 `● CCI(20)`이 `▓▓I(20)`으로 찍혔고,
     * 보조 pane 6개에서는 `● MFI`가 통째로 가려졌다.
     */
    it('짧은 마지막 pane에서는 귀속 마크 오른쪽으로 비킨다', () => {
        const container = document.createElement('div');
        const logo = document.createElement('a');
        logo.id = 'tv-attr-logo';
        // 컨테이너 좌표 (10, 200)~(45, 219) — 라벨 세로 범위와 겹친다.
        logo.getBoundingClientRect = () =>
            ({ top: 200, bottom: 219, right: 45, height: 19 }) as DOMRect;
        container.getBoundingClientRect = () =>
            ({ top: 0, left: 0 }) as DOMRect;
        container.appendChild(logo);

        // pane 1이 짧아 라벨(top 208)이 마크 띠 안으로 들어온다.
        renderLabels(makeChart([200, 30]), container);

        expect(labelIn(container).style.left).toBe('53px');
    });

    it('마크와 겹치지 않는 pane은 원래 자리를 지킨다', () => {
        const container = document.createElement('div');
        const logo = document.createElement('a');
        logo.id = 'tv-attr-logo';
        // 마크가 훨씬 아래 — 라벨(top 208, 한 줄 11px)과 만나지 않는다.
        logo.getBoundingClientRect = () =>
            ({ top: 400, bottom: 419, right: 45, height: 19 }) as DOMRect;
        container.getBoundingClientRect = () =>
            ({ top: 0, left: 0 }) as DOMRect;
        container.appendChild(logo);

        renderLabels(makeChart([200, 200]), container);

        expect(labelIn(container).style.left).toBe('8px');
    });

    it('마크 rect를 못 읽으면 라이브러리가 고정한 좌표로 판정한다', () => {
        // jsdom·첫 페인트 전에는 rect가 0이다. 그때도 충돌을 놓치면 안 된다.
        const container = document.createElement('div');
        // 컨테이너 240px → 마크 띠는 211~230. 라벨(top 208, 11px)이 걸친다.
        Object.defineProperty(container, 'clientHeight', { value: 240 });
        const logo = document.createElement('a');
        logo.id = 'tv-attr-logo';
        container.appendChild(logo);

        renderLabels(makeChart([200, 30]), container);

        expect(labelIn(container).style.left).toBe('53px');
    });

    /**
     * 귀속 마크가 **없는** 빌드에서도 라벨이 제자리에 놓여야 한다.
     *
     * 회피 로직의 세 분기 중 이것만 무단언이었다 — 다른 테스트는 전부
     * 컨테이너에 마크를 심어 두고 돌기 때문에, 마크가 아예 없을 때 라벨이
     * 어디로 가는지는 아무도 보지 않았다. `999px` 같은 값을 반환해도 통과했다.
     */
    it('귀속 마크가 없으면 원래 자리에 놓는다', () => {
        const container = document.createElement('div');
        container.getBoundingClientRect = () =>
            ({ top: 0, left: 0 }) as DOMRect;

        renderLabels(makeChart([200, 30]), container);

        expect(labelIn(container).style.left).toBe('8px');
    });

    /**
     * 예약한 프레임을 정리하는지 본다. 형제 훅(`usePricePaneSize`)에는 같은
     * 단언이 있는데 여기엔 없어서, cleanup의 `cancelAnimationFrame`을 지워도
     * 전부 초록이었다. 지금은 차트 생성 효과가 먼저 정리돼 콜백이 막히지만,
     * 그 안전망의 바깥쪽 한 겹이 아무 신호 없이 사라질 수 있었다.
     */
    it('unmount하면 예약된 프레임을 정리한다', () => {
        const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');
        const container = document.createElement('div');
        container.getBoundingClientRect = () =>
            ({ top: 0, left: 0 }) as DOMRect;

        const { unmount } = renderLabels(makeChart([200, 30]), container);
        unmount();

        expect(cancelSpy).toHaveBeenCalled();
        cancelSpy.mockRestore();
    });

    /**
     * 클램프는 **온전한 줄 단위**여야 한다.
     *
     * 그냥 `pane − 인셋`으로 자르면 두 줄짜리 라벨이 짧은 pane에서 둘째 줄
     * **중간을 가로질러** 잘려, 글자 윗부분 2~3px만 남은 얼룩이 된다(240px
     * 컨테이너에서 `● Histogram`·`● ADX(14)`가 그렇게 찍혔다).
     *
     * 리터럴이 아니라 **성질**을 단언한다 — 어떤 pane 높이에서도 클램프 값이
     * 줄 간격 격자에 맞는지 본다. 그래야 상수가 바뀌어도 규칙이 살아 있다.
     */
    it('클램프가 항상 온전한 줄 수에 맞는다', () => {
        const ROW = 11;
        const GAP = 6;
        for (const paneHeight of [24, 30, 36, 48, 60, 100, 217]) {
            const container = document.createElement('div');
            container.getBoundingClientRect = () =>
                ({ top: 0, left: 0 }) as DOMRect;
            const { unmount } = renderLabels(
                makeChart([200, paneHeight]),
                container
            );

            const px = Number.parseFloat(labelIn(container).style.maxHeight);
            // 12px 하한(한 줄도 못 담는 pane)이거나, n줄 격자에 정확히 맞는다.
            const rows = (px + GAP) / (ROW + GAP);
            expect(
                px === 12 || Number.isInteger(rows),
                `pane ${paneHeight}px → maxHeight ${px}px (줄 ${rows})`
            ).toBe(true);

            unmount();
        }
    });

    /**
     * 가로 위치는 **측정된 높이에 의존하면 안 된다.**
     *
     * 예전 순서는 높이를 먼저 재고 나중에 `left`를 옮겼는데, `left`가 바뀌면
     * 남는 폭이 바뀌고 그러면 줄바꿈과 높이가 바뀐다 — 판단의 근거가 그 판단
     * 때문에 무효가 되는 순서였다. 실측 케이스에서 줄 수가 안 바뀌어 틀린 적은
     * 없었지만, 잠복이라 순서를 바로잡았다.
     *
     * jsdom은 높이가 0이라 두 순서가 구분되지 않는다. 그래서 라벨이 **두 줄**
     * 높이를 보고하도록 만들고, 마크 띠를 "한 줄이면 안 겹치고 두 줄이면 겹치는"
     * 위치에 둔다. 옛 순서면 측정 높이(28)로 판단해 비키고, 새 순서면 한 줄
     * 기준으로 판단해 제자리를 지킨다.
     */
    it('가로 위치가 측정된 높이에 좌우되지 않는다', () => {
        const TALL = 28; // 두 줄
        const original = HTMLDivElement.prototype.getBoundingClientRect;
        HTMLDivElement.prototype.getBoundingClientRect = function (
            this: HTMLDivElement
        ) {
            return this.classList.contains('pane-indicator-label')
                ? ({
                      height: TALL,
                      top: 0,
                      bottom: TALL,
                      left: 0,
                      right: 0,
                  } as DOMRect)
                : ({ top: 0, left: 0 } as DOMRect);
        };

        try {
            const container = document.createElement('div');
            const logo = document.createElement('a');
            logo.id = 'tv-attr-logo';
            // 라벨 top은 208. 한 줄(→219)이면 안 닿고, 두 줄(→236)이면 닿는 띠.
            logo.getBoundingClientRect = () =>
                ({ top: 225, bottom: 244, right: 45, height: 19 }) as DOMRect;
            container.appendChild(logo);

            renderLabels(makeChart([200, 30]), container);

            expect(labelIn(container).style.left).toBe('8px');
        } finally {
            HTMLDivElement.prototype.getBoundingClientRect = original;
        }
    });
});
