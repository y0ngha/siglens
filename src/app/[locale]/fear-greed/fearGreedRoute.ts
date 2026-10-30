import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type {
    MarketFearGreedView,
    MarketFearGreedViewSnapshot,
} from '@/entities/market-fear-greed/model';
import { loadSymbolNames } from '@/entities/ticker/lib/loadSymbolNames';
import { scopeUsesFmp } from '@/shared/api/market/getMarketDataProvider';
import {
    shortenRevalidateIfDatabaseMissingAtBuild,
    shortenRevalidateIfFmpFailedAtBuild,
} from '@/shared/cache/buildDegradedRevalidate';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { INTL_LOCALE, resolveLocale, type Locale } from '@/shared/i18n/locales';
import type { FearGreedMarketId } from '@/shared/lib/marketFearGreedLabels';
import { buildHubMetadata } from '@/shared/lib/seoAlternates';
import {
    buildSymbolDirectory,
    type SymbolDirectorySection,
} from '@/shared/lib/symbolDirectory';
import { fearGreedCopyFor } from './copy';

type FearGreedRouteView = MarketFearGreedView<MarketFearGreedViewSnapshot>;

/**
 * 시장별 공포·탐욕 라우트(us/kr/crypto)가 서로 다른 유일한 부분 — 어느 시장이고
 * 판독값을 어디서 읽는가. 나머지(메타데이터 골격·degrade 규약·본문)는 세 라우트가
 * 같으므로 이 파일과 `FearGreedRouteBody`가 소유한다. 라우트 파일에는 리터럴
 * `revalidate`(Next 정적 분석 요구)와 이 값만 남는다.
 */
export interface FearGreedRouteSource {
    readonly market: FearGreedMarketId;
    /**
     * 판독값 로더. React.cache + unstable_cache 이중 래핑이라 메타데이터와 본문이
     * 각각 불러도 fetch는 한 번만 실행된다.
     */
    readonly load: () => Promise<FearGreedRouteView>;
    /**
     * 로더 실패 로그 접두사(`[FearGreedRoute] getMarketFearGreedStatic failed`).
     * 운영 알람의 로그 메트릭 필터가 이 문자열을 본다 — 바꾸면 알람이 끊긴다.
     */
    readonly failureLog: string;
}

/**
 * 세 라우트 `generateMetadata`의 본체.
 *
 * 외부 I/O(Redis/FMP/yahoo) 오류는 로그를 남기고 흡수한다 — 판독값이 없으면(로더 실패 또는
 * 표본 부족) noindex + self-canonical(hreflang 없음)로 설명문만 남는 화면을 색인시키지 않는다.
 */
export async function fearGreedMetadata(
    params: Promise<{ locale: string }>,
    source: FearGreedRouteSource
): Promise<Metadata> {
    const locale = resolveLocale((await params).locale);
    const t = await getTranslations({ locale, namespace: 'shared.seo' });
    const copy = fearGreedCopyFor(source.market, t);
    const view = await source.load().catch((e: unknown) => {
        // 접두사를 페이지 본문 로그와 통일한다 — `failureLog` 참조.
        console.error(`${source.failureLog} (metadata):`, e);
        return null;
    });
    return buildHubMetadata({
        params,
        locale,
        path: copy.path,
        title: copy.title,
        description: copy.description,
        keywords: copy.keywords,
        degraded: view === null || view.snapshot === null,
    });
}

/**
 * 본문용 판독값.
 *
 * throw가 전파되면 0-byte 결과가 ISR에 굳으므로 빈 스냅샷으로 폴백한다(/market과 같은
 * 패턴). 본문은 `snapshot === null`을 "표본 부족"으로 정상 렌더한다 — `notFound()`는 쓰지
 * 않는다(Suspense 안 notFound는 200짜리 soft-404를 만든다). 빌드 중 FMP가 실패했으면 이
 * prerender를 60초 뒤 재생성되게 한다(헬퍼 JSDoc).
 */
export async function loadFearGreedView(
    source: FearGreedRouteSource
): Promise<FearGreedRouteView> {
    const view = await source.load().catch((e: unknown): FearGreedRouteView => {
        console.error(`${source.failureLog}:`, e);
        return { snapshot: null, comparisons: [] };
    });
    // 빌드 중 FMP 실패 시 60초 degrade revalidate는 FMP 라우트(us·crypto)에만 —
    // kr은 yahoo라 FMP 상태와 무관하다. 시장 → 시세 출처 판정은 scopeUsesFmp 하나가 소유.
    if (scopeUsesFmp(source.market))
        await shortenRevalidateIfFmpFailedAtBuild();
    return view;
}

/** 허브가 나열하는 종목 한 줄(`애플 (AAPL)` 라벨 + canonical 심볼). */
export type FearGreedSymbolLink = SymbolDirectorySection['items'][number];

/**
 * 허브 하단 "종목별 공포·탐욕 지수" 목록 — **그 시장의 색인 종목 전부**.
 *
 * ## 왜 있는가
 *
 * 색인되는 종목 공포탐욕 탭(`/{T}/fear-greed`)은 이 목록이 아니면 허브에서 들어가는 내부
 * 링크가 없다. 허브는 시장 전체 지수만 보여주므로 이 목록이 허브 → 종목 탭 간선을 만든다.
 *
 * ## 왜 점수를 싣지 않는가
 *
 * 종목별 점수를 보이려면 종목마다 5년 일봉을 읽어 계산해야 한다(허브 하나에 봉 326회 로드).
 * 이 목록의 목적은 크롤 경로라 앵커 텍스트(`애플 (AAPL)`)만 있으면 된다.
 *
 * 이름은 `/symbols`와 **같은 입구**(`loadSymbolNames`)·같은 인자라 캐시 엔트리도 공유한다.
 * 이름 조회가 실패해도(빈 맵) 티커만 찍힌 채 링크는 남는다.
 */
export async function loadFearGreedSymbolLinks(
    market: FearGreedMarketId,
    locale: Locale
): Promise<readonly FearGreedSymbolLink[]> {
    // 이름은 DB에서 온다 — DB 없는 배포 빌드가 티커만 찍힌 목록을 1시간 동안 굳히지
    // 않게 이 렌더를 60초 뒤 재생성하게 한다(`/symbols`와 같은 규약).
    await shortenRevalidateIfDatabaseMissingAtBuild();
    const names = await loadSymbolNames(
        [...POPULAR_TICKERS, ...POPULAR_CRYPTOS],
        locale
    );
    return (
        buildSymbolDirectory(names, INTL_LOCALE[locale]).find(
            section => section.id === market
        )?.items ?? []
    );
}
