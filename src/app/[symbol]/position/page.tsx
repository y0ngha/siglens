import {
    BAND_COUNT,
    computeVolumeByBand,
    PositionTabContent,
} from '@/widgets/portfolio-position';
import { getBlockedSymbolMetadata } from '@/app/[symbol]/symbolIndexabilityMetadata';
import { SymbolPageHeading } from '@/views/symbol';
import {
    DEFAULT_TIMEFRAME,
    SymbolRouteParams,
    isAdmissibleSymbolShape,
} from '@/shared/config/market';
import { isUnresolvableDegraded } from '@/shared/lib/symbolGuard';
import { buildDisplayName, getAssetInfoResilient } from '@/entities/ticker';
// isTabAllowedForSymbol은 barrel에서 제외 — fundamental page.tsx와 동일하게
// api.ts에서 직접 deep import한다 (entities/ticker/index.ts 상단 주석 참고).
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import { getBarsStatic, quantizeBarsDataToLastClosed } from '@/entities/bars';
import { marketProfileOf } from '@/shared/config/marketProfile';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import {
    buildTechnicalFacts,
    RECENT_BARS_WINDOW,
} from '@/views/symbol/utils/technicalFacts';
import {
    clampSeoDescription,
    NOINDEX_SYMBOL_METADATA,
    SITE_URL,
} from '@/shared/lib/seo';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

// 12h — "내 위치"는 최근 가격 범위(low52w/high52w/lastClose)만 SSR로 내려주는
// 느리게 변하는 개인화 표층이다. ★평단/수익률은 client(hydration+user 게이트)라
// SSR 캐시 신선도와 무관 — overall과 동일 상한(43200s)을 재사용한다.
export const revalidate = 43200;

// generateStaticParams가 없으면 동적 라우트는 매 요청 동적 렌더돼 revalidate가
// 무력화된다(Next.js). 빈 배열 = 빌드 prebuild 없이 첫 요청에 렌더+캐시하는 on-demand
// ISR. (cacheComponents 비활성이라 빈 배열 허용)
export async function generateStaticParams(): Promise<SymbolRouteParams[]> {
    return [];
}

interface Props {
    params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();
    // 본문 notFound()와 일관: 잘못된 ticker는 메타데이터를 비우고 noindex로 응답한다.
    if (!isAdmissibleSymbolShape(upper)) {
        return NOINDEX_SYMBOL_METADATA;
    }
    const { assetInfo, degraded } = await getAssetInfoResilient(upper);
    const blockedMetadata = getBlockedSymbolMetadata({
        symbol: upper,
        assetInfo,
        degraded,
    });
    if (blockedMetadata) return blockedMetadata;
    if (!assetInfo) return NOINDEX_SYMBOL_METADATA;
    // fundamental 선례와 동일: 탭 허용 여부가 본문 notFound와 어긋나면 soft-404
    // (index:true인데 body는 404)가 생긴다. 현재는 모든 market profile이
    // 'position'을 지원하지만, 이 가드는 미래에 탭 미지원 프로필이 추가돼도
    // notFound()/noindex가 함께 어긋나지 않도록 유지한다.
    if (!(await isTabAllowedForSymbol(upper, 'position'))) {
        return NOINDEX_SYMBOL_METADATA;
    }

    const displayName = buildDisplayName(assetInfo, upper);
    const url = `${SITE_URL}/${upper}/position`;
    // 이 탭은 /account·/onboarding과 같은 개인화 surface다 — 수천 심볼 ×
    // (익명에겐 얇고 차트와 중복인) 가격 층 조합은 크롤 예산 낭비이자 콘텐츠
    // 클러스터 희석이라 항상 noindex다(디자인 §배치 1). ★평단/수익률은 client
    // 전용(hydration+user 게이트)이라 SSR HTML에는 절대 실리지 않는다.
    //
    // seo-audit 재검토(2026-07): 이 노인덱스 결정을 뒤집을 만한 근거가 없어 유지한다.
    // 익명 방문자에게 SSR로 실리는 유일한 공개 콘텐츠는 low52w/high52w/lastClose
    // 세 숫자뿐이고(sr-only 섹션 + PositionCta), 그마저도 동일한
    // `buildTechnicalFacts`/`getBarsStatic` 파생값이 이미 인덱싱된 `[symbol]`(차트)·
    // `overall`(기술적 요약) 페이지에 노출돼 있어 새 콘텐츠가 아니라 중복이다. 회원의
    // 실제 평단·수익률(이 페이지의 핵심 가치)은 client-only라 크롤러는 절대 볼 수
    // 없고, 대신 "보유종목 등록하기" CTA만 보게 된다 — 수천 심볼 × 이 얇은 템플릿은
    // 전형적인 thin/doorway 패턴이라 index:true 전환은 권장하지 않는다. fundamental/
    // overall/news 등 sibling 탭들은 심볼별로 substantive하고 서로 다른 AI 생성
    // 콘텐츠(재무 지표, 4축 시나리오, 기사 목록)를 갖고 있어 이 판단과 대비된다.
    // 같은 이유로 sitemap(`buildPopularEntries`)에도 이 라우트를 추가하지 않는다 —
    // 이미 noindex인 라우트를 sitemap에 넣는 것 자체가 상호 모순 신호다.
    return {
        ...NOINDEX_SYMBOL_METADATA,
        title: `${displayName} 내 위치`,
        description: clampSeoDescription(
            `${displayName}의 최근 가격 범위에서 내 평단이 어디에 위치하는지 확인하세요.`
        ),
        alternates: { canonical: url },
        openGraph: { url },
    };
}

