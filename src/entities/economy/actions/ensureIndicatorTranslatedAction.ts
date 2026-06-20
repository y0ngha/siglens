'use server';

import { revalidateTag } from 'next/cache';
// CORE DEPENDENCY (separate repo, user publishes): analysis-domain AI translation
// of an unmapped indicator name. See SP-B plan CROSS-REPO note. The actual core
// export is a submit/poll pair (not a synchronous `translateIndicatorName`);
// this file implements the bounded poll loop mirroring ensureNewsCardsAnalyzedAction.
import {
    submitIndicatorTranslation,
    pollIndicatorTranslation,
} from '@y0ngha/siglens-core';

import { getDatabaseClient } from '@/shared/db/client';
import { sleep } from '@/shared/lib/sleep';
import { MS_PER_SECOND } from '@/shared/config/time';

import { DrizzleIndicatorTranslationRepository } from '../api/indicatorTranslationRepository';
import {
    isIndicatorTranslationPending,
    markIndicatorTranslationPending,
} from '../api/indicatorTranslationFlag';
import { INDICATOR_NAME_KO } from '../lib/indicatorNameKo';
import {
    INDICATOR_TRANSLATION_CACHE_TAG,
    INDICATOR_TRANSLATION_POLL_INTERVAL_MS,
    INDICATOR_TRANSLATION_POLL_MAX_ATTEMPTS,
} from '../lib/indicatorTranslationConstants';

/**
 * submit → poll 루프를 실행해 번역 결과를 얻는다. core 캐시 hit이면 즉시 반환
 * (poll 없음). submitted면 최대 POLL_MAX_ATTEMPTS 회 polling. done이면 nameKo,
 * error/timeout이면 null(호출자가 upsert 생략).
 *
 * `ensureNewsCardsAnalyzedAction`의 `analyzeAndPersist` 패턴 미러.
 */
async function submitAndPoll(normalizedName: string): Promise<string | null> {
    const sub = await submitIndicatorTranslation(normalizedName);

    if (sub.status === 'cached') {
        return sub.nameKo;
    }

    // status === 'submitted' — poll until done or timeout
    const { jobId } = sub;
    for (
        let attempt = 0;
        attempt < INDICATOR_TRANSLATION_POLL_MAX_ATTEMPTS;
        attempt++
    ) {
        await sleep(INDICATOR_TRANSLATION_POLL_INTERVAL_MS);
        const polled = await pollIndicatorTranslation(jobId);
        if (polled.status === 'done') {
            return polled.nameKo;
        }
        if (polled.status === 'error') {
            console.error(
                `[ensureIndicatorTranslatedAction] poll error "${normalizedName}": ${polled.error}`
            );
            return null;
        }
    }

    const timeoutSecs =
        (INDICATOR_TRANSLATION_POLL_MAX_ATTEMPTS *
            INDICATOR_TRANSLATION_POLL_INTERVAL_MS) /
        MS_PER_SECOND;
    console.warn(
        `[ensureIndicatorTranslatedAction] poll timeout after ${timeoutSecs}s — "${normalizedName}"`
    );
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
