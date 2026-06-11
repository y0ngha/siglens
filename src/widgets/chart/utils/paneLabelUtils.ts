import { CHART_COLORS } from '@/shared/lib/chartColors';
import {
    CCI_DEFAULT_PERIOD,
    DMI_DEFAULT_PERIOD,
    MACD_FAST_PERIOD,
    MACD_SIGNAL_PERIOD,
    MACD_SLOW_PERIOD,
    RSI_DEFAULT_PERIOD,
    STOCH_RSI_D_PERIOD,
    STOCH_RSI_K_PERIOD,
    STOCH_RSI_RSI_PERIOD,
    STOCH_RSI_STOCH_PERIOD,
    STOCHASTIC_D_PERIOD,
    STOCHASTIC_K_PERIOD,
    STOCHASTIC_SMOOTHING,
} from '@y0ngha/siglens-core';
import type { PaneIndices, PaneLabelConfig } from '../types';
import { INACTIVE_PANE_INDEX } from '../constants';

const MACD_SIGNAL_LABEL = 'Signal';
const MACD_HISTOGRAM_LABEL = 'Histogram';

// subLabel이 하나뿐인 pane 라벨(RSI·CCI·MFI·Williams %R·CRSI·CMF·%B·Hurst·VR)의
// 공통 패턴. 비활성 pane은 빈 배열을 반환해 spread 시 사라진다.
function buildSinglePaneLabel(
    paneIndex: number,
    name: string,
    color: string
): PaneLabelConfig[] {
    return paneIndex !== INACTIVE_PANE_INDEX
        ? [{ paneIndex, subLabels: [{ name, color }] }]
        : [];
}

export function buildPaneLabels(paneIndices: PaneIndices): PaneLabelConfig[] {
    const rsiLabel = buildSinglePaneLabel(
        paneIndices.rsi,
        `RSI(${RSI_DEFAULT_PERIOD})`,
        CHART_COLORS.rsiLine
    );

    const macdLabel: PaneLabelConfig[] =
        paneIndices.macd !== INACTIVE_PANE_INDEX
            ? [
                  {
                      paneIndex: paneIndices.macd,
                      subLabels: [
                          {
                              name: `MACD(${MACD_FAST_PERIOD},${MACD_SLOW_PERIOD},${MACD_SIGNAL_PERIOD})`,
                              color: CHART_COLORS.macdLine,
                          },
                          {
                              name: MACD_SIGNAL_LABEL,
                              color: CHART_COLORS.macdSignal,
                          },
                          {
                              name: MACD_HISTOGRAM_LABEL,
                              color: CHART_COLORS.macdHistogramBullish,
                          },
                      ],
                  },
              ]
            : [];

    const dmiLabel: PaneLabelConfig[] =
        paneIndices.dmi !== INACTIVE_PANE_INDEX
            ? [
                  {
                      paneIndex: paneIndices.dmi,
                      subLabels: [
                          {
                              name: `+DI(${DMI_DEFAULT_PERIOD})`,
                              color: CHART_COLORS.dmiPlus,
                          },
                          {
                              name: `-DI(${DMI_DEFAULT_PERIOD})`,
                              color: CHART_COLORS.dmiMinus,
                          },
                          {
                              name: `ADX(${DMI_DEFAULT_PERIOD})`,
                              color: CHART_COLORS.dmiAdx,
                          },
                      ],
                  },
              ]
            : [];

    const stochasticLabel: PaneLabelConfig[] =
        paneIndices.stochastic !== INACTIVE_PANE_INDEX
            ? [
                  {
                      paneIndex: paneIndices.stochastic,
                      subLabels: [
                          {
                              name: `%K(${STOCHASTIC_K_PERIOD},${STOCHASTIC_D_PERIOD},${STOCHASTIC_SMOOTHING})`,
                              color: CHART_COLORS.stochasticK,
                          },
                          {
                              name: `%D`,
                              color: CHART_COLORS.stochasticD,
                          },
                      ],
                  },
              ]
            : [];

    const stochRsiLabel: PaneLabelConfig[] =
        paneIndices.stochRsi !== INACTIVE_PANE_INDEX
            ? [
                  {
                      paneIndex: paneIndices.stochRsi,
                      subLabels: [
                          {
                              name: `StochRSI(${STOCH_RSI_RSI_PERIOD},${STOCH_RSI_STOCH_PERIOD},${STOCH_RSI_K_PERIOD},${STOCH_RSI_D_PERIOD})`,
                              color: CHART_COLORS.stochRsiK,
                          },
                          {
                              name: `%D`,
                              color: CHART_COLORS.stochRsiD,
                          },
                      ],
                  },
              ]
            : [];

    const cciLabel = buildSinglePaneLabel(
        paneIndices.cci,
        `CCI(${CCI_DEFAULT_PERIOD})`,
        CHART_COLORS.cciLine
    );

    const mfiLabel = buildSinglePaneLabel(
        paneIndices.mfi,
        'MFI',
        CHART_COLORS.mfiLine
    );

    const williamsRLabel = buildSinglePaneLabel(
        paneIndices.williamsR,
        'Williams %R',
        CHART_COLORS.williamsRLine
    );

    const connorsRsiLabel = buildSinglePaneLabel(
        paneIndices.connorsRsi,
        'CRSI',
        CHART_COLORS.connorsRsiLine
    );

    const cmfLabel = buildSinglePaneLabel(
        paneIndices.cmf,
        'CMF',
        CHART_COLORS.cmfLine
    );

    const bollingerPercentBLabel = buildSinglePaneLabel(
        paneIndices.bollingerPercentB,
        '%B',
        CHART_COLORS.bollingerPercentBLine
    );

    const hurstLabel = buildSinglePaneLabel(
        paneIndices.hurst,
        'Hurst',
        CHART_COLORS.hurstLine
    );

    const varianceRatioLabel = buildSinglePaneLabel(
        paneIndices.varianceRatio,
        'VR',
        CHART_COLORS.varianceRatioLine
    );

    const macdVLabel = buildSinglePaneLabel(
        paneIndices.macdV,
        'MACD-V',
        CHART_COLORS.macdVLine
    );

    const forceIndexLabel = buildSinglePaneLabel(
        paneIndices.forceIndex,
        'Force Index',
        CHART_COLORS.forceIndexLine
    );

    const obvLabel = buildSinglePaneLabel(
        paneIndices.obv,
        'OBV',
        CHART_COLORS.obvLine
    );

    const atrLabel = buildSinglePaneLabel(
        paneIndices.atr,
        'ATR',
        CHART_COLORS.atrLine
    );

    const yangZhangLabel = buildSinglePaneLabel(
        paneIndices.yangZhang,
        'Yang-Zhang',
        CHART_COLORS.yangZhangLine
    );

    const ewmaVolatilityLabel = buildSinglePaneLabel(
        paneIndices.ewmaVolatility,
        'EWMA Vol',
        CHART_COLORS.ewmaVolatilityLine
    );

    return [
        ...rsiLabel,
        ...macdLabel,
        ...dmiLabel,
        ...stochasticLabel,
        ...stochRsiLabel,
        ...cciLabel,
        ...mfiLabel,
        ...williamsRLabel,
        ...connorsRsiLabel,
        ...cmfLabel,
        ...bollingerPercentBLabel,
        ...hurstLabel,
        ...varianceRatioLabel,
        ...macdVLabel,
        ...forceIndexLabel,
        ...obvLabel,
        ...atrLabel,
        ...yangZhangLabel,
        ...ewmaVolatilityLabel,
    ];
}
