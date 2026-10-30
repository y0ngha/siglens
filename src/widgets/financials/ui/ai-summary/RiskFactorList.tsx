/**
 * AI 요약의 위험 요인 목록.
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';

interface RiskFactorListProps {
    risks: string[];
}

/** 위험 요인이 없으면 아무것도 그리지 않는다. 같은 문구가 겹칠 수 있어 key에 index를 넣는다. */
export function RiskFactorList({ risks }: RiskFactorListProps) {
    const t = useTranslations('widgets.financials');
    if (risks.length === 0) return null;

    return (
        <div>
            <h3 className={cn('mb-2', HEADING_SUBSECTION)}>
                {t('FinancialsAiSummary.af0480')}
            </h3>
            <ul className="space-y-1.5">
                {risks.map((risk, i) => (
                    <li
                        key={`risk-${i}-${risk}`}
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
