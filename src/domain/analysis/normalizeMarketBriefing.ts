import type {
    MarketBriefingResponse,
    MarketBriefingSectorAnalysis,
    MarketBriefingVolatilityAnalysis,
} from '@/domain/types';
import { asArray, asNumber, asObject, asString } from './normalize';

function normalizeSectorAnalysis(v: unknown): MarketBriefingSectorAnalysis {
    const o = asObject(v);
    if (!o) {
        return {
            leadingSectors: [],
            laggingSectors: [],
            performanceDescription: '',
        };
    }
    return {
        leadingSectors: asArray(o.leadingSectors)
            .map(s => asString(s))
            .filter((s): s is string => s.length > 0),
        laggingSectors: asArray(o.laggingSectors)
            .map(s => asString(s))
            .filter((s): s is string => s.length > 0),
        performanceDescription: asString(o.performanceDescription),
    };
}

function normalizeVolatilityAnalysis(
    v: unknown
): MarketBriefingVolatilityAnalysis {
    const o = asObject(v);
    if (!o) return { vixLevel: undefined, description: '' };
    return {
        vixLevel: asNumber(o.vixLevel),
        description: asString(o.description),
    };
}

export function normalizeMarketBriefing(raw: unknown): MarketBriefingResponse {
    const o = asObject(raw);
    if (!o) {
        return {
            summary: '',
            dominantThemes: [],
            sectorAnalysis: {
                leadingSectors: [],
                laggingSectors: [],
                performanceDescription: '',
            },
            volatilityAnalysis: { vixLevel: undefined, description: '' },
            riskSentiment: '',
        };
    }
    return {
        summary: asString(o.summary),
        dominantThemes: asArray(o.dominantThemes)
            .map(s => asString(s))
            .filter((s): s is string => s.length > 0),
        sectorAnalysis: normalizeSectorAnalysis(o.sectorAnalysis),
        volatilityAnalysis: normalizeVolatilityAnalysis(o.volatilityAnalysis),
        riskSentiment: asString(o.riskSentiment),
    };
}