interface PriceRange {
    low52w: number;
    high52w: number;
    lastClose: number;
    /** 5개 가격대별 최근 거래량 비중(%), index 0=최저가 밴드. 집계 불가(예:
     * 전체 거래량 0)면 null — PositionBuilding은 그 경우 층 hover를 생략한다. */
    volumeByBand: number[] | null;
}

/**
 * 최근 가격 범위(공개 데이터)만 서버에서 계산한다. getBarsStatic은
 * cookies()를 읽지 않는 정적 캐시 경로라 ISR cold-gen에서 안전하다
 * (getBarsAction을 직접 호출하면 cookies() → DYNAMIC_SERVER_USAGE로
 * ISR cold-gen이 500을 낸다 — 반드시 getBarsStatic을 거칠 것).
 * 실패는 null로 degrade해 페이지 자체가 throw하지 않게 한다 — client의
 * PositionTabContent는 low/high/lastClose가 null이어도 CTA/데이터 부족
 * 안내로 graceful 폴백한다.
 */
async function resolvePriceRange(
    ticker: string,
    fmpSymbol: string | undefined,
    marketProfile: ReturnType<typeof marketProfileOf>
): Promise<PriceRange | null> {
    try {
        const rawBars = await getBarsStatic(
            ticker,
            DEFAULT_TIMEFRAME,
            fmpSymbol
        );
        const quantized = quantizeBarsDataToLastClosed(
            rawBars,
            new Date(),
            sessionSpecFor(marketProfile)
        );
        const facts = buildTechnicalFacts(quantized.bars, quantized.indicators);
        if (facts === null) return null;
        // buildTechnicalFacts가 low52w/high52w를 도출한 것과 동일한
        // RECENT_BARS_WINDOW(252봉) 창을 재사용한다 — 그렇지 않으면 밴드 범위
        // [low,high]와 집계 대상 봉의 시간창이 어긋난다.
        const recentBars = quantized.bars.slice(-RECENT_BARS_WINDOW);
        const volumeByBand = computeVolumeByBand(
            recentBars,
            facts.low52w,
            facts.high52w,
            BAND_COUNT
        );
        return {
            low52w: facts.low52w,
            high52w: facts.high52w,
            lastClose: facts.lastClose,
            volumeByBand,
        };
    } catch (e) {
        console.error('[PositionPage] resolvePriceRange failed:', e);
        return null;
    }
}

export default async function PositionPage({ params }: Props) {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();

    if (!isAdmissibleSymbolShape(upper)) {
        notFound();
    }

    const { assetInfo, degraded } = await getAssetInfoResilient(upper);
    // degraded + digit-first 심볼 = 두 데이터 소스가 동시 다운 중이고 resolve 불가
    // → sibling 탭과 동일한 notFound 처리로 일관성 유지.
    if (isUnresolvableDegraded(upper, degraded)) notFound();
    if (!assetInfo) {
        notFound();
    }
    if (!(await isTabAllowedForSymbol(upper, 'position'))) notFound();

    const displayName = buildDisplayName(assetInfo, upper);
    const marketProfile = marketProfileOf(assetInfo);

    const range = await resolvePriceRange(
        upper,
        assetInfo.fmpSymbol,
        marketProfile
    );

    return (
        // `w-full`은 필수다: 이 <main>은 SymbolLayoutJail의 `flex flex-col` 컨테이너의
        // 직계 flex item이다. flex item에 `mx-auto`(양쪽 auto margin)를 걸면 cross-axis
        // stretch가 비활성화되고(CSS Flexbox §9.4 stretch 조건 = "neither margin is auto"),
        // width가 max-w-5xl까지 채워지는 대신 자식의 shrink-to-fit(콘텐츠 폭)로 줄어든다.
        // fundamental/overall은 콘텐츠(카드·표)가 우연히 1024px보다 넓어 이 버그가
        // 드러나지 않았을 뿐 — CTA 카드 하나뿐인 이 탭(비회원/미보유)이나 options/news
        // (동일 패턴으로 이미 `w-full` 적용됨)처럼 콘텐츠가 좁으면 <main> 전체가
        // shrink-wrap돼 heading까지 화면 중앙에 떠 보인다(데스크톱만 — 모바일은 available
        // width가 max-width보다 좁아 항상 꽉 채워지므로 증상이 없다). `w-full`로 width를
        // auto가 아닌 명시값(100%)으로 만들면 stretch 비활성 조건을 우회해 sibling과
        // 동일하게 max-w-5xl까지 채워진다.
        <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
            <SymbolPageHeading>{displayName} 내 위치</SymbolPageHeading>
            {/* JS 미실행 크롤러용 개요 — 개인화 데이터(★/수익률)는 전혀 포함하지 않는다.
                이 페이지는 항상 noindex이므로 SEO 신호 목적이 아니라 스크린리더
                문맥 보강용이다. */}
            <section className="sr-only">
                <h2>{displayName} 내 위치 개요</h2>
                <p>
                    {displayName}의 최근 가격 범위 안에서 회원님이 매수한 가격이
                    어디에 위치하는지 확인할 수 있는 개인화 페이지입니다.
                    로그인하고 보유종목을 등록하면 확인할 수 있어요.
                </p>
            </section>
            <PositionTabContent
                symbol={upper}
                low52w={range?.low52w ?? null}
                high52w={range?.high52w ?? null}
                lastClose={range?.lastClose ?? null}
                volumeByBand={range?.volumeByBand ?? null}
            />
        </main>
    );
}
