import { useTranslations } from 'next-intl';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { TrendLineChart } from '../charts/TrendLineChart';
import { FlowTooltip } from '../investorFlowsTooltips';
import {
    formatInteger,
    formatMonthDay,
    formatPercent,
} from '../utils/flowFormat';
import type { ShortVolumeMarker, ShortVolumeSeries } from '../utils/short';

type MarkerKey = NonNullable<ShortVolumeMarker> | 'normal';

const MARKER_MARK: Record<MarkerKey, string> = {
    surge: '▲',
    drop: '▼',
    normal: '■',
};

const MARKER_CLASS: Record<MarkerKey, string> = {
    surge: 'bg-ui-warning/10 text-ui-warning-text',
    drop: 'bg-secondary-700 text-secondary-200',
    normal: 'bg-secondary-700 text-secondary-300',
};

interface ShortVolumeBlockProps {
    /** 마지막 거래일의 비중을 계산할 수 있는 시계열(부모가 거른다). */
    readonly series: ShortVolumeSeries;
    /** core의 z-score 신호에서 온 급증/급감 표식. 신호가 없으면 `null`(평소 수준). */
    readonly marker: ShortVolumeMarker;
}

/** 일별 장외(TRF) 공매도 비중 라인 + 평균 점선 + 급증/급감 표식 + "장외 보고분 기준" 각주. */
export function ShortVolumeBlock({ series, marker }: ShortVolumeBlockProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const latest = series.latest;
    if (latest === null || latest.ratio === null) return null;
    const markerKey: MarkerKey = marker ?? 'normal';
    const markerLabels: Record<MarkerKey, string> = {
        surge: t('short.markerSurge'),
        drop: t('short.markerDrop'),
        normal: t('short.markerNormal'),
    };
    const percents = series.rows.map(row =>
        row.ratio === null ? null : row.ratio * 100
    );
    const finite = percents.filter((v): v is number => v !== null);
    const average = series.average === null ? null : series.average * 100;
    const bounds = average === null ? finite : [...finite, average];
    return (
        <div>
            <h3 className={cn('mb-1', HEADING_SUBSECTION)}>
                {t('short.volumeTitle')}
                <FlowTooltip term="offExchangeShortRatio" />
            </h3>
            <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-secondary-200">
                <span className="tabular-nums">
                    {t('short.volumeLatest', {
                        date: latest.date,
                        pct: formatPercent(latest.ratio * 100, locale, 1),
                    })}
                </span>
                <span
                    className={cn(
                        'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium',
                        MARKER_CLASS[markerKey]
                    )}
                >
                    <span aria-hidden="true">{MARKER_MARK[markerKey]}</span>
                    {markerLabels[markerKey]}
                </span>
            </p>
            {series.rows.length > 1 && (
                <TrendLineChart
                    values={percents}
                    average={average}
                    ariaLabel={t('short.volumeAria', {
                        count: series.rows.length,
                    })}
                    maxLabel={formatPercent(Math.max(...bounds), locale, 0)}
                    minLabel={formatPercent(Math.min(...bounds), locale, 0)}
                    startLabel={formatMonthDay(series.rows[0].date)}
                    endLabel={formatMonthDay(latest.date)}
                />
            )}
            {average !== null && (
                <p className="mt-2 text-xs text-secondary-400">
                    {t('short.volumeAverage', {
                        days: formatInteger(series.rows.length, locale),
                        pct: formatPercent(average, locale, 1),
                    })}
                </p>
            )}
            <p className="mt-1 text-xs text-secondary-400">
                {t('short.volumeFootnote')}
            </p>
        </div>
    );
}
