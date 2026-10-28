/**
 * AI 요약의 축별 평가 목록 — 축 제목, 감성 배지, 근거 문장.
 */
import { useTranslations } from 'next-intl';
import type { FinancialsAxisAssessment } from '@y0ngha/siglens-core';
import { axisLabelKey } from '../../utils/axisLabels';
import { SentimentBadge } from './SentimentBadge';

interface AxisAssessmentListProps {
    assessments: FinancialsAxisAssessment[];
}

/**
 * 평가가 없으면 아무것도 그리지 않는다.
 *
 * `tLabel(axisLabelKey(...))`는 이 파일에서 번역자를 직접 호출해야 한다(`SentimentBadge`와 같은
 * extract.mjs 동적 키 탐지 사유).
 */
export function AxisAssessmentList({ assessments }: AxisAssessmentListProps) {
    const t = useTranslations('widgets.financials');
    const tLabel = useTranslations('shared.enumLabel');
    if (assessments.length === 0) return null;

    return (
        <ul
            aria-label={t('FinancialsAiSummary.4f0caa')}
            className="mb-5 space-y-3"
        >
            {assessments.map(a => (
                <li key={a.axis} className="rounded-lg bg-secondary-800/40 p-3">
                    <div className="mb-1 flex items-center gap-2">
                        <span className="text-sm font-medium">
                            {tLabel(axisLabelKey(a.axis))}
                        </span>
                        <SentimentBadge
                            sentiment={a.sentiment}
                            sizeClassName="px-1.5 py-0.5"
                        />
                    </div>
                    <p className="text-sm leading-relaxed text-secondary-400">
                        {a.rationaleKo}
                    </p>
                </li>
            ))}
        </ul>
    );
}
