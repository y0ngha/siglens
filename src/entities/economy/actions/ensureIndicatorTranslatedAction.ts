'use server';

import { isE2E } from '@/shared/api/e2eEnv';

import {
    isTranslatableCalendarIndicator,
    translateIndicator,
} from '../api/translateIndicators';

/**
 * Server Action: 미매핑 지표명 1건을 AI로 번역해 캐시한다. 본문은
 * `translateIndicator` — 허브 프리웜 크론이 같은 번역을 방문 전에 미리 돌린다.
 * `waitUntil` 안에서 fire-and-forget으로 도는 설계 — 응답 스트림 비차단. Never throws.
 *
 * 인증 없는 공개 액션이라 인자는 임의 값이다(타입 선언은 런타임 보장이 아니다).
 * 화면 캘린더 창에 실제로 있는 지표명만 번역한다 — 그 밖의 문자열은 LLM에 닿지 않는다
 * (`isTranslatableCalendarIndicator`).
 */
export async function ensureIndicatorTranslatedAction(
    normalizedName: unknown
): Promise<void> {
    try {
        if (isE2E()) return;
        if (typeof normalizedName !== 'string') return;
        if (!(await isTranslatableCalendarIndicator(normalizedName))) return;
        await translateIndicator(
            normalizedName,
            'ensureIndicatorTranslatedAction'
        );
    } catch (error) {
        console.error('[ensureIndicatorTranslatedAction]', error);
    }
}
