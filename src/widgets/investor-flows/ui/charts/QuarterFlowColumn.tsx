/**
 * 분기별 순매수·순매도 막대 그래프의 한 열 — 부호 있는 수량, 방향 글자, 막대, 분기 라벨.
 */
import { useTranslations } from 'next-intl';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { formatPeriodShort, formatSignedCompact } from '../../utils/flowFormat';
import type { FlowDirection, QuarterBar } from '../../utils/institutional';
import {
    BASELINE_Y,
    barRect,
    CHART_HEIGHT,
} from '../../utils/quarterBarGeometry';

const DIRECTION_TEXT_CLASS: Record<FlowDirection, string> = {
    in: 'text-ui-success-text',
    out: 'text-ui-danger-text',
    flat: 'text-secondary-300',
};

/** 완결 분기의 막대 — 방향 색으로 채운다. */
const COMPLETE_BAR_CLASS: Record<FlowDirection, string> = {
    in: 'fill-chart-bullish',
    out: 'fill-chart-bearish',
    flat: 'fill-secondary-500',
};

/** 진행 중 분기의 막대 — 윤곽선만 그려 "아직 덜 모인 값"임을 보인다. */
const PARTIAL_BAR_CLASS: Record<FlowDirection, string> = {
    in: 'fill-transparent stroke-2 stroke-chart-bullish',
    out: 'fill-transparent stroke-2 stroke-chart-bearish',
    flat: 'fill-transparent stroke-2 stroke-secondary-500',
};

/** 진행 중 분기 막대의 점선 무늬. */
const PARTIAL_DASH = '4 3';

interface QuarterFlowColumnProps {
    readonly bar: QuarterBar;
    /** 막대 길이의 기준이 되는 가장 큰 순변화 절댓값. */
    readonly maxAbs: number;
}

/** 열마다 SVG가 따로라 글자(HTML)는 폰트 크기가 화면 폭에 따라 줄지 않는다. */
export function QuarterFlowColumn({ bar, maxAbs }: QuarterFlowColumnProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    // 라벨은 리터럴 번역 호출로 만들어 두고 방향으로 고른다(추출기가 키를 볼 수 있게).
    const directionLabels: Record<FlowDirection, string> = {
        in: t('flowChart.in'),
        out: t('flowChart.out'),
        flat: t('flowChart.flat'),
    };
    const { height, y } = barRect(bar.netShareChange, bar.direction, maxAbs);
    const barClass = bar.complete
        ? COMPLETE_BAR_CLASS[bar.direction]
        : PARTIAL_BAR_CLASS[bar.direction];
    return (
        <li className="flex min-w-0 flex-col items-center text-center">
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
                    y1={BASELINE_Y}
                    y2={BASELINE_Y}
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
                        className={barClass}
                        strokeDasharray={
                            bar.complete ? undefined : PARTIAL_DASH
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
}
