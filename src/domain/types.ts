// SigLens-app-specific types only.
// Shared domain types live in @y0ngha/siglens-core — import from there directly.

import type {
    MarketSummaryData,
    SubmitBriefingResult,
} from '@y0ngha/siglens-core';

export interface MarketSummaryActionResult {
    summary: MarketSummaryData;
    briefing: SubmitBriefingResult;
}
