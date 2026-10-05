import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { METHODOLOGY_PATH } from '@/shared/lib/legal';
import { LocaleLink } from '@/shared/ui/LocaleLink';
import type {
    ExtremeZoneRecord,
    ExtremeZoneSection,
} from './utils/fearGreedFacts';

interface FearGreedExtremeZoneRecordProps {
    readonly record: ExtremeZoneRecord;
}

/**
 * 극심한 공포·극심한 탐욕 구간에 **언제 들어가 얼마나 머물렀는지**의 기록
 * (siglens-core#256).
 *
 * 서버 렌더 본문이다 — 크롤러가 JS 없이 표를 읽는다. 기록은 core
 * `summarizeExtremeZoneEpisodes`가 만들고, 이 컴포넌트는 그리기만 한다.
 *
 * 투자 권유로 읽히지 않게(사용자 지시 2026-10-05):
 *  - 진입 뒤 수익률은 보이지 않는다. 날짜·머문 거래일·극값 점수 같은 기록만 둔다.
 *  - 집계 기간과 "과거 기록이며 예측·권유가 아니다"라는 고지를 **표와 같은 블록에서
 *    항상** 보인다. 표만 떼어 읽히는 경로가 없다.
 *  - 진입이 한 번도 없으면 표 대신 그 사실만 한 줄로 적는다.
 */
export function FearGreedExtremeZoneRecord({
    record,
}: FearGreedExtremeZoneRecordProps) {
    const t = useTranslations('views.symbol.fearGreedFacts');
    const headingId = useId();
    // 같은 구간으로 다시 들어온 날을 한 기록으로 묶는 기준(재진입 간격)은 `/methodology`가
    // 설명한다 — 모든 종목 페이지에서 같은 문장이 반복되지 않게 링크로 대신한다.
    const period = t('extremeZonePeriod', {
        v0: record.from,
        v1: record.to,
    });

    return (
        <div aria-labelledby={headingId} role="group" className="space-y-2">
            <h3 id={headingId} className={HEADING_SUBSECTION}>
                {t('extremeZoneTitle')}
            </h3>
            <p className="text-sm leading-6 text-secondary-300">
                {period}{' '}
                <LocaleLink
                    href={`${METHODOLOGY_PATH}#fear-greed`}
                    prefetch={false}
                    className="inline-flex min-h-11 items-center rounded text-secondary-300 underline underline-offset-2 hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    {t('extremeZoneMethodLink')}
                </LocaleLink>
            </p>
            {record.sections.length === 0 ? (
                <p className="text-sm leading-6 text-secondary-300">
                    {t('extremeZoneNone')}
                </p>
            ) : (
                record.sections.map(section => (
                    <ExtremeZoneSectionTable
                        key={section.zone}
                        section={section}
                    />
                ))
            )}
            <p className="text-xs leading-5 text-secondary-400">
                {t('extremeZoneNotice')}
            </p>
        </div>
    );
}

interface ExtremeZoneSectionTableProps {
    readonly section: ExtremeZoneSection;
}

function ExtremeZoneSectionTable({ section }: ExtremeZoneSectionTableProps) {
    const t = useTranslations('views.symbol.fearGreedFacts');
    const peakHeader =
        section.zone === 'EXTREME_FEAR'
            ? t('extremeZoneColPeakFear')
            : t('extremeZoneColPeakGreed');

    return (
        <div className="space-y-1">
            <p className="text-sm leading-6 font-medium text-secondary-200">
                {t('extremeZoneSummary', {
                    v0: section.label,
                    v1: section.entryCount,
                    v2: section.medianSessions,
                })}
            </p>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[24rem] text-left text-sm text-secondary-300">
                    <caption className="sr-only">
                        {t('extremeZoneCaption', { v0: section.label })}
                    </caption>
                    <thead className="text-xs text-secondary-400">
                        <tr>
                            <th scope="col" className="py-1.5 pr-3 font-medium">
                                {t('extremeZoneColStart')}
                            </th>
                            <th scope="col" className="py-1.5 pr-3 font-medium">
                                {t('extremeZoneColEnd')}
                            </th>
                            <th scope="col" className="py-1.5 pr-3 font-medium">
                                {t('extremeZoneColSessions')}
                            </th>
                            <th scope="col" className="py-1.5 pr-3 font-medium">
                                {peakHeader}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {section.rows.map(row => (
                            <tr
                                key={row.startDate}
                                className="border-t border-secondary-700"
                            >
                                <th
                                    scope="row"
                                    className="py-1.5 pr-3 font-medium text-secondary-200"
                                >
                                    {row.startDate}
                                </th>
                                <td className="py-1.5 pr-3">
                                    {row.ongoing
                                        ? t('extremeZoneOngoing', {
                                              v0: row.endDate,
                                          })
                                        : row.endDate}
                                </td>
                                <td className="py-1.5 pr-3 tabular-nums">
                                    {t('extremeZoneSessions', {
                                        v0: row.sessions,
                                    })}
                                </td>
                                <td className="py-1.5 pr-3 tabular-nums">
                                    {row.peakScore ?? t('extremeZoneNoScore')}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {section.omittedCount > 0 && (
                <p className="text-xs leading-5 text-secondary-400">
                    {t('extremeZoneOmitted', { v0: section.omittedCount })}
                </p>
            )}
        </div>
    );
}
