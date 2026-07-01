'use client';

/**
 * Registry mapping each ShareableKind to its read-only presentational panel.
 *
 * Each entry is a React component that accepts `{ result: SnapshotResultOf<K> }`
 * and renders the tab's AI summary view from snapshot data.
 * MVP = AI summary panels only (no raw data tables).
 *
 * The `satisfies` constraint enforces exhaustiveness at compile time:
 * adding a kind to ShareableKind without a matching entry here is a type error.
 */

import type { ReactNode } from 'react';
import type {
    ShareableKind,
    SnapshotResultOf,
} from '@/entities/shared-analysis';
import type { AssetClass } from '@/shared/config/marketProfile';
import type { Bar } from '@y0ngha/siglens-core';
import { clusterKeyLevels, validateKeyLevels } from '@y0ngha/siglens-core';
import { AnalysisPanel } from '@/widgets/analysis';
import { ShareCandlestickChart } from '@/widgets/chart/ShareCandlestickChart';
import { OverallView } from '@/widgets/overall';
import { NewsAiSummaryView } from '@/widgets/news';
import { FundamentalAiSummaryView } from '@/widgets/fundamental';
import { FinancialsAiSummaryView } from '@/widgets/financials';
import { CongressTrendSummaryView } from '@/widgets/congress';
import { OptionsAiAnalysisView } from '@/widgets/options';
import { FearGreedShareView } from '@/widgets/fear-greed';

/**
 * AnalysisPanel has several required props that are interaction/live-data
 * concerns (symbol, keyLevels, timeframe). For the read-only share view:
 *
 * - `symbol`: threaded from the snapshot so the copy-report utility produces
 *   the correct ticker text and link (e.g. `AAPL 기술적 분석 리포트`,
 *   `siglens.io/AAPL`).
 * - `keyLevels`: derived from `result.keyLevels` (raw `KeyLevels`) via
 *   `validateKeyLevels` + `clusterKeyLevels`. We pass `currentPrice=0` because
 *   no live bar data is available; this sets epsilon=0 (no merging) but all
 *   valid levels still flow through. Falls back to the empty clustered structure
 *   when `result.keyLevels` is absent, so the panel degrades gracefully.
 * - `timeframe`: used only for stale-banner logic. We pass `'1Day'` as a
 *   safe, non-triggering default (stale threshold for 1Day is longest).
 * - All interaction props (`onReanalyze`, `onActionPricesVisibilityChange`)
 *   are intentionally omitted — the panel hides those UI elements when they
 *   are undefined.
 *
 * `chartBars` is optional — old snapshots (created before this feature) will
 * not have bars. When present, a read-only candlestick chart is rendered ABOVE
 * the AnalysisPanel so the viewer sees the price context at analysis time.
 */
function ChartSharePanel({
    result,
    chartBars,
    symbol,
}: {
    result: SnapshotResultOf<'chart'>;
    chartBars?: Bar[];
    symbol: string;
}) {
    const rawKeyLevels = result.keyLevels ?? { support: [], resistance: [] };
    const clustered = clusterKeyLevels(validateKeyLevels(rawKeyLevels), 0);
    return (
        <div className="flex flex-col gap-6">
            {chartBars !== undefined && chartBars.length > 0 && (
                <div className="border-secondary-700 overflow-hidden rounded-lg border">
                    <ShareCandlestickChart bars={chartBars} ticker={symbol} />
                </div>
            )}
            <AnalysisPanel
                symbol={symbol}
                analysis={result}
                keyLevels={clustered}
                timeframe="1Day"
                isFreeUser={false}
            />
        </div>
    );
}

type PanelComponent<K extends ShareableKind> = (props: {
    result: SnapshotResultOf<K>;
    chartBars?: Bar[];
    assetClass?: AssetClass;
    symbol?: string;
}) => ReactNode;

export const SHARE_KIND_PANEL_REGISTRY = {
    chart: ({ result, chartBars, symbol }) => (
        <ChartSharePanel
            result={result}
            chartBars={chartBars}
            symbol={symbol ?? ''}
        />
    ),
    overall: ({ result, assetClass }) => (
        <OverallView result={result} assetClass={assetClass} />
    ),
    news: ({ result }) => <NewsAiSummaryView result={result} />,
    fundamental: ({ result }) => <FundamentalAiSummaryView result={result} />,
    financials: ({ result }) => <FinancialsAiSummaryView result={result} />,
    congress: ({ result }) => <CongressTrendSummaryView result={result} />,
    options: ({ result }) => <OptionsAiAnalysisView result={result} />,
    'fear-greed': ({ result }) => <FearGreedShareView snapshot={result} />,
} satisfies { [K in ShareableKind]: PanelComponent<K> };
