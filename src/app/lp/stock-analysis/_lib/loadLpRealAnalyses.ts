import 'server-only';

import { findSnapshotForLocale } from '@/entities/seo-snapshot/lib/findSnapshotForLocale';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/server/getSnapshotStatic';
import { LP_ANALYSIS_SUBJECTS } from '@/views/lp/lib/stockAnalysisContent';
import { buildLpRealAnalysis } from '@/views/lp/lib/realAnalysis';
import type { LpRealAnalysis } from '@/views/lp/lib/types';

/**
 * Reads the cached ko technical snapshot of every LP subject and builds the
 * excerpt cards, in subject order. A subject without a usable row is left out.
 *
 * Uses the same static-safe reader (and cache entry) as the symbol page, so no
 * request or build ever triggers an LLM call. The reader already degrades a DB
 * failure to `null` and rethrows Next's dynamic-usage errors, so there is
 * deliberately no `try/catch` here. `revalidateSeconds` must equal the page's
 * `revalidate` literal.
 */
export async function loadLpRealAnalyses(
    revalidateSeconds: number
): Promise<LpRealAnalysis[]> {
    const cards = await Promise.all(
        LP_ANALYSIS_SUBJECTS.map(async subject => {
            const rows = await getSeoSnapshotsStatic(
                subject.symbol,
                revalidateSeconds,
                'ko'
            );
            return buildLpRealAnalysis(
                subject,
                findSnapshotForLocale(rows, 'technical', 'ko')
            );
        })
    );
    return cards.filter((card): card is LpRealAnalysis => card !== null);
}
