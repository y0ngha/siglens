import { useTranslations } from 'next-intl';
import {
    INVESTOR_FLOWS_AXES,
    type InvestorFlowsAxisId,
    type InvestorFlowsLabel,
    type InvestorFlowsMarket,
    type InvestorFlowsScorecard,
} from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import {
    HEADING_SECTION,
    HEADING_SUBSECTION,
} from '@/shared/lib/typographyStyles';
import { SURFACE_CARD, SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { FlowTooltip, type FlowTerm } from '../investorFlowsTooltips';
import { buildAxisEvidence } from '../utils/axisEvidence';
import { axisTitleKey } from '../utils/axisKeys';
import { formatSignedDecimal } from '../utils/flowFormat';
import {
    COLLECTING_MARK,
    LABEL_CLASS,
    LABEL_KEY,
    LABEL_MARK,
} from '../utils/scorecardLabels';

const HEADING_ID = 'flows-scorecard-heading';

/** 축 제목 옆 용어 풀이. */
const AXIS_TERM: Record<InvestorFlowsAxisId, FlowTerm> = {
    institutional: 'institutionalHolding',
    insider: 'form4',
    largeHolders: 'largeHolder13dg',
    short: 'shortInterest',
    dilution: 'dilution',
};

/** 한국 점수표의 축 풀이 — DART 대량보유·임원·주요주주 소유보고(13D/G·Form 4가 아니다). */
const KR_AXIS_TERM: Partial<Record<InvestorFlowsAxisId, FlowTerm>> = {
    insider: 'krInsider',
    largeHolders: 'krMajorHolder',
};

function axisTerm(
    axis: InvestorFlowsAxisId,
    market: InvestorFlowsMarket
): FlowTerm {
    return (
        (market === 'kr' ? KR_AXIS_TERM[axis] : undefined) ?? AXIS_TERM[axis]
    );
}

function LabelBadge({
    label,
    collecting = false,
}: {
    readonly label: InvestorFlowsLabel;
    /** 초기 수집 중인 축 — "데이터 부족" 대신 "수집 중"을 말한다(중립도, 부족도 아니다). */
    readonly collecting?: boolean;
}) {
    // 동적 키는 하위 네임스페이스 번역자로만 부른다 — 파일 전체 네임스페이스가 클라이언트에 실리지 않게.
    const tLabel = useTranslations('widgets.investor-flows.label');
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium',
                LABEL_CLASS[label]
            )}
        >
            <span aria-hidden="true">
                {collecting ? COLLECTING_MARK : LABEL_MARK[label]}
            </span>
            {collecting ? tLabel('collecting') : tLabel(LABEL_KEY[label])}
        </span>
    );
}

function AxisCard({
    axis,
    scorecard,
    collecting,
}: {
    readonly axis: InvestorFlowsAxisId;
    readonly scorecard: InvestorFlowsScorecard;
    readonly collecting: boolean;
}) {
    const t = useTranslations('widgets.investor-flows');
    const tAxis = useTranslations('widgets.investor-flows.axis');
    const tEv = useTranslations('widgets.investor-flows.ev');
    const locale = useResolvedLocale();
    const data = scorecard[axis];
    const lines = buildAxisEvidence(scorecard, axis, locale);
    return (
        <li className={cn(SURFACE_NESTED, 'p-4')}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className={HEADING_SUBSECTION}>
                    {tAxis(axisTitleKey(axis, scorecard.market))}
                    <FlowTooltip term={axisTerm(axis, scorecard.market)} />
                </h3>
                <LabelBadge label={data.label} collecting={collecting} />
            </div>
            {data.score !== null && (
                <p className="mt-2 text-sm text-secondary-200 tabular-nums">
                    {t('scorecard.axisScore', {
                        score: formatSignedDecimal(data.score, locale, 0),
                    })}
                </p>
            )}
            {data.sufficiency === 'insufficient' ? (
                <p className="mt-2 text-sm text-secondary-400">
                    {collecting
                        ? t('scorecard.axisCollecting')
                        : t('scorecard.axisInsufficient')}
                </p>
            ) : (
                <ul className="mt-2 space-y-1 text-sm text-secondary-300">
                    {lines.map(line => (
                        <li key={line.id}>{tEv(line.id, line.values)}</li>
                    ))}
                </ul>
            )}
        </li>
    );
}

interface ScorecardCardProps {
    readonly scorecard: InvestorFlowsScorecard;
    /**
     * 초기 수집이 끝나지 않아 비어 있는 축. 이 축은 "데이터 부족" 대신 "수집 중"으로 표시한다. 데이터가 있어 점수가
     * 매겨진 축은 목록에 있어도 영향이 없다(`insufficient`일 때만 바뀐다).
     */
    readonly collectingAxes?: readonly InvestorFlowsAxisId[];
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
 * 끝나지 않아 비어 있는 축(`collectingAxes`)은 "수집 중"이라고 말한다.
 */
export function ScorecardCard({
    scorecard,
    collectingAxes = [],
    axes = INVESTOR_FLOWS_AXES,
    note,
}: ScorecardCardProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const { composite } = scorecard;
    const collectingSet = new Set(collectingAxes);
    return (
        <section
            aria-labelledby={HEADING_ID}
            className={cn(SURFACE_CARD, 'p-6')}
        >
            <h2 id={HEADING_ID} className={cn('mb-4', HEADING_SECTION)}>
                {t('scorecard.title')}
                <FlowTooltip
                    term={
                        scorecard.market === 'kr' ? 'krFlowScore' : 'flowScore'
                    }
                />
            </h2>
            <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
                {composite.score === null ? (
                    <p className="text-sm text-secondary-300">
                        {t('scorecard.compositeInsufficient')}
                    </p>
                ) : (
                    <>
                        <p className="font-mono text-4xl font-semibold text-secondary-100 tabular-nums">
                            {formatSignedDecimal(composite.score, locale, 1)}
                        </p>
                        <div className="space-y-1">
                            <LabelBadge label={composite.label} />
                            <p className="text-xs text-secondary-400">
                                {t('scorecard.compositeCaption', {
                                    count: composite.axesUsed.length,
                                })}
                            </p>
                        </div>
                    </>
                )}
            </div>
            <ul className="grid gap-3 md:grid-cols-2">
                {axes.map(axis => (
                    <AxisCard
                        key={axis}
                        axis={axis}
                        scorecard={scorecard}
                        collecting={
                            collectingSet.has(axis) &&
                            scorecard[axis].sufficiency === 'insufficient'
                        }
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
