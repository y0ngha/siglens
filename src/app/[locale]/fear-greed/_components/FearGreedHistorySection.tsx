import {
    FEAR_GREED_LOOKBACK_DAYS,
    type FearGreedReading,
} from '@y0ngha/siglens-core';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { scoredReadings } from '@/entities/market-fear-greed/lib/publishableHistory';
import { fearGreedDataPath } from '@/shared/config/fearGreedData';
import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import { cn } from '@/shared/lib/cn';
import { sentimentLabelText } from '@/shared/lib/fearGreedLabels';
import type { FearGreedMarketId } from '@/shared/lib/marketFearGreedLabels';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import {
    HEADING_SECTION,
    HEADING_SUBSECTION,
} from '@/shared/lib/typographyStyles';
import { LazyFearGreedHistoricalChart } from '@/widgets/fear-greed/LazyFearGreedHistoricalChart';
import { isoDateParts } from '@/widgets/market-fear-greed/utils/isoDateParts';
import {
    chartHistory,
    historyCoverage,
    MONTHLY_ROWS_OPEN,
    monthlyHistoryRows,
    RECENT_HISTORY_ROWS,
    recentHistoryRows,
    type MonthlyHistoryRow,
    type RecentHistoryRow,
} from '../_lib/marketFearGreedHistoryRows';

/** 5년 창을 "N년"으로 말할 때의 연 단위 일수. 창 길이는 core 상수가 정한다(I18N.md#I18-6). */
const DAYS_PER_YEAR = 365;

/**
 * 셀·행 클래스는 행마다 되풀이하지 않고 표에서 자손 선택자로 한 번만 준다. 월별 표는 운영에서
 * 50여 행이라 행당 클래스 반복이 HTML과 RSC 페이로드에 두 번 실린다.
 * 폭은 `max-w-2xl`로 막아 넓은 화면에서 열이 멀리 벌어지지 않게 한다.
 */
const TABLE_BASE =
    'w-full max-w-2xl text-left text-sm text-secondary-300 [&_td]:py-1.5 [&_td]:pr-3 [&_td]:tabular-nums [&_th]:py-1.5 [&_th]:pr-3 [&_th]:font-medium [&_tbody_th]:text-secondary-200 [&_tbody_tr]:border-t [&_tbody_tr]:border-secondary-700';
/** 월별 표는 네 열이 모두 숫자 문구라 좁은 화면에서는 가로 스크롤이 맞다. */
const MONTHLY_TABLE_CLASS = `${TABLE_BASE} min-w-[22rem] [&_td]:whitespace-nowrap`;
const HEAD_CLASS = 'text-xs text-secondary-400';
const DOWNLOAD_LINK_CLASS =
    'inline-flex min-h-11 items-center rounded underline underline-offset-2 hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

interface FearGreedHistorySectionProps {
    readonly market: FearGreedMarketId;
    /** 표 캡션의 주어(`copy.answerSubject`, 예: "미국 증시"). */
    readonly subject: string;
    /** 숫자 서식(부호 표시)에 쓰는 로케일. 훅이 아니라 prop이다(`FearGreedRouteBody`). */
    readonly locale: Locale;
    /** 허브 뷰의 기록. 호출부가 `hasPublishableHistory`를 통과시킨 뒤 넘긴다. */
    readonly history: readonly FearGreedReading[];
    /** 극단 구간 기록(`FearGreedExtremeZoneRecord`). 없으면 생략. */
    readonly extremeZone: ReactNode;
}

/** `YYYY-MM-DD`를 "{year}년 {month}월 {day}일" 문장으로. 카탈로그가 어순을 정한다. */
function useDateText(): (iso: string) => string {
    const t = useTranslations('app.fear-greed.history');
    return iso => {
        const { year, month, day } = isoDateParts(iso);
        return t('date', { year, month, day });
    };
}

/**
 * 시장 허브의 "지난 점수 기록" 카드. 추이 차트, 최근 거래일 표, 월별 표, 내려받기 링크와
 * 극단 구간 기록을 한 카드에 담는다.
 *
 * 서버 컴포넌트다. 차트는 캔버스라 글자가 없으므로, 크롤러·스크린리더가 읽는 숫자는 모두
 * 표에서 나온다. 클라이언트(차트)로 가는 건 마지막 252점뿐이고 전체 기록은 서버 HTML에만 있다.
 * 점수에는 색을 입히지 않는다(DS-15) — 구간은 글자로 말한다.
 */
