import { getTranslations } from 'next-intl/server';
import { evaluateSymbolIndexability } from '@/entities/symbol-indexability';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/lib/getSnapshotStatic';
import type { SeoSnapshotTab } from '@/entities/seo-snapshot';
import { hasProseForTab } from '@/views/symbol/snapshot/hasProseForTab';
import { noindexSymbolMetadata } from '@/shared/lib/seo';
import { buildDisplayName } from '@/entities/ticker';
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
    /**
     * 가격 봉 유무. 전달하는 라우트만 콘텐츠 게이트가 적용된다 —
     * `SymbolIndexabilityInput.hasPriceData` JSDoc에 배경이 있다.
     *
     * 현재 전달자는 차트 라우트뿐이다. 그 페이지는 본문이 사실상 봉으로만
     * 이루어져 있어(TechnicalFactsSummary + 차트) 봉이 없으면 남는 게 제목과
     * sr-only 개요뿐이라는 것이 실측으로 확인된 유일한 탭이다. 형제 탭은 각자
     * 다른 데이터 소스(뉴스·재무·의회 공시)를 갖고 있어 같은 근거를 쓸 수 없다.
     */
    hasPriceData?: boolean;
}

export async function getBlockedSymbolMetadata({
    symbol,
    assetInfo,
    degraded,
    revalidateSeconds,
    tab,
    locale,
    hasPriceData,
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
        hasPriceData,
    });

    if (decision.indexable) return null;

    // 차단된 심볼 페이지도 자기 정체성은 가져야 한다. 상수 하나를 돌려주면
    // Next가 루트 레이아웃의 title/description/openGraph를 상속시켜, 차단된
    // 심볼 URL 전부가 홈페이지 메타를 복제하고 `og:url`을 홈으로 선언한다
    // (2026-08-24 실측 — `noindexSymbolMetadata` JSDoc 참고).
    const tSeo = await getTranslations({ locale, namespace: 'shared.seo' });
    return noindexSymbolMetadata(symbol, tSeo, locale, {
        displayName: assetInfo
            ? buildDisplayName(assetInfo, symbol, locale)
            : undefined,
        koreanName: assetInfo?.koreanName,
    });
}
