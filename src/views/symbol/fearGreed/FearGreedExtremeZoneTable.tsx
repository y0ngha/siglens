import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import type { ExtremeZoneTable } from './utils/fearGreedFacts';

interface FearGreedExtremeZoneTableProps {
    readonly table: ExtremeZoneTable;
}

/**
 * 극심한 공포·극심한 탐욕 구간 **진입 이후** 종가 변화의 과거 집계(siglens-core#252).
 *
 * 서버 렌더 본문이다 — 크롤러가 JS 없이 표를 읽는다. 숫자는 core
 * `summarizeExtremeZoneOutcomes`가 만들고, 이 컴포넌트는 그리기만 한다.
 *
 * 투자 권유로 읽히지 않게(사용자 지시 2026-10-05):
 *  - 집계 기간과 "과거 사후 집계이며 예측·권유가 아니다"라는 고지를 **표와 같은
 *    블록에서 항상** 보인다. 표만 떼어 읽히는 경로가 없다.
 *  - 평균·승률 대신 중앙값과 표본 수만 보이고, 표본이 기준 미만인 칸은 숫자 대신
 *    "표본 부족"으로 둔다.
 *  - 진입이 한 번도 없으면 표 대신 그 사실만 한 줄로 적는다.
 */
export function FearGreedExtremeZoneTable({
    table,
}: FearGreedExtremeZoneTableProps) {
    const t = useTranslations('views.symbol.fearGreedFacts');
    const headingId = useId();
    const period = t('extremeZonePeriod', { v0: table.from, v1: table.to });

    return (
        <div aria-labelledby={headingId} role="group" className="space-y-2">
            <h3 id={headingId} className={HEADING_SUBSECTION}>
                {t('extremeZoneTitle')}
            </h3>
            <p className="text-sm leading-6 text-secondary-300">{period}</p>
            {table.rows.length === 0 ? (
                <p className="text-sm leading-6 text-secondary-300">
                    {t('extremeZoneNone')}
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[28rem] text-left text-sm text-secondary-300">
                        <caption className="sr-only">
                            {t('extremeZoneCaption')}
                        </caption>
                        <thead className="text-xs text-secondary-400">
                            <tr>
                                <th
                                    scope="col"
                                    className="py-1.5 pr-3 font-medium"
                                >
                                    {t('extremeZoneColZone')}
                                </th>
                                <th
                                    scope="col"
                                    className="py-1.5 pr-3 font-medium"
                                >
                                    {t('extremeZoneColEntries')}
                                </th>
                                {table.horizons.map(horizon => (
                                    <th
                                        key={horizon}
                                        scope="col"
                                        className="py-1.5 pr-3 font-medium"
                                    >
                                        {t('extremeZoneColHorizon', {
                                            v0: horizon,
                                        })}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {table.rows.map(row => (
                                <tr
                                    key={row.zone}
                                    className="border-t border-secondary-700"
                                >
                                    <th
                                        scope="row"
                                        className="py-1.5 pr-3 font-medium text-secondary-200"
                                    >
                                        {row.label}
                                    </th>
                                    <td className="py-1.5 pr-3 tabular-nums">
                                        {t('extremeZoneEntries', {
                                            v0: row.entryCount,
                                        })}
                                    </td>
                                    {row.cells.map(cell => (
                                        <td
                                            key={cell.horizon}
                                            className="py-1.5 pr-3 tabular-nums"
                                        >
                                            {cell.median === null
                                                ? t('extremeZoneInsufficient', {
                                                      v0: cell.sampleSize,
                                                  })
                                                : t('extremeZoneCell', {
                                                      v0: cell.median,
                                                      v1: cell.sampleSize,
                                                  })}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <p className="text-xs leading-5 text-secondary-400">
                {t('extremeZoneNotice')}
            </p>
        </div>
    );
}
