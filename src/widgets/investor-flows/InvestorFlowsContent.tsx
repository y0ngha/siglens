import type {
    InvestorFlowsScorecard,
    InvestorFlowsSnapshot,
} from '@y0ngha/siglens-core';
import type { InvestorFlowsPipelineReadiness } from '@/entities/investor-flows/model';
import { AsOfNotice } from './sections/AsOfNotice';
import { DilutionSection } from './sections/DilutionSection';
import { InsiderSection } from './sections/InsiderSection';
import { InstitutionalSection } from './sections/InstitutionalSection';
import { LargeHoldersSection } from './sections/LargeHoldersSection';
import { ScorecardCard } from './sections/ScorecardCard';
import { ShortSection } from './sections/ShortSection';
import { resolveCollectingArms } from '@/entities/investor-flows/lib/investorFlowsReadiness';
import { collectingAxes } from './utils/collecting';
import { hasShortData } from './utils/short';

interface InvestorFlowsContentProps {
    readonly snapshot: InvestorFlowsSnapshot;
    readonly scorecard: InvestorFlowsScorecard;
    /** `FINRA_SHORT_DATA_ENABLED`. 꺼져 있으면 FINRA 블록·FINRA 출처를 아예 그리지 않는다. */
    readonly finraEnabled: boolean;
    /** `REG_SHO_THRESHOLD_DATA_ENABLED`. 꺼져 있으면 과열 목록 배지·거래소 출처를 아예 그리지 않는다. */
    readonly regShoEnabled: boolean;
    /** 수집 파이프라인 준비 상태 — 빈 구간을 "데이터 없음"과 "수집 중"으로 가른다. */
    readonly readiness: InvestorFlowsPipelineReadiness;
}

/**
 * 수급 탭 본문(서버 렌더): 점수 카드 → 기준 시점·출처 → 기관 IN/OUT(+옵션) → 공매도(숏스퀴즈·FINRA·FTD·과열 목록) →
 * 내부자(Form 4·Form 144) → 증자·희석 공시 → 대량보유. AI 해석(`InvestorFlowsSummary`)은 이 본문 **위**, 탭 맨 위에 페이지가
 * 따로 둔다(제품 결정).
 *
 * 라이선스 플래그가 걸린 데이터는 **플래그가 켜져 있을 때만** 그린다 — FINRA 블록은 데이터도 있어야 하고, 과열 목록 배지는
 * Reg SHO 플래그를 따른다(꺼졌을 때 빈 껍데기·"데이터 없음" 문구도 남기지 않는다). 공매도 섹션 자체는 SEC 결제 불이행(FTD)이
 * 늘 들어가므로 항상 그린다. 순수 렌더라 데이터 fetch는 페이지가 한다.
 *
 * 초기 수집이 끝나기 전의 빈 구간은 "데이터 없음"/생략 대신 "모으는 중" 안내를 낸다(`resolveCollectingArms`) — 이 시점의 빈
 * 구간은 종목에 데이터가 없다는 뜻이 아니다. 준비가 끝났거나 상태를 못 읽으면 예전 동작 그대로다.
 */
export function InvestorFlowsContent({
    snapshot,
    scorecard,
    finraEnabled,
    regShoEnabled,
    readiness,
}: InvestorFlowsContentProps) {
    const showFinra = hasShortData(
        finraEnabled,
        snapshot.shortInterest,
        snapshot.shortVolume
    );
    const collecting = resolveCollectingArms({
        readiness,
        snapshot,
        finraEnabled,
        regShoEnabled,
    });
    // 공매도·기관 IN/OUT이 이 탭의 핵심 정보라 기관 바로 아래(내부자·대량보유보다 앞)에 둔다 — 섹션 크기 순으로
    // 재정렬하지 않는다.
    return (
        <>
            <ScorecardCard
                scorecard={scorecard}
                collectingAxes={collectingAxes(collecting)}
            />
            <AsOfNotice
                freshness={scorecard.freshness}
                snapshotAsOf={snapshot.asOf}
                showFinra={showFinra || collecting.short}
                thresholdAsOf={
                    regShoEnabled
                        ? (snapshot.thresholdList?.asOf ?? null)
                        : null
                }
                regShoEnabled={regShoEnabled}
                collecting={collecting}
            />
            <InstitutionalSection
                institutional={snapshot.institutional}
                metrics={scorecard.institutional.metrics}
                collecting={collecting.institutional}
            />
            <ShortSection
                snapshot={snapshot}
                scorecard={scorecard}
                finraEnabled={finraEnabled}
                regShoEnabled={regShoEnabled}
                collecting={collecting}
            />
            <InsiderSection
                transactions={snapshot.insider.transactions}
                proposedSales={snapshot.proposedSales}
                proposedSalesCollecting={collecting.proposedSales}
                scorecard={scorecard}
            />
            <DilutionSection
                filings={snapshot.offerings}
                scoringWindow={scorecard.freshness.dilutionWindow}
                collecting={collecting.offerings}
            />
            <LargeHoldersSection filings={snapshot.largeHolders} />
        </>
    );
}
