import { useTranslations } from 'next-intl';
import {
    INVESTOR_FLOWS_AXES,
    type InvestorFlowsAxisId,
    type InvestorFlowsLabel,
    type InvestorFlowsScorecard,
} from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import {
    HEADING_SECTION,
    HEADING_SUBSECTION,
} from '@/shared/lib/typographyStyles';
import { SURFACE_CARD, SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { FlowTooltip } from '../investorFlowsTooltips';
import { buildAxisEvidence } from '../utils/axisEvidence';
import { AXIS_TITLE_KEY } from '../utils/axisKeys';
import { formatSignedDecimal } from '../utils/flowFormat';
import { LABEL_CLASS, LABEL_KEY, LABEL_MARK } from '../utils/scorecardLabels';

const HEADING_ID = 'flows-scorecard-heading';

/** 축 제목 옆 용어 풀이. */
const AXIS_TERM = {
    institutional: 'institutionalHolding',
    insider: 'form4',
    largeHolders: 'largeHolder13dg',
    short: 'shortInterest',
} as const;

function LabelBadge({ label }: { readonly label: InvestorFlowsLabel }) {
    // 동적 키는 하위 네임스페이스 번역자로만 부른다 — 파일 전체 네임스페이스가 클라이언트에 실리지 않게.
    const tLabel = useTranslations('widgets.investor-flows.label');
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium',
                LABEL_CLASS[label]
            )}
        >
            <span aria-hidden="true">{LABEL_MARK[label]}</span>
            {tLabel(LABEL_KEY[label])}
        </span>
    );
}

function AxisCard({
    axis,
    scorecard,
}: {
    readonly axis: InvestorFlowsAxisId;
    readonly scorecard: InvestorFlowsScorecard;
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
                    {tAxis(AXIS_TITLE_KEY[axis])}
                    <FlowTooltip term={AXIS_TERM[axis]} />
                </h3>
                <LabelBadge label={data.label} />
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
                    {t('scorecard.axisInsufficient')}
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
    /** 공매도 구간을 화면에 그릴 때만 true — 아니면 공매도 축 카드도 그리지 않는다(빈 카드 대신 생략). */
    readonly showShort: boolean;
}

/**
 * 수급 점수 카드 — 종합 점수와 축별(기관·내부자·대량보유·공매도) 방향 라벨, 각 근거 수치.
 *
 * 점수·라벨은 core의 `evaluateInvestorFlows` 결과를 그대로 옮긴다(화면이 다시 계산하지 않는다). 방향은
 * 색 + 기호(▲▼■) + 글자 라벨 세 겹으로 전하고, 데이터가 부족한 축은 "데이터 부족"이라고 말한다(중립이 아니다).
 */
export function ScorecardCard({ scorecard, showShort }: ScorecardCardProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const { composite } = scorecard;
    const axes = INVESTOR_FLOWS_AXES.filter(
        axis => showShort || axis !== 'short'
    );
    return (
        <section
            aria-labelledby={HEADING_ID}
            className={cn(SURFACE_CARD, 'p-6')}
        >
            <h2 id={HEADING_ID} className={cn('mb-4', HEADING_SECTION)}>
                {t('scorecard.title')}
                <FlowTooltip term="flowScore" />
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
                    <AxisCard key={axis} axis={axis} scorecard={scorecard} />
                ))}
            </ul>
        </section>
    );
}
