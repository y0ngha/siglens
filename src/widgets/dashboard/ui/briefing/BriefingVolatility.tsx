/**
 * 브리핑의 변동성 지수 수치와 해설 한 줄.
 */
import type { MarketBriefingVolatilityAnalysis } from '@y0ngha/siglens-core';

const VOLATILITY_LEVEL_DIGITS = 2;

interface BriefingVolatilityProps {
    /** 이 시장의 변동성 지수 심볼. 해설이 수치를 그대로 인용하므로 지수가 없으면 호출부가 이 줄을 통째로 뺀다. */
    indexSymbol: string;
    analysis: MarketBriefingVolatilityAnalysis;
}

/** 수치와 해설이 모두 없으면 줄을 그리지 않는다. */
export function BriefingVolatility({
    indexSymbol,
    analysis,
}: BriefingVolatilityProps) {
    const { vixLevel, description } = analysis;
    if (vixLevel === undefined && !description) return null;
    return (
        <p className="text-xs text-secondary-500">
            {vixLevel !== undefined && (
                <span className="mr-1 font-mono text-secondary-400">
                    {indexSymbol} {vixLevel.toFixed(VOLATILITY_LEVEL_DIGITS)}
                </span>
            )}
            {description}
        </p>
    );
}
