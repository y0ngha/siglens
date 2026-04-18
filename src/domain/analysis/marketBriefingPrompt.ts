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

    return `You are a concise market analyst. Analyze the market data below and respond with a JSON object matching the exact schema provided. No markdown, no extra text — only valid JSON.

Schema:
{
  "summary": "1-sentence overall market summary in Korean (존댓말)",
  "dominantThemes": ["theme1", "theme2"],
  "sectorAnalysis": {
    "leadingSectors": ["ETF ticker", ...],
    "laggingSectors": ["ETF ticker", ...],
    "performanceDescription": "sector performance summary in Korean"
  },
  "volatilityAnalysis": {
    "vixLevel": <number>,
    "description": "VIX interpretation in Korean"
  },
  "riskSentiment": "risk-on/off/neutral assessment in Korean"
}

주요 지수:
${indexLines}

섹터 등락률:
${sectorLines}`;
}
