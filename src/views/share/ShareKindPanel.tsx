'use client';

/**
 * Client-side dispatcher for share/[id] kind panels.
 *
 * This component is the RSC boundary between the server page (`/share/[id]/page.tsx`)
 * and the per-kind panel components (AnalysisPanel, OverallView, etc.).
 *
 * Why this file exists:
 *   `kindPanelRegistry.tsx` exports a plain object whose values are arrow functions.
 *   When a server component (page.tsx) imports that object and extracts a function
 *   (`SHARE_KIND_PANEL_REGISTRY[snapshot.kind]`), Next.js RSC resolves the 'use client'
 *   module into client references for *named exports only* — anonymous functions inside
 *   a plain object are **not** registered as client references, so they arrive as
 *   `undefined` at render time.
 *
 *   The fix: move the dispatch into a *named* 'use client' component (`ShareKindPanel`).
 *   The server component passes only JSON-serializable props (`kind` + `result` +
 *   optional `chartBars`); the client component performs the registry lookup and
 *   renders the correct panel.
 */

import type { ReactNode } from 'react';
import type {
    ShareableKind,
    SnapshotResultOf,
} from '@/entities/shared-analysis';
import type { AssetClass } from '@/shared/config/marketProfile';
import type { Bar } from '@y0ngha/siglens-core';
import { SHARE_KIND_PANEL_REGISTRY } from './kindPanelRegistry';

interface ShareKindPanelProps<K extends ShareableKind> {
    kind: K;
    result: SnapshotResultOf<K>;
    /**
     * Snapshot-time candlestick bars — only present when `kind === 'chart'`.
     * Serialized from `snapshot.chartBars` at the RSC boundary and forwarded
     * to the chart panel to render a static read-only candlestick chart.
     */
    chartBars?: Bar[];
    /**
     * Asset class from snapshot context — controls which sections render in
     * the `overall` panel (e.g. crypto hides Options/Fundamental/Financials).
     * Forwarded through the registry to `<OverallView assetClass={...} />`.
     */
    assetClass?: AssetClass;
    /**
     * Ticker symbol from the snapshot (e.g. "AAPL"). Forwarded to the chart
     * panel so the copy-report utility and aria-label use the real ticker
     * instead of an empty string.
     */
    symbol?: string;
}

/**
 * Dispatches to the appropriate read-only panel based on `kind`.
 * Must be rendered from a server component — props are serialized over the RSC boundary.
 */
export function ShareKindPanel<K extends ShareableKind>({
    kind,
    result,
    chartBars,
    assetClass,
    symbol,
}: ShareKindPanelProps<K>) {
    // Safe: `kind` and `result` are co-typed via the same generic `K`, so the
    // registry entry for this key always accepts exactly the result type that
    // was passed in. The cast collapses the union return type to the concrete
    // generic signature without narrowing the individual union members at call
    // sites.
    const Panel = SHARE_KIND_PANEL_REGISTRY[kind] as (props: {
        result: SnapshotResultOf<K>;
        chartBars?: Bar[];
        assetClass?: AssetClass;
        symbol?: string;
    }) => ReactNode;
    return (
        <Panel
            result={result}
            chartBars={chartBars}
            assetClass={assetClass}
            symbol={symbol}
        />
    );
}
