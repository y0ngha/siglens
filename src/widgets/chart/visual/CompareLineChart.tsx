'use client';

import {
    LineSeries,
    LineStyle,
    createChart,
    type MouseEventParams,
    type UTCTimestamp,
} from 'lightweight-charts';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChatCompareBlock } from '@/entities/chat-conversation/types';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { getChartChrome } from '@/shared/lib/chartColors';
import { chartLocalization } from '../utils/chartLocalization';
import { compareSeriesColors } from './chartSeriesColors';
import { signedPercent } from './format';

interface CompareLineChartProps {
    readonly block: ChatCompareBlock;
}

/**
 * 종목 수익률 비교 선 차트 — 종목마다 선 하나(범주색), 0% 기준선, 크로스헤어. 선은 종목별 봉 시각 그대로 그려서 시장마다
 * 거래일이 달라도 어긋나지 않는다. 범례는 선 색과 같은 색칩 + 종목 + 마지막(또는 크로스헤어가 가리키는) 수익률이다.
 * 색은 생성 시점 값이므로 테마가 바뀌면 부모가 `key`로 다시 만든다(`useThemeVersion`).
 */
export function CompareLineChart({ block }: CompareLineChartProps) {
    const locale = useResolvedLocale();
    const containerRef = useRef<HTMLDivElement>(null);
    const [hovered, setHovered] = useState<Record<string, number> | null>(null);
    const colors = useMemo(() => compareSeriesColors(), []);

    useEffect(() => {
        const container = containerRef.current;
        if (container === null) return;
        const chrome = getChartChrome();
        const chart = createChart(container, {
            autoSize: true,
            layout: {
                background: { color: chrome.background },
                textColor: chrome.text,
            },
            grid: {
                vertLines: { color: chrome.grid },
                horzLines: { color: chrome.grid },
            },
            localization: chartLocalization(locale, '1Day'),
            timeScale: { fixLeftEdge: true, fixRightEdge: true },
        });
        const lines = block.series.map((s, i) => {
            const line = chart.addSeries(LineSeries, {
                color: colors[i % colors.length],
                lineWidth: 2,
                priceLineVisible: false,
                lastValueVisible: false,
                priceFormat: {
                    type: 'custom',
                    minMove: 0.01,
                    formatter: (price: number) => signedPercent(price),
                },
            });
            line.setData(
                s.points.map(([time, value]) => ({
                    time: time as UTCTimestamp,
                    value,
                }))
            );
            return { symbol: s.symbol, line };
        });
        // 0% 기준선 — 첫 선에만 걸어도 같은 가격 축이라 한 줄로 보인다.
        lines[0]?.line.createPriceLine({
            price: 0,
            color: chrome.text,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: false,
            title: '',
        });
        const onMove = (param: MouseEventParams) => {
            if (param.time === undefined) {
                setHovered(null);
                return;
            }
            setHovered(
                Object.fromEntries(
                    lines.flatMap(({ symbol, line }) => {
                        const datum = param.seriesData.get(line);
                        return datum !== undefined && 'value' in datum
                            ? [[symbol, datum.value] as const]
                            : [];
                    })
                )
            );
        };
        chart.subscribeCrosshairMove(onMove);
        chart.timeScale().fitContent();
        return () => {
            chart.unsubscribeCrosshairMove(onMove);
            chart.applyOptions({ autoSize: false });
            chart.remove();
        };
    }, [block, colors, locale]);

    return (
        <div className="flex h-full min-h-0 flex-col gap-1">
            <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-secondary-200">
                {block.series.map((s, i) => {
                    const last = s.points.at(-1)?.[1] ?? 0;
                    return (
                        <li key={s.symbol} className="flex items-center gap-1">
                            <span
                                aria-hidden="true"
                                className="inline-block size-2 rounded-sm"
                                style={{
                                    backgroundColor: colors[i % colors.length],
                                }}
                            />
                            <span>{s.symbol}</span>
                            <span className="tabular-nums">
                                {signedPercent(hovered?.[s.symbol] ?? last)}
                            </span>
                        </li>
                    );
                })}
            </ul>
            <div ref={containerRef} className="min-h-0 flex-1" />
        </div>
    );
}
