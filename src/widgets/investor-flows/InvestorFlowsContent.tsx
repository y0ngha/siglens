import type {
    InvestorFlowsScorecard,
    InvestorFlowsSnapshot,
} from '@y0ngha/siglens-core';
import { AsOfNotice } from './sections/AsOfNotice';
import { InsiderSection } from './sections/InsiderSection';
import { InstitutionalSection } from './sections/InstitutionalSection';
import { LargeHoldersSection } from './sections/LargeHoldersSection';
import { ScorecardCard } from './sections/ScorecardCard';
import { ShortSection } from './sections/ShortSection';
import { hasShortData } from './utils/short';

interface InvestorFlowsContentProps {
    readonly snapshot: InvestorFlowsSnapshot;
    readonly scorecard: InvestorFlowsScorecard;
    /** `FINRA_SHORT_DATA_ENABLED`. 꺼져 있으면 공매도 구간·FINRA 출처를 아예 그리지 않는다. */
    readonly finraEnabled: boolean;
}

/**
 * 수급 탭 본문(서버 렌더): 점수 카드 → 기준 시점·출처 → 기관 IN/OUT → 공매도 → 내부자 → 대량보유.
 *
 * FINRA 구간은 **플래그가 켜져 있고 데이터가 있을 때만** 그린다(라이선스 때문에 한 스위치로 끌 수 있어야 하고,
 * 꺼졌을 때 빈 껍데기·"데이터 없음" 문구도 남기지 않는다). 순수 렌더라 데이터 fetch는 페이지가 한다.
 */
export function InvestorFlowsContent({
    snapshot,
    scorecard,
    finraEnabled,
}: InvestorFlowsContentProps) {
    const showShort = hasShortData(
        finraEnabled,
        snapshot.shortInterest,
        snapshot.shortVolume
    );
    // 섹션 순서: 공매도를 기관 바로 다음에 둔다(내부자·대량보유보다 앞). 사용자가 "공매도·기관 IN/OUT은 UI로 확실히
    // 보여 달라"고 지시해(설계 §7) 두 구간을 점수 카드 직후 첫 화면 범위에 놓는 것이 의도다 — 데이터 크기
    // 순서(내부자·대량보유가 더 작다)에 맞춰 바꾸지 않는다.
    return (
        <>
            <ScorecardCard scorecard={scorecard} showShort={showShort} />
            <AsOfNotice
                freshness={scorecard.freshness}
                snapshotAsOf={snapshot.asOf}
                showShort={showShort}
            />
            <InstitutionalSection institutional={snapshot.institutional} />
            {showShort && (
                <ShortSection
                    shortInterest={snapshot.shortInterest}
                    shortVolume={snapshot.shortVolume}
                    floatShares={snapshot.floatShares}
                    scorecard={scorecard}
                />
            )}
            <InsiderSection
                transactions={snapshot.insider.transactions}
                scorecard={scorecard}
            />
            <LargeHoldersSection filings={snapshot.largeHolders} />
        </>
    );
}
