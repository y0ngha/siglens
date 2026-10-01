'use server';

import { isE2E } from '@/shared/api/e2eEnv';

import { translateIndicator } from '../api/translateIndicators';

/**
 * Server Action: 미매핑 지표명 1건을 AI로 번역해 캐시한다. 본문은
 * `translateIndicator` — 허브 프리웜 크론이 같은 번역을 방문 전에 미리 돌린다.
 * `waitUntil` 안에서 fire-and-forget으로 도는 설계 — 응답 스트림 비차단. Never throws.
 */
export async function ensureIndicatorTranslatedAction(
    normalizedName: string
): Promise<void> {
    try {
        if (isE2E()) return;
        await translateIndicator(
            normalizedName,
            'ensureIndicatorTranslatedAction'
        );
    } catch (error) {
        console.error('[ensureIndicatorTranslatedAction]', error);
    }
}
