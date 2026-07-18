import { PositionTabContent } from '@/widgets/portfolio-position';
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
import { buildTechnicalFacts } from '@/views/symbol/utils/technicalFacts';
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
        return {
            low52w: facts.low52w,
            high52w: facts.high52w,
            lastClose: facts.lastClose,
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
        <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
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
            />
        </main>
    );
}
