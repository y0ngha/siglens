import type { MarketIndexData, MarketSectorData } from '@/domain/types';

export function buildMarketBriefingPrompt(
    indices: MarketIndexData[],
    sectors: MarketSectorData[]
): string {
    const indexLines = indices
        .map(i => {
            const sign = i.changesPercentage >= 0 ? '+' : '';
            return `${i.displayName}: ${i.price.toFixed(2)} (${sign}${i.changesPercentage.toFixed(2)}%)`;
        })
        .join('\n');

    const sectorLines = sectors
        .map(s => {
            const sign = s.changesPercentage >= 0 ? '+' : '';
            return `${s.sectorName}: ${sign}${s.changesPercentage.toFixed(2)}%`;
        })
        .join('\n');

    return `You are a concise market analyst. Write a 2–3 sentence market briefing in Korean (존댓말) based on the data below. Focus on dominant themes: which sectors are leading or lagging, any notable volatility (VIX), and overall risk-on/off sentiment. Be specific and factual. No markdown, no JSON, plain text only.

주요 지수:
${indexLines}

섹터 등락률:
${sectorLines}`;
}
