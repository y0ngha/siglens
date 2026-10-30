import { isKrDisclosureCollecting } from '@/entities/investor-flows/lib/investorFlowsReadiness';
import type { InvestorFlowsScorecardResult } from '@/entities/investor-flows/server/getInvestorFlowsScorecard';
import { InvestorFlowsContent } from '@/widgets/investor-flows/InvestorFlowsContent';
import { InvestorFlowsEmpty } from '@/widgets/investor-flows/InvestorFlowsEmpty';
import { InvestorFlowsSummary } from '@/widgets/investor-flows/InvestorFlowsSummary';
import { KrInvestorFlowsContent } from '@/widgets/investor-flows/KrInvestorFlowsContent';

interface FlowsTabBodyProps {
    /** degrade가 아닌 수급 조회 결과(`getInvestorFlowsScorecard`). */
    readonly flows: InvestorFlowsScorecardResult;
    /** 대문자 티커. */
    readonly symbol: string;
    /** 한국 상장 종목 — DART 지분공시 레이아웃을 쓴다. */
    readonly krListing: boolean;
}

/**
 * 수급 탭 본문 — 데이터 없음(빈 상태) / 한국 레이아웃 / 미국 레이아웃 중 하나. 데이터가 없는 종목은
 * AI를 부르지 않는다.
 *
 * - 한국은 DART 백필 상태만 본다 — 13F·FINRA가 수집 중이어도 "수집 중"이 뜨지 않는다. 표를 먼저
 *   읽고 해석을 보게 점수 → 기준 시점·출처 → 대량보유 → 임원·주요주주 → 거래계획 → AI 해석 순이다.
 * - 미국은 AI 해석을 맨 위에 둔다(제품 결정 — 데이터 표보다 결론을 먼저 보게 한다). 스트림이 오기
 *   전에는 `InvestorFlowsSummary`가 결과와 비슷한 높이를 예약해 아래 점수 카드가 밀리지 않는다.
 */
export function FlowsTabBody({ flows, symbol, krListing }: FlowsTabBodyProps) {
    const {
        snapshot,
        scorecard,
        finraEnabled,
        regShoEnabled,
        readiness,
        krCompany,
    } = flows;
    if (snapshot === null || scorecard === null) {
        return krListing ? (
            <InvestorFlowsEmpty
                market="kr"
                collecting={isKrDisclosureCollecting(readiness, null)}
            />
        ) : (
            <InvestorFlowsEmpty
                collecting={readiness.institutional === 'collecting'}
                shortCollecting={
                    finraEnabled && readiness.short === 'collecting'
                }
            />
        );
    }
    if (krListing) {
        return (
            <>
                <KrInvestorFlowsContent
                    snapshot={snapshot}
                    scorecard={scorecard}
                    readiness={readiness}
                    krCompany={krCompany}
                />
                <InvestorFlowsSummary symbol={symbol} />
            </>
        );
    }
    return (
        <>
            <InvestorFlowsSummary symbol={symbol} />
            <InvestorFlowsContent
                snapshot={snapshot}
                scorecard={scorecard}
                finraEnabled={finraEnabled}
                regShoEnabled={regShoEnabled}
                readiness={readiness}
            />
        </>
    );
}
