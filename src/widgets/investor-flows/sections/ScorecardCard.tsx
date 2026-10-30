/**
 * 수급 점수 카드 — 종합 점수와 축별 카드를 묶는 섹션.
 */
import { useTranslations } from 'next-intl';
import {
    INVESTOR_FLOWS_AXES,
    type InvestorFlowsAxisId,
    type InvestorFlowsScorecard,
} from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { FlowTooltip } from '../investorFlowsTooltips';
import { COMPOSITE_TERM } from '../utils/axisTerm';
import { resolveAxisGap } from '../utils/scorecardGap';
import { AxisCard } from '../ui/scorecard/AxisCard';
import { CompositeScore } from '../ui/scorecard/CompositeScore';

const HEADING_ID = 'flows-scorecard-heading';

interface ScorecardCardProps {
    readonly scorecard: InvestorFlowsScorecard;
    /**
     * 초기 수집이 끝나지 않아 비어 있는 축. 이 축은 "데이터 부족" 대신 "수집 중"으로 표시한다. 데이터가 있어 점수가
     * 매겨진 축은 목록에 있어도 영향이 없다(`insufficient`일 때만 바뀐다).
     */
    readonly collectingAxes?: readonly InvestorFlowsAxisId[];
    /**
     * FMP 일시 오류로 이번에만 원천이 빈 축(`snapshot.degraded`). `insufficient`일 때만 "데이터 부족" 대신 "일시적으로 불러오지
     * 못했어요"로 표시한다. 수집 중(`collectingAxes`)이 먼저다 — 그쪽은 이 종목의 원천 자체가 아직 비어 있다는 뜻이다.
     */
    readonly unavailableAxes?: readonly InvestorFlowsAxisId[];
    /** 그릴 축(순서대로). 기본은 다섯 축 전부 — 한국 점수표는 DART 원천이 있는 두 축만 넘긴다. */
    readonly axes?: readonly InvestorFlowsAxisId[];
    /** 축 목록 아래 안내 한 줄(한국: 제공하지 않는 축·기관·외국인 순매수 미제공). */
    readonly note?: string;
}

/**
 * 수급 점수 카드 — 종합 점수와 축별(기관·내부자·대량보유·공매도·증자 희석) 방향 라벨, 각 근거 수치.
 *
 * 미국 종목은 축 카드 다섯 개를 모두 그린다(`axes` 기본값) — 공매도 축은 FINRA가 꺼져도 SEC 결제 불이행·과열 목록을 중립
 * 맥락으로 담고, 데이터가 없으면 "데이터 부족"이라고 말한다(빈 카드로 숨기지 않는다). 한국 종목은 DART 원천이 있는 대량보유·
 * 임원·주요주주 두 축만 그리고, 원천이 없는 축은 `note`로 "제공하지 않음"을 밝힌다(core도 그 축을 `insufficient`로 준다).
 *
 * 점수·라벨은 core의 `evaluateInvestorFlows` 결과를 그대로 옮긴다(화면이 다시 계산하지 않는다). 방향은
 * 색 + 기호(▲▼■) + 글자 라벨 세 겹으로 전하고, 데이터가 부족한 축은 "데이터 부족"이라고 말한다(중립이 아니다). 초기 수집이
 * 끝나지 않아 비어 있는 축(`collectingAxes`)은 "수집 중"이라고 말한다. 한국 축이 보고는 있는데 모두 채점 창 밖이면(core
 * `krMetrics.reports === 0`·`latestReceiptDate`) "데이터 부족"이 아니라 "최근 N일 공시 없음(최신 접수일 …)"이라고 말한다.
 */
export function ScorecardCard({
    scorecard,
    collectingAxes = [],
    unavailableAxes = [],
    axes = INVESTOR_FLOWS_AXES,
    note,
}: ScorecardCardProps) {
    const t = useTranslations('widgets.investor-flows');
    const collectingSet = new Set(collectingAxes);
    const unavailableSet = new Set(unavailableAxes);
    // 시장별 제목은 리터럴 번역 호출로 만들어 두고 시장으로 고른다(추출기가 키를 볼 수 있게).
    const titles = {
        us: t('scorecard.title'),
        kr: t('scorecard.krTitle'),
    } as const;
    return (
        <section
            aria-labelledby={HEADING_ID}
            className={cn(SURFACE_CARD, 'p-6')}
        >
            <h2 id={HEADING_ID} className={cn('mb-4', HEADING_SECTION)}>
                {titles[scorecard.market]}
                <FlowTooltip term={COMPOSITE_TERM[scorecard.market]} />
            </h2>
            <CompositeScore composite={scorecard.composite} />
            <ul className="grid gap-3 md:grid-cols-2">
                {axes.map(axis => (
                    <AxisCard
                        key={axis}
                        axis={axis}
                        scorecard={scorecard}
                        gap={resolveAxisGap(
                            scorecard,
                            axis,
                            collectingSet,
                            unavailableSet
                        )}
                    />
                ))}
            </ul>
            {note !== undefined && (
                <p className="mt-4 text-xs leading-relaxed text-secondary-300">
                    {note}
                </p>
            )}
        </section>
    );
}