export function FearGreedHistorySection({
    market,
    subject,
    locale,
    history,
    extremeZone,
}: FearGreedHistorySectionProps) {
    const t = useTranslations('app.fear-greed.history');
    const dateText = useDateText();
    const scored = scoredReadings(history);
    const coverage = historyCoverage(scored);
    const chartPoints = chartHistory(scored);
    const monthly = monthlyHistoryRows(scored);
    const monthlyOpen = monthly.slice(0, MONTHLY_ROWS_OPEN);
    const monthlyOlder = monthly.slice(MONTHLY_ROWS_OPEN);

    return (
        <div className="page-container mt-6">
            <section
                aria-labelledby="market-fear-greed-history-heading"
                className={cn('space-y-6 p-5', SURFACE_CARD)}
            >
                <div className="space-y-2">
                    <h2
                        id="market-fear-greed-history-heading"
                        className={HEADING_SECTION}
                    >
                        {t('title')}
                    </h2>
                    <p className="text-sm leading-6 text-secondary-300">
                        {t('coverage', {
                            from: dateText(coverage.from),
                            to: dateText(coverage.to),
                            count: coverage.count,
                        })}
                    </p>
                    <p className="text-sm leading-6 text-secondary-400">
                        {t('recalcNote', {
                            years: Math.round(
                                FEAR_GREED_LOOKBACK_DAYS / DAYS_PER_YEAR
                            ),
                        })}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-3 text-sm leading-6 text-secondary-300">
                        <span>{t('downloadLead')}</span>
                        <a
                            href={fearGreedDataPath(market, 'csv')}
                            download
                            className={DOWNLOAD_LINK_CLASS}
                        >
                            {t('downloadCsv')}
                        </a>
                        <a
                            href={fearGreedDataPath(market, 'json')}
                            download
                            className={DOWNLOAD_LINK_CLASS}
                        >
                            {t('downloadJson')}
                        </a>
                    </p>
                    <p className="text-xs leading-5 text-secondary-400">
                        {t('downloadNote')}
                    </p>
                </div>

                <div className="space-y-2">
                    <h3 className={HEADING_SUBSECTION}>{t('chartTitle')}</h3>
                    <p className="text-xs text-secondary-400">
                        {t('chartRange', {
                            from: dateText(chartPoints.at(0)?.date ?? ''),
                            to: dateText(chartPoints.at(-1)?.date ?? ''),
                        })}
                    </p>
                    <LazyFearGreedHistoricalChart history={chartPoints} />
                </div>

                <div className="space-y-2">
                    <h3 className={HEADING_SUBSECTION}>
                        {market === 'crypto'
                            ? t('recentTitleDaily', {
                                  count: RECENT_HISTORY_ROWS,
                              })
                            : t('recentTitle', { count: RECENT_HISTORY_ROWS })}
                    </h3>
                    <RecentTable
                        market={market}
                        subject={subject}
                        locale={locale}
                        rows={recentHistoryRows(scored)}
                    />
                </div>

                <div className="space-y-2">
                    <h3 className={HEADING_SUBSECTION}>{t('monthlyTitle')}</h3>
                    <MonthlyTable
                        caption={t('monthlyCaption', { subject })}
                        rows={monthlyOpen}
                        firstDate={coverage.from}
                    />
                    {monthlyOlder.length > 0 && (
                        <details className="group">
                            {/* 접기 어포던스는 `SnapshotProseDisclosure`와 같다 — 열리면 45° 도는 `+`. */}
                            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded text-sm text-secondary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                                {t('monthlyMore', {
                                    count: monthlyOlder.length,
                                })}
                                <span
                                    aria-hidden="true"
                                    className="text-secondary-400 transition-transform group-open:rotate-45 motion-reduce:transition-none"
                                >
                                    +
                                </span>
                            </summary>
                            <div className="mt-2">
                                <MonthlyTable
                                    caption={t('monthlyCaptionOlder', {
                                        subject,
                                    })}
                                    rows={monthlyOlder}
                                    firstDate={coverage.from}
                                />
                            </div>
                        </details>
                    )}
                </div>

                {extremeZone}
            </section>
        </div>
    );
}

