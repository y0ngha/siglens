import type {
    IPrimitivePaneRenderer,
    IPrimitivePaneView,
    ISeriesPrimitive,
    Logical,
    SeriesAttachedParameter,
    Time,
} from 'lightweight-charts';
import type { ExtendedSessionRange } from '@/shared/api/market/extendedBarsSession';

/** 미디어 좌표의 가로 구간. */
export interface BandSpan {
    x1: number;
    x2: number;
}

/**
 * 구간의 첫·마지막 봉 중심 좌표(`xStart`·`xEnd`)와 봉 간격으로 밴드의 가로 구간을 만든다 —
 * 첫 봉의 왼쪽 반 칸부터 마지막 봉의 오른쪽 반 칸까지. pane 밖으로 나간 부분은 잘라내고, 보이는
 * 폭이 0이면 `null`(그릴 것 없음). 좌표 변환이 실패(`null`)하면 그리지 않는다.
 */
export function bandSpan(
    xStart: number | null,
    xEnd: number | null,
    barSpacing: number,
    paneWidth: number
): BandSpan | null {
    if (xStart === null || xEnd === null) return null;
    const half = barSpacing / 2;
    const x1 = Math.max(0, xStart - half);
    const x2 = Math.min(paneWidth, xEnd + half);
    return x2 > x1 ? { x1, x2 } : null;
}

export interface ExtendedSessionPrimitive extends ISeriesPrimitive<Time> {
    /** 그릴 구간을 바꾸고 다시 그리게 한다. */
    setRanges: (ranges: readonly ExtendedSessionRange[]) => void;
}

/** 구간 하나의 첫·마지막 봉 중심 좌표(미디어 px, 변환 실패는 `null`). */
interface BandEdges {
    xStart: number | null;
    xEnd: number | null;
}

/**
 * 프리·애프터마켓 구간(`ExtendedSessionRange`)에 옅은 배경 밴드를 깔아 주는 시리즈 primitive.
 *
 * `rightExtendPrimitive`와 같은 방식이다: 시리즈에 붙으면 `timeScale().timeToCoordinate`로 구간의
 * 첫·마지막 봉 위치를 구해 그린다. 밴드는 **캔들 뒤**(`zOrder: 'bottom'`)에 그려 캔들·그리드를 덮지
 * 않는다. 봉 간격은 논리 인덱스 0과 1의 좌표 차로 잰다(줌·스크롤에도 현재 값이 맞고, 화면 밖이어도
 * 유효하다). 시리즈가 제거되면 primitive도 함께 떨어진다.
 *
 * pane 폭은 좌표 계산 시점이 아니라 **그릴 때의 `mediaSize.width`**로 잰다 — 가격 차트는 시간축을
 * 숨겨(`timeScale: { visible: false }`) `timeScale().width()`가 0이라, 그 값으로 자르면 밴드가
 * 통째로 사라진다(2026-10-15 실측).
 */
export function createExtendedSessionPrimitive(
    color: string
): ExtendedSessionPrimitive {
    let param: SeriesAttachedParameter<Time> | null = null;
    let ranges: readonly ExtendedSessionRange[] = [];
    let edges: BandEdges[] = [];
    let barSpacing = 0;

    const renderer: IPrimitivePaneRenderer = {
        draw: target => {
            target.useMediaCoordinateSpace(({ context, mediaSize }) => {
                if (edges.length === 0) return;
                context.save();
                context.fillStyle = color;
                for (const { xStart, xEnd } of edges) {
                    const span = bandSpan(
                        xStart,
                        xEnd,
                        barSpacing,
                        mediaSize.width
                    );
                    if (span === null) continue;
                    context.fillRect(
                        span.x1,
                        0,
                        span.x2 - span.x1,
                        mediaSize.height
                    );
                }
                context.restore();
            });
        },
    };
    const paneView: IPrimitivePaneView = {
        zOrder: () => 'bottom',
        renderer: () => renderer,
    };
    const paneViews = [paneView];

    const recompute = (): void => {
        if (!param) {
            edges = [];
            return;
        }
        const timeScale = param.chart.timeScale();
        // `Logical`·`Time`은 숫자에 붙인 브랜드일 뿐이다 — 런타임 값은 그대로 숫자다.
        const zero = timeScale.logicalToCoordinate(0 as Logical);
        const one = timeScale.logicalToCoordinate(1 as Logical);
        barSpacing = zero !== null && one !== null ? one - zero : 0;
        edges = ranges.map(range => ({
            xStart: timeScale.timeToCoordinate(range.startTime as Time),
            xEnd: timeScale.timeToCoordinate(range.endTime as Time),
        }));
    };

    return {
        attached: p => {
            param = p;
            recompute();
        },
        detached: () => {
            param = null;
            edges = [];
        },
        updateAllViews: recompute,
        paneViews: () => paneViews,
        setRanges: next => {
            ranges = next;
            recompute();
            param?.requestUpdate();
        },
    };
}
