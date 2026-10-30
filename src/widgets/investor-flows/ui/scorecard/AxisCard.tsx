/**
 * 점수표의 축 카드 한 장 — 축 제목·방향 배지·점수와, 채점됐으면 근거 줄 / 아니면 부족 사유 문구.
 */
import { useTranslations } from 'next-intl';
import type {
    InvestorFlowsAxisId,
    InvestorFlowsScorecard,
} from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { FlowTooltip } from '../../investorFlowsTooltips';
import { buildAxisEvidence } from '../../utils/axisEvidence';
import { krNoReportsInWindow } from '../../utils/axis-evidence/krWindow';
import { axisTerm } from '../../utils/axisTerm';
import { axisTitleKey } from '../../utils/axisKeys';
import { formatSignedDecimal } from '../../utils/flowFormat';
import type { AxisGap } from '../../utils/scorecardGap';
import { LabelBadge } from './LabelBadge';

/** 축 점수의 소수 자리 — 축 점수는 정수로 보인다. */
const AXIS_SCORE_DIGITS = 0;

interface AxisCardProps {
    readonly axis: InvestorFlowsAxisId;
    readonly scorecard: InvestorFlowsScorecard;
    /** 수집 중·일시 오류 사유. 한국 창 밖 보고는 여기서 따로 판정한다. */
    readonly gap: AxisGap | null;
}

/**
 * 수집 중·일시 오류가 먼저다 — 그때는 창 밖 보고만 보인다는 것도 아직 확정이 아니다. 둘 다 아니고 한국 축에 창 안 보고가 없으면
 * "최근 N일 공시 없음"으로 말한다.
 */
export function AxisCard({ axis, scorecard, gap }: AxisCardProps) {
    const t = useTranslations('widgets.investor-flows');
    const tAxis = useTranslations('widgets.investor-flows.axis');
    const tEv = useTranslations('widgets.investor-flows.ev');
    const locale = useResolvedLocale();
    const data = scorecard[axis];
    const noReports =
        gap === null ? krNoReportsInWindow(scorecard, axis, locale) : null;
    const shownGap: AxisGap | null =
        noReports === null ? gap : 'noRecentReports';
    // 부족 사유별 문구 — 리터럴 번역 호출로 만들어 두고 사유로 고른다(추출기가 키를 볼 수 있게).
    const insufficientTexts: Record<AxisGap | 'none', string> = {
        collecting: t('scorecard.axisCollecting'),
        unavailable: t('scorecard.axisUnavailable'),
        noRecentReports:
            noReports === null
                ? ''
                : t('scorecard.axisNoRecentReports', {
                      days: noReports.days,
                      date: noReports.latestReceiptDate,
                  }),
        none: t('scorecard.axisInsufficient'),
    };
    return (
        <li className={cn(SURFACE_NESTED, 'p-4')}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className={HEADING_SUBSECTION}>
                    {tAxis(axisTitleKey(axis, scorecard.market))}
                    <FlowTooltip term={axisTerm(axis, scorecard.market)} />
                </h3>
                <LabelBadge label={data.label} gap={shownGap} />
            </div>
            {data.score !== null && (
                <p className="mt-2 text-sm text-secondary-200 tabular-nums">
                    {t('scorecard.axisScore', {
                        score: formatSignedDecimal(
                            data.score,
                            locale,
                            AXIS_SCORE_DIGITS
                        ),
                    })}
                </p>
            )}
            {data.sufficiency === 'insufficient' ? (
                <p className="mt-2 text-sm text-secondary-400">
                    {insufficientTexts[shownGap ?? 'none']}
                </p>
            ) : (
                <ul className="mt-2 space-y-1 text-sm text-secondary-300">
                    {buildAxisEvidence(scorecard, axis, locale).map(line => (
                        <li key={line.id}>{tEv(line.id, line.values)}</li>
                    ))}
                </ul>
            )}
        </li>
    );
}
