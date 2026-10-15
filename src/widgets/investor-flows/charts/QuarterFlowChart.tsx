import { useTranslations } from 'next-intl';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { formatPeriodShort, formatSignedCompact } from '../utils/flowFormat';
import type { FlowDirection, QuarterBar } from '../utils/institutional';

/** 막대 영역 높이(px). 위·아래(IN·OUT) 각각 이 값의 절반을 최대로 쓴다. */
const CHART_HEIGHT = 112;
const HALF = CHART_HEIGHT / 2;
/** 막대가 너무 얇아져 사라지지 않게 하는 최소 높이(px). 0이 아닌 값에만 적용된다. */
const MIN_BAR = 3;

const DIRECTION_TEXT_CLASS: Record<FlowDirection, string> = {
    in: 'text-ui-success-text',
    out: 'text-ui-danger-text',
    flat: 'text-secondary-300',
};

const DIRECTION_FILL_CLASS: Record<FlowDirection, string> = {
    in: 'fill-chart-bullish',
    out: 'fill-chart-bearish',
    flat: 'fill-secondary-500',
};

interface QuarterFlowChartProps {
    readonly bars: readonly QuarterBar[];
}

/**
 * 분기별 기관 순매수(IN, 위로)·순매도(OUT, 아래로) 막대 — inline SVG.
 *
 * 방향을 **색 + 막대 방향 + 부호 + 글자(IN/OUT)** 네 겹으로 전한다. 진행 중인 분기는 윤곽선만 그려
 * "아직 덜 모인 값"임을 보이고 "부분 집계" 글자를 붙인다. 열마다 SVG가 따로라 글자(HTML)는 폰트 크기가
 * 화면 폭에 따라 줄지 않는다.
 */
export function QuarterFlowChart({ bars }: QuarterFlowChartProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    // 라벨은 리터럴 `t()` 호출로 만들어 두고 방향으로 고른다(추출기가 키를 볼 수 있게).
    const directionLabels: Record<FlowDirection, string> = {
        in: t('flowChart.in'),
        out: t('flowChart.out'),
        flat: t('flowChart.flat'),
    };
    const maxAbs = Math.max(
        ...bars.map(bar => Math.abs(bar.netShareChange)),
        1
    );
    return (
        <ol
            className="grid auto-cols-fr grid-flow-col items-end gap-1 sm:gap-2"
            aria-label={t('flowChart.title')}
        >
            {bars.map(bar => {
                const height =
                    bar.netShareChange === 0
                        ? 0
                        : Math.max(
                              MIN_BAR,
                              (Math.abs(bar.netShareChange) / maxAbs) *
                                  (HALF - 4)
                          );
                const y = bar.direction === 'out' ? HALF : HALF - height;
                return (
                    <li
                        key={bar.period}
                        className="flex min-w-0 flex-col items-center text-center"
                    >
                        <span
                            className={cn(
                                'text-xs tabular-nums',
                                DIRECTION_TEXT_CLASS[bar.direction]
                            )}
                        >
                            {formatSignedCompact(bar.netShareChange, locale)}
                        </span>
                        <span
                            className={cn(
                                'mb-1 text-xs font-medium',
                                DIRECTION_TEXT_CLASS[bar.direction]
                            )}
                        >
                            {directionLabels[bar.direction]}
                        </span>
                        <svg
                            width="100%"
                            height={CHART_HEIGHT}
                            aria-hidden="true"
                            role="presentation"
                            className="overflow-visible"
                        >
                            <line
                                x1="0"
                                x2="100%"
                                y1={HALF}
                                y2={HALF}
                                className="stroke-secondary-500"
                                strokeWidth="1"
                            />
                            {height > 0 && (
                                <rect
                                    x="20%"
                                    width="60%"
                                    y={y}
                                    height={height}
                                    rx="2"
                                    className={
                                        bar.complete
                                            ? DIRECTION_FILL_CLASS[
                                                  bar.direction
                                              ]
                                            : cn(
                                                  'fill-transparent stroke-2',
                                                  bar.direction === 'in'
                                                      ? 'stroke-chart-bullish'
                                                      : 'stroke-chart-bearish'
                                              )
                                    }
                                    strokeDasharray={
                                        bar.complete ? undefined : '4 3'
                                    }
                                />
                            )}
                        </svg>
                        <span className="mt-1 font-mono text-xs text-secondary-300 tabular-nums">
                            {formatPeriodShort(bar.period)}
                        </span>
                        {!bar.complete && (
                            <span className="text-xs text-secondary-400">
                                {t('flowChart.partial')}
                            </span>
                        )}
                    </li>
                );
            })}
        </ol>
    );
}
