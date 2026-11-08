'use server';

import { hashUsageIp } from '@y0ngha/siglens-core';
import { getCurrentUser } from '@/entities/auth/server/getCurrentUser';
import { getClientIp } from '@/shared/api/getClientIp';
import { getDatabaseClient } from '@/shared/db/client';
import { scheduleOperatorNotification } from '@/shared/email/operatorNotifier';
import { resolveRequestLocale } from '@/shared/i18n/requestLocale';
import { logActionError } from '@/shared/lib/logActionError';
import { DrizzleFeedbackRepository } from '../api';
import { buildVocNotification } from '../templates/operator-mail/buildVocNotification';
import { parseVocInput } from '../lib/validation';
import { checkFeedbackRateLimit } from '../server/rateLimit';
import type { FeedbackActionResult } from '../types';

/**
 * 첫 AI 경험 직후의 VOC 별점(1~5) + 선택 의견을 저장하고 운영자에게 즉시 알린다.
 *
 * 흐름: 입력 검증 → IP 해시 rate limit(5/h) → 저장 → 운영자 메일.
 * 메일 실패는 사용자 결과에 영향을 주지 않는다(로그만). 던지지 않고 결과를 돌려준다(SA-1).
 * 비회원 식별자(쿠키·IP 해시)는 저장하지 않는다 — rate limit용 해시는 Redis에만 남는다.
 */
export async function submitVocFeedbackAction(
    rawInput: unknown
): Promise<FeedbackActionResult> {
    try {
        const input = parseVocInput(rawInput);
        if (input === null) return { ok: false, code: 'invalid_input' };

        const ipHash = hashUsageIp(await getClientIp(), new Date());
        if (!(await checkFeedbackRateLimit('voc', ipHash))) {
            return { ok: false, code: 'rate_limited' };
        }

        const user = await getCurrentUser();
        const locale = await resolveRequestLocale();
        const comment = input.comment ?? null;
        const { db } = getDatabaseClient();
        await new DrizzleFeedbackRepository(db).create({
            kind: 'voc',
            surface: input.surface,
            rating: input.rating,
            vote: null,
            reasons: null,
            comment,
            targetType: null,
            symbol: null,
            context: { trigger: input.trigger },
            snapshot: null,
            userId: user?.id ?? null,
            conversationId: null,
            pagePath: input.pagePath,
            locale,
        });

        scheduleOperatorNotification(
            buildVocNotification({
                surface: input.surface,
                rating: input.rating,
                comment,
                trigger: input.trigger,
                pagePath: input.pagePath,
                locale,
                isMember: user !== null,
            }),
            '[submitVocFeedbackAction]'
        );
        return { ok: true };
    } catch (error) {
        logActionError('[submitVocFeedbackAction] Failed to submit', error);
        return { ok: false, code: 'submission_failed' };
    }
}
