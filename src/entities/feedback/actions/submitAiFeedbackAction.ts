'use server';

import { hashUsageIp } from '@y0ngha/siglens-core';
import { getCurrentUser } from '@/entities/auth/server/getCurrentUser';
import { DrizzleChatConversationRepository } from '@/entities/chat-conversation/api';
import { getClientIp } from '@/shared/api/getClientIp';
import { getDatabaseClient } from '@/shared/db/client';
import { resolveRequestLocale } from '@/shared/i18n/requestLocale';
import { logActionError } from '@/shared/lib/logActionError';
import { DrizzleFeedbackRepository } from '../api';
import { capSnapshot } from '../lib/capSnapshot';
import { parseAiFeedbackInput } from '../lib/validation';
import { checkFeedbackRateLimit } from '../server/rateLimit';
import {
    AGENT_MESSAGE_TARGET_TYPE,
    type SubmitAiFeedbackResult,
} from '../types';

/**
 * AI 응답 하나에 대한 👍/👎와 그 시점의 맥락(결과 원문 또는 대화 기록)을 저장하고 `{ id }`를
 * 돌려준다. 이후 사유·의견·방향 변경은 `updateAiFeedbackAction`이 같은 id로 한다.
 *
 * - 회원이면 `user_id`를 채운다. 시그렌즈 AI 회원 답변은 `conversationId`가 **그 회원의
 *   대화일 때만** `conversation_id`(대화 삭제 시 CASCADE 파기)로 연결하고, 아니면 null로 둔다.
 *   클라이언트가 보낸 남의 대화 id는 저장하지 않는다.
 * - 비회원 식별자(쿠키·IP 해시)는 저장하지 않는다.
 * - `context.guest`는 클라이언트 주장이 아니라 서버가 본 로그인 여부로 덮어쓴다.
 */
export async function submitAiFeedbackAction(
    rawInput: unknown
): Promise<SubmitAiFeedbackResult> {
    try {
        const input = parseAiFeedbackInput(rawInput);
        if (input === null) return { ok: false, code: 'invalid_input' };

        const ipHash = hashUsageIp(await getClientIp(), new Date());
        if (!(await checkFeedbackRateLimit('ai_vote', ipHash))) {
            return { ok: false, code: 'rate_limited' };
        }

        const user = await getCurrentUser();
        const locale = await resolveRequestLocale();
        const { db } = getDatabaseClient();

        let conversationId: string | null = null;
        let context: Record<string, unknown>;
        let targetType: string;
        let symbol: string | null = null;
        if (input.surface === 'siglens') {
            context = { ...input.context };
            targetType = input.context.analysisType;
            symbol = input.context.symbol ?? null;
        } else {
            const {
                conversationId: claimedId,
                messageId,
                ...rest
            } = input.context;
            if (user !== null && claimedId !== undefined) {
                const owned = await new DrizzleChatConversationRepository(
                    db
                ).findForUser(claimedId, user.id);
                if (owned !== null) conversationId = owned.id;
            }
            context = {
                ...rest,
                guest: user === null,
                ...(conversationId !== null
                    ? {
                          conversationId,
                          ...(messageId !== undefined ? { messageId } : {}),
                      }
                    : {}),
            };
            targetType = AGENT_MESSAGE_TARGET_TYPE;
        }

        const id = await new DrizzleFeedbackRepository(db).create({
            kind: 'ai_response',
            surface: input.surface,
            rating: null,
            vote: input.vote,
            reasons: null,
            comment: null,
            targetType,
            symbol,
            context,
            snapshot: capSnapshot(input.snapshot),
            userId: user?.id ?? null,
            conversationId,
            pagePath: input.pagePath,
            locale,
        });
        return { ok: true, id };
    } catch (error) {
        // INSERT 실패 메시지에 바인딩된 스냅샷 본문이 실려 원문 대신 이름·코드만 남긴다.
        logActionError('[submitAiFeedbackAction] Failed to submit', error);
        return { ok: false, code: 'submission_failed' };
    }
}
