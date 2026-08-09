'use server';

import { revalidateTag } from 'next/cache';
// CORE DEPENDENCY (separate repo, user publishes): analysis-domain AI translation
// of an unmapped indicator name. See SP-B plan CROSS-REPO note.
import { runIndicatorTranslation } from '@y0ngha/siglens-core';

import { isE2E } from '@/shared/api/e2eEnv';
import { getDatabaseClient } from '@/shared/db/client';

import { DrizzleIndicatorTranslationRepository } from '../api/indicatorTranslationRepository';
import {
    isIndicatorTranslationPending,
    markIndicatorTranslationPending,
} from '../api/indicatorTranslationFlag';
import { INDICATOR_NAME_KO } from '../lib/indicatorNameKo';
import { INDICATOR_TRANSLATION_CACHE_TAG } from '../lib/indicatorTranslationConstants';

/**
 * `runIndicatorTranslation`을 호출해 번역 결과를 얻는다. cached/done이면 nameKo,
 * 그 외(error 등)는 null — 호출자가 upsert 생략.
 */
async function submitAndPoll(normalizedName: string): Promise<string | null> {
    const result = await runIndicatorTranslation(normalizedName);
    if (result.status === 'cached' || result.status === 'done') {
        return result.nameKo;
    }
    return null;
}

/**
 * Server Action: 미매핑 지표명 1건을 core AI로 번역해 `economic_indicator_translations`에
 * `source:'ai'`로 캐시하고 번역 캐시 태그를 무효화한다(다음 렌더에서 한국어 반영).
 *
 * 코드 사전(`INDICATOR_NAME_KO`)에 이미 있으면 즉시 반환 — dict가 source-of-truth라
 * AI를 호출할 이유가 없다. pending-flag로 동시/연속 제출을 dedupe한다. core 실패 시
 * graceful(캐시 미기록) — pending-flag TTL 만료 후 다음 렌더가 재시도한다.
 * `waitUntil` 안에서 fire-and-forget으로 도는 설계 — 응답 스트림 비차단.
 */
export async function ensureIndicatorTranslatedAction(
    normalizedName: string
): Promise<void> {
    try {
        if (isE2E()) return;
        if (normalizedName in INDICATOR_NAME_KO) {
            return;
        }
        if (await isIndicatorTranslationPending(normalizedName)) {
            return;
        }
        // core 왕복 전에 마킹 — 동시 호출이 이 지점 이후 플래그를 읽으면 제출을 생략.
        await markIndicatorTranslationPending(normalizedName);

        const nameKo = await submitAndPoll(normalizedName);
        if (nameKo === null || nameKo.trim() === '') {
            // null = poll error/timeout; empty = core의 "번역 불가" 시그널 → 영어 유지
            if (nameKo !== null) {
                console.error(
                    `[ensureIndicatorTranslatedAction] empty translation for "${normalizedName}"`
                );
            }
            return;
        }

        const { db } = getDatabaseClient();
        const repo = new DrizzleIndicatorTranslationRepository(db);
        await repo.upsert({
            normalizedName,
            koreanName: nameKo.trim(),
            source: 'ai',
        });

        // 번역 캐시 태그만 무효화 — 캘린더 데이터 ISR 캐시는 무관.
        // Next 16 revalidateTag(tag, profile) — 'max'는 즉시 무효화.
        revalidateTag(INDICATOR_TRANSLATION_CACHE_TAG, 'max');
    } catch (error) {
        console.error('[ensureIndicatorTranslatedAction]', error);
    }
}
