import type {
    InvestorFlowsScorecard,
    InvestorFlowsSnapshot,
} from '@y0ngha/siglens-core';
import type { InvestorFlowsPipelineReadiness } from '@/entities/investor-flows/model';
import { AsOfNotice } from './sections/AsOfNotice';
import { InsiderSection } from './sections/InsiderSection';
import { InstitutionalSection } from './sections/InstitutionalSection';
import { LargeHoldersSection } from './sections/LargeHoldersSection';
import { ScorecardCard } from './sections/ScorecardCard';
import { ShortCollectingSection } from './sections/ShortCollectingSection';
import { ShortSection } from './sections/ShortSection';
import { resolveCollectingArms } from '@/entities/investor-flows/lib/investorFlowsReadiness';
import { collectingAxes } from './utils/collecting';
import { hasShortData } from './utils/short';

interface InvestorFlowsContentProps {
    readonly snapshot: InvestorFlowsSnapshot;
    readonly scorecard: InvestorFlowsScorecard;
    /** `FINRA_SHORT_DATA_ENABLED`. 꺼져 있으면 공매도 구간·FINRA 출처를 아예 그리지 않는다. */
    readonly finraEnabled: boolean;
    /** 13F·FINRA 수집 파이프라인 준비 상태 — 빈 구간을 "데이터 없음"과 "수집 중"으로 가른다. */
    readonly readiness: InvestorFlowsPipelineReadiness;
}

/**
 * 수급 탭 본문(서버 렌더): 점수 카드 → 기준 시점·출처 → 기관 IN/OUT → 공매도 → 내부자 → 대량보유.
 * AI 해석(`InvestorFlowsSummary`)은 이 본문 **위**, 탭 맨 위에 페이지가 따로 둔다(제품 결정).
 *
 * FINRA 구간은 **플래그가 켜져 있고 데이터가 있을 때만** 그린다(라이선스 때문에 한 스위치로 끌 수 있어야 하고,
 * 꺼졌을 때 빈 껍데기·"데이터 없음" 문구도 남기지 않는다). 순수 렌더라 데이터 fetch는 페이지가 한다.
 *
 * 단, 초기 수집이 끝나기 전의 빈 13F·공매도 구간은 "데이터 없음"/생략 대신 "모으는 중" 안내를 낸다
 * (`resolveCollectingArms`) — 이 시점의 빈 구간은 종목에 데이터가 없다는 뜻이 아니다. 준비가 끝났거나 상태를 못 읽으면
 * 예전 동작 그대로다.
 */
export function InvestorFlowsContent({
    snapshot,
    scorecard,
    finraEnabled,
    readiness,
}: InvestorFlowsContentProps) {
    const showShort = hasShortData(
        finraEnabled,
        snapshot.shortInterest,
        snapshot.shortVolume
    );
    const collecting = resolveCollectingArms({
        readiness,
        institutional: snapshot.institutional,
        shortInterest: snapshot.shortInterest,
        shortVolume: snapshot.shortVolume,
        finraEnabled,
    });
    // 공매도·기관 IN/OUT이 이 탭의 핵심 정보라 기관 바로 아래(내부자·대량보유보다 앞)에 둔다 — 섹션 크기 순으로
    // 재정렬하지 않는다.
    return (
        <>
            <ScorecardCard
                scorecard={scorecard}
                showShort={showShort || collecting.short}
                collectingAxes={collectingAxes(collecting)}
            />
            <AsOfNotice
                freshness={scorecard.freshness}
                snapshotAsOf={snapshot.asOf}
                showShort={showShort || collecting.short}
                institutionalCollecting={collecting.institutional}
                shortCollecting={collecting.short}
            />
            <InstitutionalSection
                institutional={snapshot.institutional}
                collecting={collecting.institutional}
            />
            {showShort ? (
                <ShortSection
                    shortInterest={snapshot.shortInterest}
                    shortVolume={snapshot.shortVolume}
                    floatShares={snapshot.floatShares}
                    scorecard={scorecard}
                />
            ) : (
                collecting.short && <ShortCollectingSection />
            )}
            <InsiderSection
                transactions={snapshot.insider.transactions}
                scorecard={scorecard}
            />
            <LargeHoldersSection filings={snapshot.largeHolders} />
        </>
    );
}
