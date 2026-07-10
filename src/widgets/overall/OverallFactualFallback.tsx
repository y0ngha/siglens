import type { AssetClass } from '@/shared/config/marketProfile';
import type { NewsDisplayItem } from '@/shared/lib/types';

export interface OverallFactualFallbackProps {
    symbol: string;
    displayName: string;
    assetClass: AssetClass;
    newsItems: readonly NewsDisplayItem[];
}

function getAxesText(assetClass: AssetClass): string {
    if (assetClass === 'crypto') {
        return '차트, 뉴스, 공포 탐욕 지수';
    }

    return '차트, 뉴스, 펀더멘털, 옵션, 공포 탐욕 지수';
}

export function OverallFactualFallback({
    symbol,
    displayName,
    assetClass,
    newsItems,
}: OverallFactualFallbackProps) {
    const headingId = 'overall-factual-fallback-heading';
    const analyzedNewsCount = newsItems.filter(
        item => item.sentiment !== null
    ).length;

    return (
        <section
            aria-labelledby={headingId}
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-5"
        >
            <h2 id={headingId} className="text-lg font-semibold tracking-tight">
                {displayName} 종합 분석 데이터 상태
            </h2>
            <div className="text-secondary-300 mt-3 space-y-3 text-sm leading-relaxed">
                <p>
                    {displayName} ({symbol}) 종합 분석은{' '}
                    {getAxesText(assetClass)}를 함께 봅니다.
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
