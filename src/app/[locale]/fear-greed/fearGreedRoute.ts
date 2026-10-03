import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type {
    MarketFearGreedView,
    MarketFearGreedViewSnapshot,
} from '@/entities/market-fear-greed/model';
import { resolveLocale } from '@/shared/i18n/locales';
import type { FearGreedMarketId } from '@/shared/lib/marketFearGreedLabels';
import { buildHubMetadata } from '@/shared/lib/seoAlternates';
import { shortenRevalidateIfFmpFailedAtBuild } from '@/shared/cache/buildDegradedRevalidate';
import { scopeUsesFmp } from '@/shared/api/market/getMarketDataProvider';
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
     * CloudWatch 메트릭 필터(`siglens-market-data-loader-failed`, 2026-09-14부터
     * fear-greed us/kr + market-kr 통합)가 이 문자열을 본다 — 바꾸면 알람이 끊긴다.
     */
    readonly failureLog: string;
}

/**
 * 라우트 `generateMetadata` 본체.
 *
 * 외부 I/O(Redis/FMP/yahoo) 오류는 graceful 처리 — 판독값이 없으면(로더 실패 또는
 * 표본 부족) canonical을 비우고 noindex로 설명문만 남는 화면을 색인시키지 않는다.
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
 * 빈 ISR 캐시 동결을 막기 위해 throw 대신 빈 스냅샷으로 폴백한다(/market 페이지와
 * 동일 패턴). 본문은 `snapshot === null`을 "표본 부족"으로 정상 렌더한다 —
 * `notFound()`는 절대 쓰지 않는다(Suspense 안 notFound가 soft-404를 만든 이력이 있다).
 * 빌드 중 FMP가 실패했으면 이 prerender를 60초 뒤 재생성되게 한다(헬퍼 JSDoc).
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
