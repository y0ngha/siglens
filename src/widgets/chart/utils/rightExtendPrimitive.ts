import {
    LineStyle,
    type IPrimitivePaneRenderer,
    type ISeriesPrimitive,
    type SeriesAttachedParameter,
    type Time,
} from 'lightweight-charts';

export interface RightExtendSegment {
    x1: number;
    x2: number;
    y: number;
}

/**
 * 연장 구간의 미디어 좌표. 시작 x가 pane 왼쪽 밖이면 0부터, 오른쪽 끝 이상이면
 * 그릴 게 없다. 좌표 변환이 실패(`null`)하면 그리지 않는다.
 */
export function rightExtendSegment(
    x: number | null,
    y: number | null,
    paneWidth: number
): RightExtendSegment | null {
    if (x === null || y === null || x >= paneWidth) return null;
    return { x1: Math.max(0, x), x2: paneWidth, y };
}

export interface RightExtendOptions {
    /** 연장 시작 시각 — 레벨 시리즈의 끝점(마지막 봉). */
    startTime: number;
    price: number;
    color: string;
    lineWidth: number;
    dashed: boolean;
}

/**
 * 레벨 시리즈에 붙여 마지막 봉 ~ 가격축 앞을 같은 선으로 덧그리는 primitive.
 *
 * 시리즈 데이터를 미래 시각으로 늘리면 시간축(·fitContent)이 바뀌고, `createPriceLine`은
 * 왼쪽 끝부터 전체 폭이라 과거 구간을 가로지른다 — 그래서 둘 다 쓰지 않는다.
 * 시리즈가 제거되면 primitive도 함께 떨어진다.
 */
export function createRightExtendPrimitive(
    opts: RightExtendOptions
): ISeriesPrimitive<Time> {
    let param: SeriesAttachedParameter<Time> | null = null;
    let x: number | null = null;
    let y: number | null = null;

    const renderer: IPrimitivePaneRenderer = {
        draw: (target, utils) => {
            target.useMediaCoordinateSpace(({ context, mediaSize }) => {
                const seg = rightExtendSegment(x, y, mediaSize.width);
                if (!seg) return;
                context.save();
                context.strokeStyle = opts.color;
                context.lineWidth = opts.lineWidth;
                utils?.setLineStyle(
                    context,
                    opts.dashed ? LineStyle.Dashed : LineStyle.Solid
                );
                context.beginPath();
                context.moveTo(seg.x1, seg.y);
                context.lineTo(seg.x2, seg.y);
                context.stroke();
                context.restore();
            });
        },
    };
    const paneViews = [{ renderer: () => renderer }];

    return {
        attached: p => {
            param = p;
        },
        detached: () => {
            param = null;
        },
        updateAllViews: () => {
            if (!param) return;
            x = param.chart
                .timeScale()
                .timeToCoordinate(opts.startTime as Time);
            y = param.series.priceToCoordinate(opts.price);
        },
        paneViews: () => paneViews,
    };
}
