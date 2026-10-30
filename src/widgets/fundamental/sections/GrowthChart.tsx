/**
 * 성장률 카드 — 매출·EPS 전년 대비 성장률을 인라인 SVG 막대로 보여 준다.
 */
import { useTranslations } from 'next-intl';
import type { FundamentalGrowthInput } from '@y0ngha/siglens-core';
import { EmptySectionCard } from '@/shared/ui/EmptySectionCard';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import {
    growthBarView,
    growthTextClass,
} from '@/widgets/fundamental/utils/growthBar';

const HEADING_ID = 'growth-heading';
const HEADING_CLASS_NAME = cn('mb-2', HEADING_SECTION);

interface GrowthChartProps {
    growth: FundamentalGrowthInput | null;
}

interface GrowthBarProps {
    label: string;
    value: number | null;
    description: string;
}

/** 성장 지표 하나의 인라인 SVG 막대. 양수는 초록, 음수는 빨강이며 ±100%에서 잘린다. */
function GrowthBar({ label, value, description }: GrowthBarProps) {
    const view = growthBarView(value);
    const { fillAbs, isPositive } = view;

    return (
        <div className="py-3">
            <div className="mb-2 flex items-baseline justify-between gap-2">
                <div>
                    <span className="text-sm font-medium">{label}</span>
                    <span className="ml-1.5 text-xs text-secondary-400">
                        {description}
                    </span>
                </div>
                <span
                    className={cn(
                        'font-mono text-sm font-semibold tabular-nums',
                        growthTextClass(view)
                    )}
                >
                    {view.formatted}
                </span>
            </div>

            {/* chart library 없이 RSC-safe하게 렌더링 */}
            <svg
                width="100%"
                height="12"
                aria-hidden="true"
                role="presentation"
                className="overflow-visible"
            >
                <rect
                    x="0"
                    y="3"
                    width="100%"
                    height="6"
                    rx="3"
                    className="fill-secondary-700"
                />
                <line
                    x1="50%"
                    y1="1"
                    x2="50%"
                    y2="11"
                    className="stroke-secondary-700"
                    strokeWidth="1"
                />
                {view.hasValue && (
                    <rect
                        x={isPositive ? '50%' : `${50 - fillAbs / 2}%`}
                        y="3"
                        width={`${fillAbs / 2}%`}
                        height="6"
                        rx="3"
                        className={
                            isPositive
                                ? 'fill-chart-bullish'
                                : 'fill-chart-bearish'
                        }
                    />
                )}
            </svg>
        </div>
    );
}

/** 매출·EPS 전년 대비 성장률 막대. 성장률이 없으면 빈 카드를 그린다. */
export function GrowthChart({ growth }: GrowthChartProps) {
    const t = useTranslations('widgets.fundamental');
    if (growth === null) {
        return (
            <EmptySectionCard
                headingId={HEADING_ID}
                title={t('GrowthChart.9b388e')}
                headingClassName={HEADING_CLASS_NAME}
            />
        );
    }

    return (
        <section
            aria-labelledby={HEADING_ID}
            className={cn(SURFACE_CARD, 'p-6')}
        >
            <h2 id={HEADING_ID} className={HEADING_CLASS_NAME}>
                {t('GrowthChart.9b388e')}
            </h2>
            <p className="mb-4 text-xs text-secondary-400">
                {t('GrowthChart.7de762')}
            </p>
            <div className="divide-y divide-secondary-700/50">
                <GrowthBar
                    label={t('GrowthChart.06ae38')}
                    value={growth.growthRevenue}
                    description="Revenue YoY"
                />
                <GrowthBar
                    label={t('GrowthChart.5106ed')}
                    value={growth.growthEPS}
                    description="EPS YoY"
                />
            </div>
        </section>
    );
}
