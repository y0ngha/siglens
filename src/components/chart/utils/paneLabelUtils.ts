import { CHART_COLORS } from '@/domain/constants/colors';
import {
    RSI_DEFAULT_PERIOD,
    MACD_FAST_PERIOD,
    MACD_SLOW_PERIOD,
    MACD_SIGNAL_PERIOD,
    DMI_DEFAULT_PERIOD,
} from '@/domain/indicators/constants';
import type { PaneLabelConfig, PaneIndices } from '@/components/chart/types';
import { INACTIVE_PANE_INDEX } from '@/components/chart/constants';

const MACD_SIGNAL_LABEL = 'Signal';
const MACD_HISTOGRAM_LABEL = 'Histogram';

interface PaneVisibility {
    rsiVisible: boolean;
    macdVisible: boolean;
    dmiVisible: boolean;
    paneIndices: PaneIndices;
}

export function buildPaneLabels({
    rsiVisible,
    macdVisible,
    dmiVisible,
    paneIndices,
}: PaneVisibility): PaneLabelConfig[] {
    const rsiLabel: PaneLabelConfig[] =
        rsiVisible && paneIndices.rsi !== INACTIVE_PANE_INDEX
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
        macdVisible && paneIndices.macd !== INACTIVE_PANE_INDEX
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
        dmiVisible && paneIndices.dmi !== INACTIVE_PANE_INDEX
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

    return [...rsiLabel, ...macdLabel, ...dmiLabel];
}
