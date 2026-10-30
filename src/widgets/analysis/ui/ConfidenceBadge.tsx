'use client';

/**
 * 스킬 결과의 신뢰도(high/medium) 배지와 설명 툴팁.
 */
import { useTranslations } from 'next-intl';
import { HIGH_CONFIDENCE_WEIGHT } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';

type ConfidenceLevel = 'high' | 'medium';

// 색상만 모듈 상수로 남기고 문구는 `widgets.analysis.panel` 키로 옮겼다.
const CONFIDENCE_BADGE_CLASS: Record<ConfidenceLevel, string> = {
    high: 'text-ui-success-text bg-chart-bullish/10 border border-chart-bullish/30',
    medium: 'text-ui-warning-text bg-ui-warning/10 border border-ui-warning/30',
};

const CONFIDENCE_BADGE_KEY: Record<
    ConfidenceLevel,
    { label: string; tip1: string; tip2: string }
> = {
    high: {
        label: 'confidenceHigh',
        tip1: 'confidenceHighTip1',
        tip2: 'confidenceHighTip2',
    },
    medium: {
        label: 'confidenceMedium',
        tip1: 'confidenceMediumTip1',
        tip2: 'confidenceMediumTip2',
    },
};

interface ConfidenceBadgeProps {
    confidenceWeight: number;
}

/** `HIGH_CONFIDENCE_WEIGHT` 이상이면 high, 아니면 medium으로 표시한다. */
export function ConfidenceBadge({ confidenceWeight }: ConfidenceBadgeProps) {
    const tPanel = useTranslations('widgets.analysis.panel');
    const level: ConfidenceLevel =
        confidenceWeight >= HIGH_CONFIDENCE_WEIGHT ? 'high' : 'medium';
    const key = CONFIDENCE_BADGE_KEY[level];

    return (
        <span className="flex items-center">
            <span
                className={cn(
                    'rounded px-1.5 py-0.5 text-xs font-medium',
                    CONFIDENCE_BADGE_CLASS[level]
                )}
            >
                {tPanel(key.label)}
            </span>
            <InfoTooltip>
                <p>{tPanel(key.tip1)}</p>
                <p>{tPanel(key.tip2)}</p>
            </InfoTooltip>
        </span>
    );
}
