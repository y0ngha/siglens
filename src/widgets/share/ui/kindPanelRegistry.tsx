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
import { AnalysisPanel } from '@/widgets/analysis/AnalysisPanel';
import { OverallView } from '@/widgets/overall/OverallView';
import { NewsAiSummaryView } from '@/widgets/news/NewsAiSummary';
import { FundamentalAiSummaryView } from '@/widgets/fundamental/FundamentalAiSummary';
import { FinancialsAiSummaryView } from '@/widgets/financials/FinancialsAiSummary';
import { CongressTrendSummaryView } from '@/widgets/congress/CongressTrendSummaryView';
import { OptionsAiAnalysisView } from '@/widgets/options/OptionsAiAnalysis';
import { FearGreedShareView } from '@/widgets/fear-greed/FearGreedShareView';

// ────────────────────────────────────────────────────────────────────────────
// chart adapter
// ────────────────────────────────────────────────────────────────────────────

/**
 * AnalysisPanel has several required props that are interaction/live-data
 * concerns (symbol, keyLevels, timeframe). For the read-only share view:
 *
 * - `symbol`: extracted from `result.analyzedAt` context but not stored in
 *   AnalysisResponse itself. We pass an empty string — it's only used in the
 *   copy-report utility, which is not reachable in the share view.
 * - `keyLevels`: the snapshot stores `AnalysisResponse.keyLevels` (raw),
 *   but AnalysisPanel takes `ClusteredKeyLevels`. We pass an empty clustered
 *   structure; the panel gracefully degrades when arrays are empty.
 * - `timeframe`: used only for stale-banner logic. We pass `'1Day'` as a
 *   safe, non-triggering default (stale threshold for 1Day is longest).
 * - All interaction props (`onReanalyze`, `onActionPricesVisibilityChange`)
 *   are intentionally omitted — the panel hides those UI elements when they
 *   are undefined.
 */
function ChartSharePanel({ result }: { result: SnapshotResultOf<'chart'> }) {
    return (
        <AnalysisPanel
            symbol=""
            analysis={result}
            keyLevels={{ support: [], resistance: [] }}
            timeframe="1Day"
            isFreeUser={false}
        />
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Registry
// ────────────────────────────────────────────────────────────────────────────

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
