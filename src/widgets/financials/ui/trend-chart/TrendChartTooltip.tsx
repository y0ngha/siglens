/**
 * 추세 차트의 호버 판독 툴팁 — 호버한 기간의 시리즈별 값을 보여 준다.
 */
import type { CSSProperties } from 'react';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { seriesColorClasses } from '../../utils/trendChartColors';
import type { TrendSeries } from '../../utils/trendChartTypes';
import type { StatementCurrency } from '../../utils/statementCurrency';
import { formatStatementValue } from '../../utils/statementFormat';
import type { TooltipPosition } from '../../utils/tooltipPosition';

interface TrendChartTooltipProps {
    series: TrendSeries[];
    periodLabel: string;
    periodIdx: number;
    position: TooltipPosition;
    currency: StatementCurrency;
}

/**
 * 마우스 전용 점진적 향상이다. 트리거(히트 영역)가 `aria-hidden` SVG 안이라 보조기술이 닿지
 * 못하고, `role="tooltip"`은 노출이 전제인 역할이라 `aria-hidden`과 모순되므로 쓰지 않는다.
 * 같은 수치는 아래 StatementTable에서 읽을 수 있고, 테스트는 `data-testid`로 조회한다.
 *
 * 점 색은 막대와 같은 조회(`seriesColorClasses`)를 쓴다 — 선언한 색 그대로다.
 */
export function TrendChartTooltip({
    series,
    periodLabel,
    periodIdx,
    position,
    currency,
}: TrendChartTooltipProps) {
    const locale = useResolvedLocale();
    return (
        <div
            data-testid="chart-tooltip"
            aria-hidden="true"
            className="pointer-events-none fixed top-[var(--tip-top)] left-[var(--tip-left)] z-50 rounded-lg border border-secondary-600 bg-secondary-900 px-3 py-2 text-xs shadow-lg"
            style={
                {
                    '--tip-left': `${position.left}px`,
                    '--tip-top': `${position.top}px`,
                } as CSSProperties
            }
        >
            <div className="mb-1 font-medium text-secondary-300">
                {periodLabel}
            </div>
            <ul className="space-y-0.5">
                {series.map(s => (
                    <li
                        key={s.labelKo}
                        className="flex items-center justify-between gap-3"
                    >
                        <span className="flex items-center gap-1">
                            <span
                                className={cn(
                                    'inline-block h-2 w-2 rounded-full',
                                    seriesColorClasses(s.color).dot
                                )}
                            />
                            <span className="text-secondary-400">
                                {s.labelKo}
                            </span>
                        </span>
                        <span className="font-mono tabular-nums">
                            {formatStatementValue(
                                s.values[periodIdx] ?? null,
                                'usd',
                                currency,
                                locale
                            )}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
