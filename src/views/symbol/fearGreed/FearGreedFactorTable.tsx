import { useTranslations } from 'next-intl';
import type { FearGreedFactorTable as FactorTableData } from './utils/fearGreedFacts';

interface FearGreedFactorTableProps {
    readonly table: FactorTableData;
}

/**
 * 5개 지표를 표 하나로. 기준(`과거 값(최대 약 5년)과 견준 퍼센타일`)은 캡션에 한 번만 적고, 해석은
 * 평소 범위(25~75 퍼센타일)를 벗어난 지표에만 한 문장으로 붙인다.
 */
export function FearGreedFactorTable({ table }: FearGreedFactorTableProps) {
    const t = useTranslations('views.symbol.fearGreedFacts');
    return (
        <div className="space-y-2">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[22rem] text-left text-sm text-secondary-300">
                    <caption className="pb-1.5 text-left text-xs text-secondary-400">
                        {t('factorTableCaption')}
                    </caption>
                    <thead className="text-xs text-secondary-400">
                        <tr>
                            <th scope="col" className="py-1.5 pr-3 font-medium">
                                {t('factorColName')}
                            </th>
                            <th scope="col" className="py-1.5 pr-3 font-medium">
                                {t('factorColValue')}
                            </th>
                            <th scope="col" className="py-1.5 pr-3 font-medium">
                                {t('factorColPercentile')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {table.rows.map(row => (
                            <tr
                                key={row.label}
                                className="border-t border-secondary-700"
                            >
                                <th
                                    scope="row"
                                    className="py-1.5 pr-3 font-medium text-secondary-200"
                                >
                                    {row.label}
                                </th>
                                <td className="py-1.5 pr-3 tabular-nums">
                                    {row.value}
                                </td>
                                <td className="py-1.5 pr-3 tabular-nums">
                                    {row.percentile}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="text-sm leading-6 text-secondary-300">
                {table.outliers.length === 0
                    ? t('factorAllInRange')
                    : t('factorOutliers', {
                          v0: table.outliers
                              .map(o =>
                                  t('factorOutlierItem', {
                                      v0: o.label,
                                      v1: t(
                                          o.level === 'high'
                                              ? 'factorHighShort'
                                              : 'factorLowShort'
                                      ),
                                  })
                              )
                              .join(t('clauseJoin')),
                      })}
            </p>
        </div>
    );
}
