'use client';

/**
 * 가격 아래 보조 패인에 그리는 지표(RSI·MACD·DMI·스토캐스틱 등)를 모두 연결하는 훅 — 각 지표를
 * 자기 가시성·패인 인덱스로 켜고 끈다.
 */
import type { IndicatorKey } from '../model/indicatorRegistry';
import type { IndicatorHookParams } from '../model/chartHookParams';
import { LINE_PANE_SPECS } from '../model/linePaneSpecs';
import type { PaneIndices } from '../types';
import { useDMIChart } from './useDMIChart';
import { useElderRayChart } from './useElderRayChart';
import { useLinePaneChart } from './useLinePaneChart';
import { useMACDChart } from './useMACDChart';
import { useRegressionChart } from './useRegressionChart';
import { useSqueezeMomentumChart } from './useSqueezeMomentumChart';
import { useStochasticChart } from './useStochasticChart';
import { useStochRSIChart } from './useStochRSIChart';

/**
 * 훅 호출은 개수·순서가 고정이어야 해서(Rules of Hooks) 지표마다 한 줄씩 명시한다 —
 * `LINE_PANE_SPECS`를 순회해 부르면 린터가 막고, 레지스트리가 늘 때 순서가 흔들린다.
 */
export function useIndicatorPaneCharts(
    params: IndicatorHookParams,
    visible: Record<IndicatorKey, boolean>,
    paneIndices: PaneIndices
): void {
    const pane = (key: IndicatorKey) => ({
        ...params,
        isVisible: visible[key],
        paneIndex: paneIndices[key],
    });

    useLinePaneChart({ ...pane('rsi'), spec: LINE_PANE_SPECS.rsi });
    useMACDChart(pane('macd'));
    useDMIChart(pane('dmi'));
    useStochasticChart(pane('stochastic'));
    useStochRSIChart(pane('stochRsi'));
    useLinePaneChart({ ...pane('cci'), spec: LINE_PANE_SPECS.cci });
    useLinePaneChart({ ...pane('mfi'), spec: LINE_PANE_SPECS.mfi });
    useLinePaneChart({ ...pane('williamsR'), spec: LINE_PANE_SPECS.williamsR });
    useLinePaneChart({
        ...pane('connorsRsi'),
        spec: LINE_PANE_SPECS.connorsRsi,
    });
    useLinePaneChart({ ...pane('cmf'), spec: LINE_PANE_SPECS.cmf });
    useLinePaneChart({
        ...pane('bollingerPercentB'),
        spec: LINE_PANE_SPECS.bollingerPercentB,
    });
    useLinePaneChart({ ...pane('hurst'), spec: LINE_PANE_SPECS.hurst });
    useLinePaneChart({
        ...pane('varianceRatio'),
        spec: LINE_PANE_SPECS.varianceRatio,
    });
    useLinePaneChart({ ...pane('macdV'), spec: LINE_PANE_SPECS.macdV });
    useLinePaneChart({
        ...pane('forceIndex'),
        spec: LINE_PANE_SPECS.forceIndex,
    });
    useLinePaneChart({ ...pane('obv'), spec: LINE_PANE_SPECS.obv });
    useLinePaneChart({ ...pane('atr'), spec: LINE_PANE_SPECS.atr });
    useLinePaneChart({ ...pane('yangZhang'), spec: LINE_PANE_SPECS.yangZhang });
    useLinePaneChart({
        ...pane('ewmaVolatility'),
        spec: LINE_PANE_SPECS.ewmaVolatility,
    });
    useElderRayChart(pane('elderRay'));
    useSqueezeMomentumChart(pane('squeezeMomentum'));
    useRegressionChart(pane('regression'));
}
