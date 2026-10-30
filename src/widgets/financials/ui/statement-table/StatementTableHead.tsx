/**
 * 재무제표 표의 머리글 행 — 지표 열과 기간 열들.
 */
import { useTranslations } from 'next-intl';

interface StatementTableHeadProps {
    columns: string[];
}

/** 첫 열은 "지표", 나머지는 과거→최신 기간 라벨이다. */
export function StatementTableHead({ columns }: StatementTableHeadProps) {
    const t = useTranslations('widgets.financials');
    return (
        <thead>
            <tr className="border-b border-secondary-700 text-xs tracking-[0.01em] text-secondary-400">
                <th scope="col" className="pb-2 text-left font-medium">
                    {t('StatementTable.0b5a2c')}
                </th>
                {columns.map(col => (
                    <th
                        key={col}
                        scope="col"
                        className="px-3 pb-2 text-right font-medium whitespace-nowrap"
                    >
                        {col}
                    </th>
                ))}
            </tr>
        </thead>
    );
}
