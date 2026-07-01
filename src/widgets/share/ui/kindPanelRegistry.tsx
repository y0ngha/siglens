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
import { clusterKeyLevels, validateKeyLevels } from '@y0ngha/siglens-core';
import { AnalysisPanel } from '@/widgets/analysis/AnalysisPanel';
import { OverallView } from '@/widgets/overall/OverallView';
import { NewsAiSummaryView } from '@/widgets/news/NewsAiSummary';
import { FundamentalAiSummaryView } from '@/widgets/fundamental/FundamentalAiSummary';
import { FinancialsAiSummaryView } from '@/widgets/financials/FinancialsAiSummary';
import { CongressTrendSummaryView } from '@/widgets/congress/CongressTrendSummaryView';
import { OptionsAiAnalysisView } from '@/widgets/options/OptionsAiAnalysis';
import { FearGreedShareView } from '@/widgets/fear-greed/FearGreedShareView';

/**
 * AnalysisPanel has several required props that are interaction/live-data
 * concerns (symbol, keyLevels, timeframe). For the read-only share view:
 *
 * - `symbol`: extracted from `result.analyzedAt` context but not stored in
 *   AnalysisResponse itself. We pass an empty string — it's only used in the
 *   copy-report utility, which is not reachable in the share view.
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
 */
function ChartSharePanel({ result }: { result: SnapshotResultOf<'chart'> }) {
    const rawKeyLevels = result.keyLevels ?? { support: [], resistance: [] };
    const clustered = clusterKeyLevels(validateKeyLevels(rawKeyLevels), 0);
    return (
        <AnalysisPanel
            symbol=""
            analysis={result}
            keyLevels={clustered}
            timeframe="1Day"
            isFreeUser={false}
        />
    );
}

type PanelComponent<K extends ShareableKind> = (props: {
    result: SnapshotResultOf<K>;
}) => ReactNode;

export const SHARE_KIND_PANEL_REGISTRY = {
    chart: ({ result }) => <ChartSharePanel result={result} />,
    overall: ({ result }) => <OverallView result={result} />,
    news: ({ result }) => <NewsAiSummaryView result={result} />,
    fundamental: ({ result }) => <FundamentalAiSummaryView result={result} />,
    financials: ({ result }) => <FinancialsAiSummaryView result={result} />,
    congress: ({ result }) => <CongressTrendSummaryView result={result} />,
    options: ({ result }) => <OptionsAiAnalysisView result={result} />,
    'fear-greed': ({ result }) => <FearGreedShareView snapshot={result} />,
} satisfies { [K in ShareableKind]: PanelComponent<K> };