interface RecentTableProps {
    readonly market: FearGreedMarketId;
    readonly subject: string;
    readonly locale: Locale;
    readonly rows: readonly RecentHistoryRow[];
}

function RecentTable({ market, subject, locale, rows }: RecentTableProps) {
    const t = useTranslations('app.fear-greed.history');
    const tLabel = useTranslations('shared.enumLabel');
    const dateText = useDateText();
    // 부호는 로케일이 정한다. 0은 부호 없이 "0".
    // 암호화폐는 쉬는 날 없이 매일 거래해 "거래일"이 아니라 "일"이다. 카탈로그 키는 문장마다
    // 따로 두고(I18-14) 시장으로 고른다.
    const isDaily = market === 'crypto';
    const changeFormat = new Intl.NumberFormat(INTL_LOCALE[locale], {
        signDisplay: 'exceptZero',
    });

    return (
        <div className="overflow-x-auto">
            <table className={TABLE_BASE}>
                <caption className="sr-only">
                    {isDaily
                        ? t('recentCaptionDaily', {
                              subject,
                              count: RECENT_HISTORY_ROWS,
                          })
                        : t('recentCaption', {
                              subject,
                              count: RECENT_HISTORY_ROWS,
                          })}
                </caption>
                <thead className={HEAD_CLASS}>
                    <tr>
                        <th scope="col">{t('colDate')}</th>
                        <th scope="col">{t('colScore')}</th>
                        <th scope="col">{t('colLabel')}</th>
                        <th scope="col">
                            {isDaily ? t('colChangeDaily') : t('colChange')}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => (
                        <tr key={row.date}>
                            <th scope="row">
                                <time dateTime={row.date}>
                                    {dateText(row.date)}
                                </time>
                            </th>
                            <td>{row.score}</td>
                            <td>{sentimentLabelText(row.label, tLabel)}</td>
                            <td>
                                {row.change === null
                                    ? ''
                                    : changeFormat.format(row.change)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

interface MonthlyTableProps {
    readonly caption: string;
    readonly rows: readonly MonthlyHistoryRow[];
    /** 기록의 첫 날짜. 첫 달이 일부만 담겼다는 표시("n일부터")에 쓴다. */
    readonly firstDate: string;
}

function MonthlyTable({ caption, rows, firstDate }: MonthlyTableProps) {
    const t = useTranslations('app.fear-greed.history');
    const tLabel = useTranslations('shared.enumLabel');

    const monthText = (row: MonthlyHistoryRow): string => {
        const { year, month } = isoDateParts(`${row.month}-01`);
        if (row.partial === 'end') {
            return t('monthUntil', {
                year,
                month,
                day: isoDateParts(row.last.date).day,
            });
        }
        if (row.partial === 'start') {
            return t('monthFrom', {
                year,
                month,
                day: isoDateParts(firstDate).day,
            });
        }
        return t('month', { year, month });
    };

    return (
        <div className="overflow-x-auto">
            <table className={MONTHLY_TABLE_CLASS}>
                <caption className="sr-only">{caption}</caption>
                <thead className={HEAD_CLASS}>
                    <tr>
                        <th scope="col">{t('colMonth')}</th>
                        <th scope="col">{t('colMonthLast')}</th>
                        <th scope="col">{t('colLow')}</th>
                        <th scope="col">{t('colHigh')}</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => (
                        <tr key={row.month}>
                            <th scope="row">
                                <time dateTime={row.month}>
                                    {monthText(row)}
                                </time>
                            </th>
                            <td>
                                {t('monthLastCell', {
                                    score: row.last.score,
                                    label: sentimentLabelText(
                                        row.last.label,
                                        tLabel
                                    ),
                                })}
                            </td>
                            <td>
                                {t('extremeCell', {
                                    score: row.low.score,
                                    day: isoDateParts(row.low.date).day,
                                })}
                            </td>
                            <td>
                                {t('extremeCell', {
                                    score: row.high.score,
                                    day: isoDateParts(row.high.date).day,
                                })}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
