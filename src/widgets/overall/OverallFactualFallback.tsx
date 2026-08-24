import {
    getDescriptor,
    type MarketProfileId,
} from '@/shared/config/marketProfile';
import type { NewsDisplayItem } from '@/shared/lib/types';

export interface OverallFactualFallbackProps {
    symbol: string;
    displayName: string;
    marketProfile: MarketProfileId;
    newsItems: readonly NewsDisplayItem[];
}

/**
 * 이 컴포넌트는 `overall/page.tsx`의 Suspense fallback으로 렌더되어 JS 없이
 * 접근하는 크롤러가 그대로 읽는 SSR HTML이다(`OverallContent`가 client
 * 컴포넌트라 non-JS 크롤러에게는 fallback이 사실상 최종 콘텐츠다). `assetClass`
 * 이진 분류(equity/crypto)만으로 축 문구를 고르면 한국 개별주식(assetClass는
 * 'equity'지만 옵션 탭이 없음, `KR_EQUITY_DESCRIPTOR.tabs` 참고)에도 미국
 * 주식과 동일하게 "옵션"을 언급해, 존재하지 않는 옵션 분석을 크롤러에게
 * 약속하게 된다(SEO 감사 2026-08-18) — `marketProfile`로 descriptor의
 * 실제 tabs whitelist를 물어 옵션 탭 존재 여부를 판정한다.
 */
function getAxesText(marketProfile: MarketProfileId): string {
    const descriptor = getDescriptor(marketProfile);
    if (descriptor.assetClass === 'crypto') {
        return '차트, 뉴스, 공포 탐욕 지수';
    }

    if (descriptor.tabs.includes('options')) {
        return '차트, 뉴스, 펀더멘털, 옵션, 공포 탐욕 지수';
    }

    return '차트, 뉴스, 펀더멘털, 공포 탐욕 지수';
}

export function OverallFactualFallback({
    symbol,
    displayName,
    marketProfile,
    newsItems,
}: OverallFactualFallbackProps) {
    const headingId = 'overall-factual-fallback-heading';
    const analyzedNewsCount = newsItems.filter(
        item => item.sentiment !== null
    ).length;

    return (
        <section
            aria-labelledby={headingId}
            className="rounded-lg border border-secondary-700 bg-secondary-800 p-5"
        >
            <h2 id={headingId} className="text-lg font-semibold tracking-tight">
                {displayName} 종합 분석 데이터 상태
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-secondary-300">
                <p>
                    {displayName} ({symbol}) 종합 분석은{' '}
                    {getAxesText(marketProfile)}를 함께 봅니다.
                </p>
                {newsItems.length > 0 ? (
                    <p>
                        현재 서버가 확인한 최근 뉴스는 {newsItems.length}건이며,
                        이 중 {analyzedNewsCount}건은 AI 뉴스 카드 분석이
                        완료됐습니다.
                    </p>
                ) : (
                    <p>
                        최근 뉴스 데이터는 아직 준비되지 않았습니다. 뉴스 카드가
                        분석되면 종합 분석의 뉴스 축 상태도 함께 반영됩니다.
                    </p>
                )}
                <p>
                    종합 AI 결론이 아직 캐시되지 않았습니다. 분석 결과가
                    준비되면 강세, 중립, 약세 시나리오와 위험 요인이 이 영역에
                    표시됩니다.
                </p>
            </div>
        </section>
    );
}
