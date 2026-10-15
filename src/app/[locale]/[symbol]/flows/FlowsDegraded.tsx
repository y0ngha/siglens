import { useTranslations } from 'next-intl';
import { SymbolDegradedShell } from '@/app/[locale]/[symbol]/SymbolDegradedShell';

interface FlowsDegradedProps {
    /** Resolved display name (Korean+English+ticker, or bare-ticker fallback). */
    displayName: string;
    symbol: string;
}

/**
 * 수급 데이터 저장소(DB·FMP)가 일시적으로 응답하지 않을 때(`getInvestorFlowsResilient`가 `degraded: true`)
 * 렌더하는 화면.
 *
 * "데이터 없음"은 degrade가 아니다. 신규 상장·소형주처럼 수급 데이터가 정말 없는 종목은 정상 페이지의 빈 상태
 * (`InvestorFlowsEmpty`)로 렌더되고, 인프라 장애만 이 soft-200 화면이 된다. 이 탭은 `generateMetadata`가 항상
 * noindex라(`ALWAYS_NOINDEX_TAB_ROBOTS`) degrade 여부로 메타를 따로 가르지 않는다 — 어느 쪽이든 색인되지 않는다. `FundamentalDegraded`처럼 `<h1>` 하나와 형제 탭 링크는 남겨 둔다.
 */
export function FlowsDegraded({ displayName, symbol }: FlowsDegradedProps) {
    const t = useTranslations('app.symbol');
    return (
        <SymbolDegradedShell
            heading={t('flows.heading', { v0: displayName })}
            noticeTitle={t('flows.degradedTitle')}
            noticeBody={t('flows.degradedBody')}
            symbol={symbol}
            current="flows"
        >
            {null}
        </SymbolDegradedShell>
    );
}
