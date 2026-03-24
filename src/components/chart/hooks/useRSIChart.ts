import {
    useCallback,
    useEffect,
    useEffectEvent,
    useRef,
    useState,
} from 'react';
import type { RefObject } from 'react';
import { LineSeries, LineStyle } from 'lightweight-charts';
import type {
    IChartApi,
    IPriceLine,
    ISeriesApi,
    LineWidth,
    UTCTimestamp,
} from 'lightweight-charts';
import { CHART_COLORS } from '@/domain/constants/colors';
import type { Bar, IndicatorResult } from '@/domain/types';
import {
    DEFAULT_LINE_WIDTH,
    RSI_PANE_INDEX,
} from '@/components/chart/constants';
import {
    RSI_OVERBOUGHT_LEVEL,
    RSI_OVERSOLD_LEVEL,
} from '@/domain/indicators/constants';

interface UseRSIChartParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth?: LineWidth;
}

interface UseRSIChartReturn {
    isVisible: boolean;
    toggle: () => void;
}

export function useRSIChart({
    chartRef,
    bars,
    indicators,
    lineWidth = DEFAULT_LINE_WIDTH,
}: UseRSIChartParams): UseRSIChartReturn {
    const [isVisible, setIsVisible] = useState(false);
    const prevChartRef = useRef<IChartApi | null>(null);
    const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const overboughtLineRef = useRef<IPriceLine | null>(null);
    const oversoldLineRef = useRef<IPriceLine | null>(null);

    const toggle = useCallback(() => {
        setIsVisible(prev => !prev);
    }, []);

    // chart 인스턴스 교체 시 ref만 초기화 (removeSeries 불필요 — 이전 chart는 부모가 소멸)
    const clearSeriesRefs = useEffectEvent(() => {
        rsiSeriesRef.current = null;
        overboughtLineRef.current = null;
        oversoldLineRef.current = null;
    });

    // isVisible false 시 시리즈 제거 및 ref 초기화
    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
        if (rsiSeriesRef.current) {
            chart.removeSeries(rsiSeriesRef.current);
            rsiSeriesRef.current = null;
            overboughtLineRef.current = null;
            oversoldLineRef.current = null;
        }
    });

    // 시리즈 lifecycle 관리 (생성/제거)
    // bars, indicators는 의존하지 않음 — 데이터 세팅은 아래 effect가 단독 담당
    // StockChart의 차트 생성 effect가 선언 순서상 앞에 있으므로
    // 이 effect 실행 시점에 chartRef.current는 이미 설정된 상태
    useEffect(() => {
        const chart = chartRef.current;

        if (prevChartRef.current !== chart) {
            clearSeriesRefs();
            prevChartRef.current = chart;
        }

        if (!chart) return;

        if (!isVisible) {
            removeAllSeries(chart);
            return;
        }

        if (!rsiSeriesRef.current) {
            rsiSeriesRef.current = chart.addSeries(
                LineSeries,
                {
                    color: CHART_COLORS.rsiLine,
                    lineWidth,
                    priceLineVisible: false,
                    lastValueVisible: false,
                },
                RSI_PANE_INDEX
            );

            overboughtLineRef.current = rsiSeriesRef.current.createPriceLine({
                price: RSI_OVERBOUGHT_LEVEL,
                color: CHART_COLORS.rsiOverbought,
                lineWidth,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false,
                title: '',
            });

            oversoldLineRef.current = rsiSeriesRef.current.createPriceLine({
                price: RSI_OVERSOLD_LEVEL,
                color: CHART_COLORS.rsiOversold,
                lineWidth,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false,
                title: '',
            });
        }
        rsiSeriesRef.current.applyOptions({ lineWidth });
    }, [chartRef, isVisible, lineWidth]);

    // 데이터 동기화: 시리즈가 보이는 동안 bars/indicators 변경 시 업데이트
    // isVisible이 true로 바뀔 때도 실행되어 새로 생성된 시리즈에 초기 데이터를 세팅함
    useEffect(() => {
        if (!isVisible) return;

        const { rsi } = indicators;
        if (!rsi.length) return;

        if (!rsiSeriesRef.current) return;

        const count = Math.min(bars.length, rsi.length);
        const data = bars.slice(0, count).map((bar, i) => {
            const value = rsi[i];
            return value !== null && value !== undefined
                ? { time: bar.time as UTCTimestamp, value }
                : { time: bar.time as UTCTimestamp };
        });

        rsiSeriesRef.current.setData(data);
    }, [indicators, bars, isVisible]);

    return { isVisible, toggle };
}
