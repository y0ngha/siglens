'use client';

/**
 * 가격 시나리오 한 쪽(상승/하락) — 조건과 목표가 목록. 목표가가 없으면 그리지 않는다.
 */
import type { KrxTickTable, PriceScenario } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { formatAnalysisPrice } from '@/shared/lib/analysisPriceFormat';
import { cn } from '@/shared/lib/cn';
import { MarkdownText } from '@/shared/ui/MarkdownText';

interface PriceScenarioColumnProps {
    label: string;
    scenario: PriceScenario | null;
    colorClass: string;
    symbol: string;
    krxTickTable: KrxTickTable;
}

export function PriceScenarioColumn({
    label,
    scenario,
    colorClass,
    symbol,
    krxTickTable,
}: PriceScenarioColumnProps) {
    const locale = useResolvedLocale();
    if (!scenario || scenario.targets.length === 0) return null;
    return (
        <div className="flex flex-col gap-1.5">
            <span className={cn('text-xs font-medium', colorClass)}>
                {label}
            </span>
            <MarkdownText className="text-xs text-secondary-500">
                {scenario.condition}
            </MarkdownText>
            {scenario.targets.map(target => (
                <div
                    key={`target-${target.price}`}
                    className="flex items-baseline gap-2"
                >
                    <span
                        className={cn(
                            'text-sm font-medium tabular-nums',
                            colorClass
                        )}
                    >
                        {formatAnalysisPrice(target.price, symbol, locale, {
                            krxTickTable,
                        })}
                    </span>
                    <MarkdownText className="text-xs text-secondary-500">
                        {target.basis}
                    </MarkdownText>
                </div>
            ))}
        </div>
    );
}
