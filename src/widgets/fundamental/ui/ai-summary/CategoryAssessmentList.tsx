/**
 * AI 요약의 카테고리별 평가 목록.
 */
import { useTranslations } from 'next-intl';
import type { FundamentalCategoryAssessment } from '@y0ngha/siglens-core';
import { CATEGORY_LABEL_KEY } from '@/widgets/fundamental/utils/categoryLabelKey';
import { SentimentBadge } from './SentimentBadge';

interface CategoryAssessmentListProps {
    assessments: readonly FundamentalCategoryAssessment[];
}

/**
 * 카테고리 이름·감성 배지·근거를 행으로 나열한다. 평가가 없으면 아무것도 그리지 않는다.
 *
 * `tLabel(CATEGORY_LABEL_KEY[...])`는 이 파일에서 직접 호출한다(동적 키 탐지 조건 —
 * `SentimentBadge` 참고).
 */
export function CategoryAssessmentList({
    assessments,
}: CategoryAssessmentListProps) {
    const t = useTranslations('widgets.fundamental');
    const tLabel = useTranslations('shared.enumLabel');
    if (assessments.length === 0) return null;

    return (
        <ul
            aria-label={t('FundamentalAiSummary.74f3b1')}
            className="mb-5 space-y-3"
        >
            {assessments.map((a, index) => (
                <li
                    // LLM 출력은 같은 카테고리를 반복할 수 있어 카테고리만으로는 키가 겹친다.
                    key={`${a.category}-${index}`}
                    className="rounded-lg bg-secondary-800/40 p-3"
                >
                    <div className="mb-1 flex items-center gap-2">
                        <span className="text-sm font-medium">
                            {tLabel(CATEGORY_LABEL_KEY[a.category])}
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
