import type {
    EarningsCalendarItem,
    EarningsReport,
} from '@y0ngha/siglens-core';

function formatDate(dateStr: string): string {
    return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).format(new Date(dateStr));
}

function formatCurrency(value: number | null): string {
    if (value === null) return '—';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
    }).format(value);
}

interface EarningsCalendarCardProps {
    item: EarningsCalendarItem;
}

function EarningsCalendarCard({ item }: EarningsCalendarCardProps) {
    return (
        <div className="border-secondary-700 bg-secondary-800 rounded-lg border p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">다음 어닝 발표</h3>
                <time
                    dateTime={item.earningsDate}
                    className="text-secondary-400 text-sm tabular-nums"
                >
                    {formatDate(item.earningsDate)}
                </time>
            </div>
            {(item.epsEstimated !== null || item.revenueEstimated !== null) && (
                <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
                    {item.epsEstimated !== null && (
                        <>
                            <dt className="text-secondary-400">EPS 예상</dt>
                            <dd className="font-medium tabular-nums">
                                {formatCurrency(item.epsEstimated)}
                            </dd>
                        </>
                    )}
                    {item.revenueEstimated !== null && (
                        <>
                            <dt className="text-secondary-400">매출 예상</dt>
                            <dd className="font-medium tabular-nums">
                                {new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: 'USD',
                                    notation: 'compact',
                                    maximumFractionDigits: 1,
                                }).format(item.revenueEstimated)}
                            </dd>
                        </>
                    )}
                </dl>
            )}
        </div>
    );
}

interface LatestEarningsCardProps {
    report: EarningsReport;
}

function LatestEarningsCard({ report }: LatestEarningsCardProps) {
    return (
        <div className="border-secondary-700 bg-secondary-800 rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">최근 어닝 발표</h3>
                <time
                    dateTime={report.earningsDate}
                    className="text-secondary-400 text-sm tabular-nums"
                >
                    {formatDate(report.earningsDate)}
                </time>
            </div>
        </div>
    );
}

interface EventCalendarProps {
    nextEarnings: EarningsCalendarItem | null;
    latestReport: EarningsReport | null;
}

export function EventCalendar({
    nextEarnings,
    latestReport,
}: EventCalendarProps) {
    if (nextEarnings === null && latestReport === null) {
        return null;
    }

    return (
        <section aria-labelledby="event-calendar-heading" className="space-y-3">
            <h2
                id="event-calendar-heading"
                className="text-lg font-semibold tracking-tight"
            >
                어닝 일정
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {nextEarnings !== null && (
                    <EarningsCalendarCard item={nextEarnings} />
                )}
                {latestReport !== null && (
                    <LatestEarningsCard report={latestReport} />
                )}
            </div>
        </section>
    );
}
