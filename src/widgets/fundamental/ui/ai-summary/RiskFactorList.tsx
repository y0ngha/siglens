/**
 * AI 요약의 리스크 요인 불릿 목록.
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';

interface RiskFactorListProps {
    risks: readonly string[];
}

/** 리스크 문장을 불릿으로 나열한다. 비어 있으면 제목까지 그리지 않는다. */
export function RiskFactorList({ risks }: RiskFactorListProps) {
    const t = useTranslations('widgets.fundamental');
    if (risks.length === 0) return null;

    return (
        <div>
            <h3 className={cn('mb-2', HEADING_SUBSECTION)}>
                {t('FundamentalAiSummary.af0480')}
            </h3>
            <ul className="space-y-1.5">
                {risks.map((risk, index) => (
                    <li
                        // LLM 출력은 같은 문장을 반복할 수 있어 문장만으로는 키가 겹친다.
                        key={`${index}-${risk}`}
                        className="flex gap-2 text-sm text-secondary-400"
                    >
                        <span aria-hidden="true" className="mt-0.5 shrink-0">
                            •
                        </span>
                        {risk}
                    </li>
                ))}
            </ul>
        </div>
    );
}
