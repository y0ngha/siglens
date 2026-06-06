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

export function buildPaneLabels(paneIndices: PaneIndices): PaneLabelConfig[] {
    const rsiLabel: PaneLabelConfig[] =
        paneIndices.rsi !== INACTIVE_PANE_INDEX
            ? [
                  {
                      paneIndex: paneIndices.rsi,
                      subLabels: [
                          {
                              name: `RSI(${RSI_DEFAULT_PERIOD})`,
                              color: CHART_COLORS.rsiLine,
                          },
                      ],
                  },
              ]
            : [];

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

    const cciLabel: PaneLabelConfig[] =
        paneIndices.cci !== INACTIVE_PANE_INDEX
            ? [
                  {
                      paneIndex: paneIndices.cci,
                      subLabels: [
                          {
                              name: `CCI(${CCI_DEFAULT_PERIOD})`,
                              color: CHART_COLORS.cciLine,
                          },
                      ],
                  },
              ]
            : [];

    const mfiLabel: PaneLabelConfig[] =
        paneIndices.mfi !== INACTIVE_PANE_INDEX
            ? [
                  {
                      paneIndex: paneIndices.mfi,
                      subLabels: [{ name: 'MFI', color: CHART_COLORS.mfiLine }],
                  },
              ]
            : [];

    const williamsRLabel: PaneLabelConfig[] =
        paneIndices.williamsR !== INACTIVE_PANE_INDEX
            ? [
                  {
                      paneIndex: paneIndices.williamsR,
                      subLabels: [
                          {
                              name: 'Williams %R',
                              color: CHART_COLORS.williamsRLine,
                          },
                      ],
                  },
              ]
            : [];

    const connorsRsiLabel: PaneLabelConfig[] =
        paneIndices.connorsRsi !== INACTIVE_PANE_INDEX
            ? [
                  {
                      paneIndex: paneIndices.connorsRsi,
                      subLabels: [
                          {
                              name: 'CRSI',
                              color: CHART_COLORS.connorsRsiLine,
                          },
                      ],
                  },
              ]
            : [];

    const cmfLabel: PaneLabelConfig[] =
        paneIndices.cmf !== INACTIVE_PANE_INDEX
            ? [
                  {
                      paneIndex: paneIndices.cmf,
                      subLabels: [{ name: 'CMF', color: CHART_COLORS.cmfLine }],
                  },
              ]
            : [];

    const bollingerPercentBLabel: PaneLabelConfig[] =
        paneIndices.bollingerPercentB !== INACTIVE_PANE_INDEX
            ? [
                  {
                      paneIndex: paneIndices.bollingerPercentB,
                      subLabels: [
                          {
                              name: '%B',
                              color: CHART_COLORS.bollingerPercentBLine,
                          },
                      ],
                  },
              ]
            : [];

    const hurstLabel: PaneLabelConfig[] =
        paneIndices.hurst !== INACTIVE_PANE_INDEX
            ? [
                  {
                      paneIndex: paneIndices.hurst,
                      subLabels: [
                          { name: 'Hurst', color: CHART_COLORS.hurstLine },
                      ],
                  },
              ]
            : [];

    const varianceRatioLabel: PaneLabelConfig[] =
        paneIndices.varianceRatio !== INACTIVE_PANE_INDEX
            ? [
                  {
                      paneIndex: paneIndices.varianceRatio,
                      subLabels: [
                          {
                              name: 'VR',
                              color: CHART_COLORS.varianceRatioLine,
                          },
                      ],
                  },
              ]
            : [];

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
    ];
}
