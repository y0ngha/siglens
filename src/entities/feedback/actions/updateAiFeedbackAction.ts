'use server';

import { hashUsageIp } from '@y0ngha/siglens-core';
import { getCurrentUser } from '@/entities/auth/server/getCurrentUser';
import { getClientIp } from '@/shared/api/getClientIp';
import { getDatabaseClient } from '@/shared/db/client';
import { logActionError } from '@/shared/lib/logActionError';
import { DrizzleFeedbackRepository } from '../api';
import type { AiFeedbackPatch } from '../lib/types';
import { parseUpdateInput } from '../lib/validation';
import { checkFeedbackRateLimit } from '../server/rateLimit';
import type { FeedbackActionResult } from '../types';

/**
 * 이미 제출한 👍/👎에 방향 변경·사유·의견을 반영한다. `kind='ai_response'` 행만 바뀐다.
 *
 * - 👍로 바꾸면 사유·의견을 함께 지운다(👍에 사유가 남는 모순 방지).
 * - 빈 의견(`''`)은 의견 지우기다.
 * - id는 제출 응답으로만 받는 추측 불가 uuid다. 여기에 행 소유자를 더 묶어, 회원이 남긴 행은
 *   그 회원만 고칠 수 있다(비회원 행은 비회원 요청으로만 고칠 수 있다).
 *   rate limit은 제출과 같은 `ai_vote` 버킷을 쓴다.
 */
export async function updateAiFeedbackAction(
    rawInput: unknown
): Promise<FeedbackActionResult> {
    try {
        const input = parseUpdateInput(rawInput);
        if (input === null) return { ok: false, code: 'invalid_input' };

        const ipHash = hashUsageIp(await getClientIp(), new Date());
        if (!(await checkFeedbackRateLimit('ai_vote', ipHash))) {
            return { ok: false, code: 'rate_limited' };
        }

        const patch: AiFeedbackPatch =
            input.vote === 'up'
                ? { vote: 'up', reasons: null, comment: null }
                : {
                      ...(input.vote !== undefined ? { vote: input.vote } : {}),
                      ...(input.reasons !== undefined
                          ? {
                                reasons:
                                    input.reasons.length > 0
                                        ? input.reasons
                                        : null,
                            }
                          : {}),
                      ...(input.comment !== undefined
                          ? { comment: input.comment || null }
                          : {}),
                  };

        const user = await getCurrentUser();
        const { db } = getDatabaseClient();
        const updated = await new DrizzleFeedbackRepository(
            db
        ).updateAiFeedback(input.id, patch, user?.id ?? null);
        return updated ? { ok: true } : { ok: false, code: 'not_found' };
    } catch (error) {
        logActionError('[updateAiFeedbackAction] Failed to update', error);
        return { ok: false, code: 'submission_failed' };
    }
}
