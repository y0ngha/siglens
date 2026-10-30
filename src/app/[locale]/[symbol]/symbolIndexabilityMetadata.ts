import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { isPrewarmTab } from '@/entities/seo-snapshot/lib/applicability';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/server/getSnapshotStatic';
import { hasProseForTab } from '@/entities/seo-snapshot/lib/hasProseForTab';
import {
    isSeoSnapshotTab,
    type SeoSnapshotTab,
} from '@/entities/seo-snapshot/model';
import { evaluateSymbolIndexability } from '@/entities/symbol-indexability/lib/evaluateSymbolIndexability';
import { isCuratedSymbol } from '@/entities/symbol-indexability/lib/isCuratedSymbol';
import type { SnapshotProseState } from '@/entities/symbol-indexability/model';
import { buildDisplayName } from '@/entities/ticker/lib/ticker';
import {
    getDescriptor,
    marketProfileOf,
} from '@/shared/config/marketProfile/registry';
import { SYMBOL_INDEXABLE_LOCALES } from '@/shared/i18n/indexableLocales';
import type { Locale } from '@/shared/i18n/locales';
import type { SymbolSeoTab } from '@/shared/lib/seoSymbol';
import { noindexSymbolMetadata } from '@/shared/lib/symbolMetadata';
import type { AssetInfo } from '@/shared/lib/types';

interface BlockedSymbolMetadataInput {
    symbol: string;
    assetInfo: AssetInfo | null;
    degraded: boolean;
    revalidateSeconds: number;
    /**
     * 이 라우트가 렌더하는 탭. 산문 판정(`hasSnapshot`)은 **이 탭의** 행만 본다 — 다른 탭의 행이
     * degraded 페이지를 색인 가능으로 뒤집으면, 본문은 얇은 degraded 셸인데 메타만 색인된다.
     *
     * 행이 있는 것만으로는 부족하고 `content`가 **렌더 가능**해야 한다. 손상 JSONB·core 스키마
     * 드리프트로 렌더러 narrowing을 못 통과하면 렌더러가 `null`을 그려 같은 어긋남이 생긴다.
     * `hasProseForTab`은 각 `*SnapshotProse` 렌더러와 같은 `has*Prose` 술어라 게이트와 본문이 갈리지
     * 않는다.
     *
     * 스냅샷 렌더러가 없는 탭은 카피용으로만 넘긴다(`position`·`fear-greed` — 차단 메타가 차트 탭이 아니라
     * 그 탭의 제목을 쓰게). 그러면 산문 판정과 DB 읽기를 건너뛰어 degraded → noindex가 그대로다.
     */
    tab?: SymbolSeoTab;
    /** URL 로케일. 준비되지 않은 로케일은 다른 조건과 무관하게 noindex다. */
    locale: Locale;
    /**
     * 본문을 그릴 가격 데이터가 있는가. 전달하는 라우트만 콘텐츠 게이트가 적용된다 —
     * `SymbolIndexabilityInput.hasPriceData` JSDoc에 배경이 있다.
     *
     * 전달자는 본문이 사실상 일봉으로만 계산되는 두 라우트다 — 차트(`TechnicalFactsSummary`, 술어
     * `hasTechnicalFacts`)와 종목별 공포·탐욕(`FearGreedFactsSummary`, 술어 `hasFearGreedScore`). 각자
     * 본문과 같은 술어를 넘기며, 데이터가 없으면 남는 게 제목뿐이다. 다른 탭은 데이터 소스(뉴스·재무·의회
     * 공시)가 달라 같은 근거를 쓸 수 없다.
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

/**
 * 종목 탭 `generateMetadata`의 색인 차단 판정 — 색인 가능하면 `null`, 차단이면 이 탭의 정체성(title·
 * description·self-canonical)을 단 noindex 메타데이터를 돌려준다. 판정 자체는
 * `evaluateSymbolIndexability`(로케일·화이트리스트·degraded·봉·산문)가 하고, 이 함수는 판정에 필요한 산문
 * 상태를 필요한 경우에만 읽어 넘긴다.
 */
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
    // 프리웜하지 않는 탭(`PREWARM_TABS` 밖 — 항상 noindex인 탭들)은 스냅샷을 읽지 않는다.
    // 그 탭들은 이 함수가 null을 돌려줘도 페이지가 noindex로 끝나므로 산문 상태가 결과를
    // 바꿀 수 없고, 남은 옛 행에 메타 경로가 묶이지 않게 한다. `tab` 자체는 계속 받는다 —
    // 아래 차단 메타의 탭별 카피에 쓴다.
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
    // 본문은 얇은 degraded 껍데기인데 메타만 색인 가능이 되는 어긋남이 생긴다.
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
    // (`noindexSymbolMetadata` JSDoc).
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
        // title/description을 반복해 중복 문서로 잡힌다.
        tab,
    });
}
