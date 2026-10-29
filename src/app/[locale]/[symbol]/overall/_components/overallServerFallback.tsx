import type { ReactNode } from 'react';

import type { OverallPeekResult } from '@/app/[locale]/[symbol]/overall/_lib/overallPeek';
import type { SymbolNewsListItems } from '@/app/[locale]/[symbol]/_lib/symbolNewsList';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import { OverallFactsSummary } from '@/widgets/overall/OverallFactsSummary';
import { OverallFactualFallback } from '@/widgets/overall/OverallFactualFallback';

interface OverallServerFallbackInput {
    /** 스냅샷 산문이 이미 같은 분석을 그리는가 — 그러면 fallback은 비운다(중복 방지). */
    readonly showSnapshotProse: boolean;
    readonly cachedOverall: OverallPeekResult;
    readonly symbol: string;
    readonly displayName: string;
    readonly marketProfile: MarketProfileId;
    readonly newsItems: SymbolNewsListItems;
}

/**
 * 종합 탭 `OverallContent` 경계의 fallback 내용 — 스냅샷 산문 → 엿본 캐시 분석 → 사실 placeholder
 * 순으로 하나만 고른다.
 *
 * 컴포넌트가 아니라 엘리먼트를 돌려주는 함수다: 페이지가 그대로 `fallback`에 꽂아 중간 컴포넌트 층이
 * 생기지 않는다 — fallback 트리를 직접 검사하는 페이지 테스트가 고른 위젯을 그대로 찾는다.
 */
export function overallServerFallback({
    showSnapshotProse,
    cachedOverall,
    symbol,
    displayName,
    marketProfile,
    newsItems,
}: OverallServerFallbackInput): ReactNode {
    if (showSnapshotProse) return null;
    if (cachedOverall) {
        return <OverallFactsSummary symbol={symbol} analysis={cachedOverall} />;
    }
    return (
        <OverallFactualFallback
            displayName={displayName}
            marketProfile={marketProfile}
            newsItems={newsItems}
        />
    );
}
