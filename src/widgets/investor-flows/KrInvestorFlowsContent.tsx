import { useTranslations } from 'next-intl';
import type {
    InvestorFlowsAxisId,
    InvestorFlowsScorecard,
    InvestorFlowsSnapshot,
} from '@y0ngha/siglens-core';
import type {
    InvestorFlowsPipelineReadiness,
    KrDisclosureCompany,
} from '@/entities/investor-flows/model';
import { isKrDisclosureCollecting } from '@/entities/investor-flows/lib/investorFlowsReadiness';
import { KrAsOfNotice } from './sections/KrAsOfNotice';
import { KrInsiderSection } from './sections/KrInsiderSection';
import { KrMajorHoldersSection } from './sections/KrMajorHoldersSection';
import { KrTradingPlansSection } from './sections/KrTradingPlansSection';
import { ScorecardCard } from './sections/ScorecardCard';

/** 한국 점수표가 그리는 축 — DART 원천이 있는 두 축(core가 KR 평가 결과를 이 슬롯에 넣는다, 설계 §4.4). */
const KR_SCORECARD_AXES: readonly InvestorFlowsAxisId[] = [
    'largeHolders',
    'insider',
];

interface KrInvestorFlowsContentProps {
    readonly snapshot: InvestorFlowsSnapshot;
    readonly scorecard: InvestorFlowsScorecard;
    /** 수집 파이프라인 준비 상태 — 한국은 `dart` 갈래만 본다(13F·FINRA 수집 중이 여기 뜨지 않는다). */
    readonly readiness: InvestorFlowsPipelineReadiness;
    /** DART 회사 매핑. 우선주면 보통주와 같은 공시라는 안내를 낸다. */
    readonly krCompany: KrDisclosureCompany | null;
}

/**
 * 한국 종목 수급 탭 본문(서버 렌더): 점수 카드(대량보유·임원 두 축) → 기준 시점·출처 → 대량보유(5%) → 임원·주요주주 → 거래계획.
 * AI 해석은 페이지가 이 본문 **아래**에 둔다(설계 §4.5 KR 레이아웃). 미국 전용 원천(13F·FINRA·SEC)은 한국에 없어 그 섹션을 그리지
 * 않고, 점수 카드가 "제공하지 않음"을 밝힌다. 순수 렌더라 데이터 fetch는 페이지가 한다.
 */
export function KrInvestorFlowsContent({
    snapshot,
    scorecard,
    readiness,
    krCompany,
}: KrInvestorFlowsContentProps) {
    const t = useTranslations('widgets.investor-flows');
    const kr = snapshot.kr ?? {
        majorHolders: [],
        insiders: [],
        tradingPlans: [],
    };
    const collecting = isKrDisclosureCollecting(readiness, snapshot);
    return (
        <>
            <ScorecardCard
                scorecard={scorecard}
                axes={KR_SCORECARD_AXES}
                collectingAxes={collecting ? KR_SCORECARD_AXES : []}
                note={t('kr.scorecardNote')}
            />
            <KrAsOfNotice
                freshness={scorecard.freshness}
                snapshotAsOf={snapshot.asOf}
                collecting={collecting}
                commonShareCorpName={
                    krCompany?.viaCommonShare === true
                        ? krCompany.corpName
                        : null
                }
            />
            <KrMajorHoldersSection
                reports={kr.majorHolders}
                collecting={collecting}
            />
            <KrInsiderSection reports={kr.insiders} collecting={collecting} />
            <KrTradingPlansSection
                plans={kr.tradingPlans}
                collecting={collecting}
            />
        </>
    );
}
