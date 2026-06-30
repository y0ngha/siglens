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
 *   The server component passes only JSON-serializable props (`kind` + `result`);
 *   the client component performs the registry lookup and renders the correct panel.
 */

import type { ReactNode } from 'react';
import type {
    ShareableKind,
    SnapshotResultOf,
} from '@/entities/shared-analysis';
import { SHARE_KIND_PANEL_REGISTRY } from './kindPanelRegistry';

interface ShareKindPanelProps<K extends ShareableKind> {
    kind: K;
    result: SnapshotResultOf<K>;
}

/**
 * Dispatches to the appropriate read-only panel based on `kind`.
 * Must be rendered from a server component — props are serialized over the RSC boundary.
 */
export function ShareKindPanel<K extends ShareableKind>({
    kind,
    result,
}: ShareKindPanelProps<K>) {
    const Panel = SHARE_KIND_PANEL_REGISTRY[kind] as (props: {
        result: SnapshotResultOf<K>;
    }) => ReactNode;
    return <Panel result={result} />;
}
