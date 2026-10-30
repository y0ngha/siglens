'use client';

/**
 * Client-side dispatcher for share/[id] kind panels.
 *
 * This component is the RSC boundary between the server page (`/share/[id]/page.tsx`)
 * and the per-kind panel components (AnalysisPanel, OverallView, etc.).
 *
 * Why this file exists:
 *   `kindPanelRegistry.tsx` exports a plain object whose values are arrow functions.
 *   Next.js RSC resolves a 'use client' module into client references for *named
 *   exports only* — anonymous functions inside a plain object are not registered as
 *   client references, so a server component that pulled an entry out of the registry
 *   would receive `undefined` at render time.
 *
 *   So the dispatch lives in a *named* 'use client' component. The server component
 *   passes only JSON-serializable props (`kind` + the snapshot fields); this component
 *   performs the registry lookup and renders the correct panel.
 */

import type { ReactNode } from 'react';
import type { ShareableKind } from '@/shared/db/constants';
import { SHARE_KIND_PANEL_REGISTRY } from './kindPanelRegistry';
import type { SharePanelProps } from './types';

/** `ShareKindPanel` props: the snapshot kind plus the panel props for that kind. */
interface ShareKindPanelProps<
    K extends ShareableKind,
> extends SharePanelProps<K> {
    kind: K;
}

/**
 * Dispatches to the appropriate read-only panel based on `kind`.
 * Must be rendered from a server component — props are serialized over the RSC boundary.
 */
export function ShareKindPanel<K extends ShareableKind>({
    kind,
    ...panelProps
}: ShareKindPanelProps<K>) {
    // Safe: `kind` and `result` are co-typed via the same generic `K`, so the
    // registry entry for this key always accepts exactly the result type that
    // was passed in. The cast collapses the union return type to the concrete
    // generic signature without narrowing the individual union members at call
    // sites.
    const Panel = SHARE_KIND_PANEL_REGISTRY[kind] as (
        props: SharePanelProps<K>
    ) => ReactNode;
    return <Panel {...panelProps} />;
}
