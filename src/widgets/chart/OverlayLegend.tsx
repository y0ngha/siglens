'use client';

import type { CSSProperties } from 'react';
import { useMemo } from 'react';
import type { OverlayLegendItem } from './types';
import { useOverlayGroups } from './hooks/useOverlayGroups';
import { formatOverlayValue } from './utils/overlayLegendFormat';
import {
    legendMaxHeightPx,
    legendMaxRows,
    legendMaxWidthPx,
    packOverlayLegend,
} from './utils/overlayLegendLayout';
import { labelHalo } from './utils/labelHalo';
import { CHART_COLORS } from '@/shared/lib/chartColors';

interface OverlayLegendProps {
    items: OverlayLegendItem[];
    /**
     * Decimal places for overlay values — matches the candlestick series
     * precision so crypto sub-cent overlays aren't flattened to 2dp.
     * Defaults to 2 for backward compatibility (us-equity).
     */
    decimals?: number;
    /**
     * 가격 pane(pane 0)의 높이. 범례가 자기 pane을 넘지 않도록 줄 수를 자른다.
     * 0이면 아직 재지 못한 상태로 보고 제한을 걸지 않는다.
     */
    pricePaneHeightPx?: number;
    /** 차트 컨테이너 폭. 줄바꿈 지점을 정한다. 0이면 제한 없음. */
    chartWidthPx?: number;
}

export function OverlayLegend({
    items,
    decimals = 2,
    pricePaneHeightPx = 0,
    chartWidthPx = 0,
}: OverlayLegendProps) {
    const groups = useOverlayGroups(items);

    const { rows, hiddenCount } = useMemo(
        () =>
            packOverlayLegend({
                groups,
                decimals,
                maxWidthPx: legendMaxWidthPx(chartWidthPx),
                maxRows: legendMaxRows(pricePaneHeightPx),
            }),
        [groups, decimals, chartWidthPx, pricePaneHeightPx]
    );

    const maxHeight = legendMaxHeightPx(pricePaneHeightPx);

    if (items.length === 0) return null;

    return (
        /*
            상자는 투명하게 두고 글자에 차트 배경색 halo(`labelHalo`)를 두른다.
            범례는 캔들과 지표선 **위에** 떠 있어서 아무 처리 없이는 대비가 그리는
            내용에 따라 무너진다 — 다크 33행 중 11행이 4.5:1 아래, 최악 1.14:1이었다
            (MA(120)이 볼린저 중앙선 위에 얹힌 경우). 예전의 불투명 상자는 대비를
            지켰지만 캔들·선을 가려 차트가 끊겨 보였다(사용자 요청으로 투명화).

            `overflow-hidden` + `maxHeight`는 줄 수 계산이 어긋나도 상자가 가격 pane
            밖으로 나가지 못하게 하는 하드 상한이다.
        */
        <div
            className="pointer-events-none flex flex-col gap-1.5 overflow-hidden rounded-sm px-1.5 py-1"
            style={{
                // `CHART_COLORS.background`는 getter라 라이트/다크 테마에 따라 값이
                // 바뀐다 — 모듈 상수로 굳히면 테마 전환 시 halo 색이 stale해진다.
                // 매 렌더 계산을 유지한다.
                textShadow: labelHalo(CHART_COLORS.background),
                ...(maxHeight === undefined ? {} : { maxHeight }),
            }}
        >
            {rows.map((row, rowIndex) => (
                <div
                    key={row.map(item => item.name).join('|')}
                    className="flex flex-wrap gap-x-3 gap-y-1.5"
                >
                    {row.map(item => (
                        <span
                            key={item.name}
                            className="font-mono text-[11px] leading-none text-secondary-300"
                        >
                            {/*
                                지표 색은 **점에만** 칠한다. 이름·값까지 지표 색으로
                                칠하면 라이트 테마에서 밝은 지표(BB Middle 2.41:1,
                                Buy 2.82:1 등)가 읽히지 않는다. 점은 그래픽이라
                                3:1이면 되고, 텍스트는 전경 토큰으로 대비를 확보한다.
                            */}
                            <span
                                aria-hidden="true"
                                className="text-(--legend-color)"
                                style={
                                    {
                                        '--legend-color': item.color,
                                    } as CSSProperties
                                }
                            >
                                {'\u25CF'}
                            </span>{' '}
                            {item.name}{' '}
                            {formatOverlayValue(item.value, decimals)}
                        </span>
                    ))}
                    {/* 접힌 항목이 조용히 사라지지 않도록 마지막 줄에 개수를 남긴다.
                        전체 목록은 톱니바퀴(보조지표 설정)에서 볼 수 있으므로
                        이 칩 자체는 조작 대상이 아니다 — 컨테이너의
                        `pointer-events-none`을 유지해 차트 팬·줌을 막지 않는다. */}
                    {hiddenCount > 0 && rowIndex === rows.length - 1 && (
                        <span className="font-mono text-[11px] leading-none text-secondary-300">
                            +{hiddenCount}
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
}
