import { CHART_COLORS } from '@/domain/constants/colors';
import {
    RSI_DEFAULT_PERIOD,
    MACD_FAST_PERIOD,
    MACD_SLOW_PERIOD,
    MACD_SIGNAL_PERIOD,
    DMI_DEFAULT_PERIOD,
} from '@/domain/indicators/constants';
import {
    RSI_PANE_INDEX,
    MACD_PANE_INDEX,
    DMI_PANE_INDEX,
} from '@/components/chart/constants';
import type { PaneLabelConfig } from '@/components/chart/types';

const MACD_SIGNAL_LABEL = 'Signal';
const MACD_HISTOGRAM_LABEL = 'Histogram';

interface PaneVisibility {
    rsiVisible: boolean;
    macdVisible: boolean;
    dmiVisible: boolean;
}

export function buildPaneLabels({
    rsiVisible,
    macdVisible,
    dmiVisible,
}: PaneVisibility): PaneLabelConfig[] {
    const rsiLabel: PaneLabelConfig[] = rsiVisible
        ? [
              {
                  paneIndex: RSI_PANE_INDEX,
                  subLabels: [
                      {
                          name: `RSI(${RSI_DEFAULT_PERIOD})`,
                          color: CHART_COLORS.rsiLine,
                      },
                  ],
              },
          ]
        : [];

    const macdLabel: PaneLabelConfig[] = macdVisible
        ? [
              {
                  paneIndex: MACD_PANE_INDEX,
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

    const dmiLabel: PaneLabelConfig[] = dmiVisible
        ? [
              {
                  paneIndex: DMI_PANE_INDEX,
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
