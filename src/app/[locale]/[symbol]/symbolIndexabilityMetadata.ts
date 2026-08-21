import { evaluateSymbolIndexability } from '@/entities/symbol-indexability';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/lib/getSnapshotStatic';
import type { SeoSnapshotTab } from '@/entities/seo-snapshot';
import { hasProseForTab } from '@/views/symbol/snapshot/hasProseForTab';
import { NOINDEX_SYMBOL_METADATA } from '@/shared/lib/seo';
import type { AssetInfo } from '@/shared/lib/types';
import type { Locale } from '@/shared/i18n/locales';
import { SYMBOL_INDEXABLE_LOCALES } from '@/shared/i18n/indexableLocales';
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
    /** URL 로케일. 준비되지 않은 로케일은 다른 조건과 무관하게 noindex다. */
    locale: Locale;
}

export async function getBlockedSymbolMetadata({
    symbol,
    assetInfo,
    degraded,
    revalidateSeconds,
    tab,
    locale,
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
    // 로케일 게이트가 이미 결론을 정하는 경우(준비되지 않은 로케일)에는 스냅샷을
    // 읽지 않는다 — `evaluateSymbolIndexability`가 화이트리스트보다 먼저 로케일을
    // 보므로 결과가 버려진다. 이 함수 JSDoc의 "정상 경로에서 DB 읽기 회피" 목표를
    // 비-ko 경로에도 그대로 적용한다.
    const localeReady = SYMBOL_INDEXABLE_LOCALES.includes(locale);
    const hasSnapshot =
        localeReady && degraded && tab !== undefined
            ? (await getSeoSnapshotsStatic(symbol, revalidateSeconds, locale))
                  .filter(s => s.tab === tab)
                  .some(s => hasProseForTab(tab, s.content))
            : undefined;

    const decision = evaluateSymbolIndexability({
        symbol,
        assetInfo,
        degraded,
        hasSnapshot,
        locale,
    });

    if (decision.indexable) return null;

    /**
     * 로케일 게이트만 걸린 경우는 **페이지를 비우지 않는다.**
     *
     * 이 함수의 blocked 응답은 title이 없는 `NOINDEX_SYMBOL_METADATA`다. 종목이
     * 실존하지 않거나 본문이 degrade된 경우엔 그게 맞지만, `locale-not-ready`는
     * 종목도 본문도 멀쩡하고 **번역만 안 됐다**는 뜻이다. 그 경우까지 비우면
     * 371개 티커 × 9탭 × 3로케일의 제목이 전부 사라진다.
     *
     * null을 돌려주면 호출부가 평소대로 `symbolMetadataFromSeo(seo, locale)`를
     * 만들고, 거기서 로케일 게이트가 robots만 덮는다.
     */
    if (decision.reason === 'locale-not-ready') return null;

    return NOINDEX_SYMBOL_METADATA;
}
