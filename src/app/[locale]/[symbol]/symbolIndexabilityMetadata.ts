import { getTranslations } from 'next-intl/server';
import { evaluateSymbolIndexability } from '@/entities/symbol-indexability/lib/evaluateSymbolIndexability';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/lib/getSnapshotStatic';
import { isPrewarmTab } from '@/entities/seo-snapshot/lib/applicability';
import {
    isSeoSnapshotTab,
    type SeoSnapshotTab,
} from '@/entities/seo-snapshot/model';
import { isCuratedSymbol } from '@/entities/symbol-indexability/lib/isCuratedSymbol';
import type { SnapshotProseState } from '@/entities/symbol-indexability/model';
import { hasProseForTab } from '@/entities/seo-snapshot/lib/hasProseForTab';
import { noindexSymbolMetadata, type SymbolSeoTab } from '@/shared/lib/seo';
import { buildDisplayName } from '@/entities/ticker/lib/ticker';
import {
    getDescriptor,
    marketProfileOf,
} from '@/shared/config/marketProfile/registry';
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
     * Routes with no snapshot renderer either omit it (`position`) or pass a
     * copy-only tab (`fear-greed`). Either way `hasSnapshot` stays `undefined`
     * and the existing degraded→noindex behavior is preserved (the DB read is
     * skipped entirely). `fear-greed` is passed only so the blocked metadata
     * uses that tab's own title instead of the chart tab's.
     */
    tab?: SymbolSeoTab;
    /** URL 로케일. 준비되지 않은 로케일은 다른 조건과 무관하게 noindex다. */
    locale: Locale;
    /**
     * 가격 봉 유무. 전달하는 라우트만 콘텐츠 게이트가 적용된다 —
     * `SymbolIndexabilityInput.hasPriceData` JSDoc에 배경이 있다.
     *
     * 현재 전달자는 차트 라우트와 종목별 공포·탐욕 라우트 두 곳이다. 둘 다 본문이
     * 사실상 일봉으로만 계산되고(차트: TechnicalFactsSummary + 차트, 공포·탐욕:
     * FearGreedFactsSummary), 같은 술어(`buildTechnicalFacts(...) !== null`)로
     * 판정한다 — 봉이 없으면 남는 게 제목뿐이다. 공포·탐욕은 2026-10-01 색인 재개와
     * 함께 합류했다. 다른 형제 탭은 각자 다른 데이터 소스(뉴스·재무·의회 공시)를 갖고
     * 있어 같은 근거를 쓸 수 없다.
     */
    hasPriceData?: boolean;
}

/**
 * 이 탭의 스냅샷 산문 상태. 읽기 실패(`null`)는 `unknown`이다 — 색인 게이트가 fail-open으로
 * 다룬다(`SnapshotProseState`). `getSeoSnapshotsStatic`은 React `cache`라 본문·description
 * 로더가 같은 렌더에서 같은 읽기를 공유한다.
 */
async function readProseState(
    symbol: string,
    revalidateSeconds: number,
    locale: Locale,
    tab: SeoSnapshotTab
): Promise<SnapshotProseState> {
    const snapshots = await getSeoSnapshotsStatic(
        symbol,
        revalidateSeconds,
        locale
    );
    if (snapshots === null) return 'unknown';
    return snapshots.some(s => s.tab === tab && hasProseForTab(tab, s.content))
        ? 'present'
        : 'absent';
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
    // 로케일 게이트가 이미 결론을 정하는 경우(준비되지 않은 로케일)에는 스냅샷을
    // 읽지 않는다 — `evaluateSymbolIndexability`가 화이트리스트보다 먼저 로케일을
    // 보므로 결과가 버려진다.
    const localeReady = SYMBOL_INDEXABLE_LOCALES.includes(locale);
    // 프리웜하지 않는 탭(`PREWARM_TABS` 밖 — 2026-10-01부터 항상 noindex인 다섯 탭)은
    // 스냅샷을 읽지 않는다. 그 탭들은 이 함수가 null을 돌려줘도 페이지가 noindex로
    // 끝나므로 산문 상태가 결과를 바꿀 수 없고, 남은 옛 행에 메타 경로가 묶이지
    // 않게 한다. `tab` 자체는 계속 받는다 — 아래 차단 메타의 탭별 카피에 쓴다.
    const snapshotTab =
        tab !== undefined && isSeoSnapshotTab(tab) && isPrewarmTab(tab)
            ? tab
            : undefined;
    // 산문 판정은 **큐레이션 종목만** 한다. 롱테일은 산문이 있든 없든 어차피 noindex
    // (`longtail-default-blocked`)라 결과를 바꾸지 못하고, 본문이 같은 읽기를 하므로
    // 판정용 DB 왕복만 늘린다.
    const prose: SnapshotProseState | undefined =
        localeReady &&
        assetInfo !== null &&
        snapshotTab !== undefined &&
        isCuratedSymbol(symbol)
            ? await readProseState(
                  symbol,
                  revalidateSeconds,
                  locale,
                  snapshotTab
              )
            : undefined;
    // degraded 경로의 `hasSnapshot`은 "이 탭의 렌더 가능한 스냅샷이 있는가"다 — 행 존재가
    // 아니라 렌더 가능성(`hasProseForTab` = 렌더러와 같은 `has*Prose`)으로 판정한다. 행은
    // 있는데 content가 렌더러 narrowing을 못 통과하면(손상 JSONB·core 스키마 드리프트)
    // 본문은 얇은 degraded 껍데기인데 메타만 색인 가능이 되는 어긋남이 생긴다(감사 FIX 1).
    // 읽기 실패(`unknown`)는 "있음"으로 칠 수 없으므로 false다 — degraded는 원래 보수적이다.
    const hasSnapshot =
        degraded && prose !== undefined ? prose === 'present' : undefined;

    const decision = evaluateSymbolIndexability({
        symbol,
        assetInfo,
        degraded,
        hasSnapshot,
        locale,
        hasPriceData,
        prose,
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
        // 비-기본 로케일 title은 한국어명 대신 영문 법인명을 쓴다(`composeSymbolTitle`).
        englishName: assetInfo?.name,
        // 크립토 탭은 `시세`/`Price` 카피 빌더를 쓴다 — 생략하면 equity(`주가`/`Stock`)다.
        assetClass: assetInfo
            ? getDescriptor(marketProfileOf(assetInfo)).assetClass
            : undefined,
        // 탭별 카피를 쓴다 — 없으면 한 심볼의 차단된 탭들이 차트 페이지와 같은
        // title/description을 반복해 중복 문서로 잡힌다(2026-09-17 네이버 리포트).
        tab,
    });
}
