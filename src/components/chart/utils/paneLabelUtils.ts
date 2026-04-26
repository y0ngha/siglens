import { CHART_COLORS } from '@/lib/chartColors';
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
} from '@/domain/indicators/constants';
import type { PaneIndices, PaneLabelConfig } from '@/components/chart/types';
import { INACTIVE_PANE_INDEX } from '@/components/chart/constants';

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

    return [
        ...rsiLabel,
        ...macdLabel,
        ...dmiLabel,
        ...stochasticLabel,
        ...stochRsiLabel,
        ...cciLabel,
    ];
}
