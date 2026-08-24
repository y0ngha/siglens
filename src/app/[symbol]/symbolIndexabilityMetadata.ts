import { evaluateSymbolIndexability } from '@/entities/symbol-indexability';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/lib/getSnapshotStatic';
import type { SeoSnapshotTab } from '@/entities/seo-snapshot';
import { hasProseForTab } from '@/views/symbol/snapshot/hasProseForTab';
import { noindexSymbolMetadata } from '@/shared/lib/seo';
import { buildDisplayName } from '@/entities/ticker';
import type { AssetInfo } from '@/shared/lib/types';
import type { Metadata } from 'next';

interface BlockedSymbolMetadataInput {
    symbol: string;
    assetInfo: AssetInfo | null;
    degraded: boolean;
    revalidateSeconds: number;
    /**
     * The snapshot tab this route renders. `hasSnapshot` is scoped to a row
     * matching THIS tab only — a row for a different tab must never flip a
     * degraded page indexable (bug: a whitelisted symbol's `/congress` with
     * only a `technical` row was marked indexable while its body renders the
     * thin degraded shell — spec 2026-07-24 audit fix).
     *
     * `hasSnapshot` also requires the matching row's `content` to be
     * RENDERABLE, not merely present (audit fix FIX 1). A row can exist for
     * this tab while its `content` fails the renderer's narrowing (malformed
     * JSONB, a core schema drift) — the renderer then returns `null` and the
     * page falls back to the thin degraded shell, so marking it indexable on
     * row existence alone would be the same bug class as the different-tab
     * case above, just one level deeper. `hasProseForTab` delegates to the
     * SAME `has*Prose` predicate each `*SnapshotProse` renderer uses
     * internally, so this gate and the renderer body can never disagree.
     *
     * Omit for routes with no snapshot renderer (`fear-greed`, `position`) —
     * `hasSnapshot` then stays `undefined` and the existing degraded→noindex
     * behavior is preserved (the DB read is skipped entirely).
     */
    tab?: SeoSnapshotTab;
}

export async function getBlockedSymbolMetadata({
    symbol,
    assetInfo,
    degraded,
    revalidateSeconds,
    tab,
}: BlockedSymbolMetadataInput): Promise<Metadata | null> {
    // hasSnapshot lookup only when degraded AND the route has a snapshot tab
    // (avoid a DB/cache read on the normal path, and never read for
    // tab-less routes). Read via the ISR-safe static helper so
    // generateMetadata stays static-cacheable.
    //
    // Gate on RENDERABILITY (audit fix FIX 1), not row existence: the matching
    // row must exist AND its content must pass that tab's `has*Prose`
    // predicate. Row existence alone previously flipped a page indexable even
    // when its `content` was malformed and the renderer null-rendered — see
    // the `tab` JSDoc above.
    const hasSnapshot =
        degraded && tab !== undefined
            ? (await getSeoSnapshotsStatic(symbol, revalidateSeconds))
                  .filter(s => s.tab === tab)
                  .some(s => hasProseForTab(tab, s.content))
            : undefined;

    const decision = evaluateSymbolIndexability({
        symbol,
        assetInfo,
        degraded,
        hasSnapshot,
    });

    if (decision.indexable) return null;

    // 차단된 심볼 페이지도 자기 정체성은 가져야 한다. 상수 하나를 돌려주면
    // Next가 루트 레이아웃의 title/description/openGraph를 상속시켜, 차단된
    // 심볼 URL 전부가 홈페이지 메타를 복제하고 `og:url`을 홈으로 선언한다
    // (2026-08-24 실측 — `noindexSymbolMetadata` JSDoc 참고).
    return noindexSymbolMetadata(symbol, {
        displayName: assetInfo
            ? buildDisplayName(assetInfo, symbol)
            : undefined,
        koreanName: assetInfo?.koreanName,
    });
}
