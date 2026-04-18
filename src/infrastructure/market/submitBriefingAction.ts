'use server';

import { waitUntil } from '@vercel/functions';
import { buildMarketBriefingPrompt } from '@/domain/analysis/marketBriefingPrompt';
import type { MarketSummaryData, SubmitBriefingResult } from '@/domain/types';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import { buildBriefingCacheKey } from '@/infrastructure/cache/config';

export async function submitBriefingAction(
    data: MarketSummaryData
): Promise<SubmitBriefingResult> {
    const workerUrl = process.env.WORKER_URL;
    const workerSecret = process.env.WORKER_SECRET;
    if (!workerUrl || !workerSecret) {
        throw new Error(
            'WORKER_URL and WORKER_SECRET environment variables are required'
        );
    }

    const now = new Date();
    const dateHour = now.toISOString().slice(0, 13); // "2026-04-18T14"
    const cacheKey = buildBriefingCacheKey(dateHour);

    const cache = createCacheProvider();
    if (cache !== null) {
        try {
            const cached = await cache.get<string>(cacheKey);
            if (cached !== null) {
                return { status: 'cached', briefing: cached };
            }
        } catch (error) {
            console.error('[Briefing/Submit] Cache read failed:', error);
        }
    }

    const prompt = buildMarketBriefingPrompt(data.indices, data.sectors);
    const jobId = crypto.randomUUID();

    waitUntil(
        fetch(`${workerUrl}/briefing`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Worker-Secret': workerSecret,
            },
            body: JSON.stringify({ jobId, prompt }),
        }).catch(error => {
            console.error('[Briefing/Submit] Worker request failed:', error);
        })
    );

    return { status: 'submitted', jobId };
}
