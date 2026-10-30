/**
 * 추세 차트 범례 — 시리즈가 둘 이상이면 색 점과 이름, 하나면 이름만 보인다.
 */
import { cn } from '@/shared/lib/cn';
import { seriesColorClasses } from '../../utils/trendChartColors';
import type { TrendSeries } from '../../utils/trendChartTypes';

interface TrendChartLegendProps {
    series: TrendSeries[];
}

/** 시리즈 수에 따라 색 범례 또는 단일 제목을 그린다. */
export function TrendChartLegend({ series }: TrendChartLegendProps) {
    if (series.length === 1) {
        return (
            <div className="mb-1">
                <span className="text-xs text-secondary-400">
                    {series[0].labelKo}
                </span>
            </div>
        );
    }

    return (
        <div className="mb-2 flex flex-wrap gap-3">
            {series.map(s => (
                <div key={s.labelKo} className="flex items-center gap-1">
                    <span
                        className={cn(
                            'inline-block h-2 w-2 rounded-full',
                            seriesColorClasses(s.color).legend
                        )}
                    />
                    <span className="text-xs text-secondary-400">
                        {s.labelKo}
                    </span>
                </div>
            ))}
        </div>
    );
}
