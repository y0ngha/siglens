'use server';

import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { logActionError } from '@/shared/lib/logActionError';
import { DrizzleChatConversationRepository } from '../api';
import { toMessageView, type ConversationDetail } from '../model';

/**
 * 소유자 범위 대화 조회. 없는 대화·타인의 대화·형식이 틀린 id·세션/DB 실패는 모두 `null`이라
 * 클라이언트는 "없음"과 "내 것이 아님"(또는 저장소 장애)을 구분할 수 없다. regenerate 잔여인
 * `superseded` 행은 걸러 낸다.
 */
export async function getConversationAction(
    id: string
): Promise<ConversationDetail | null> {
    try {
        const user = await getCurrentUser();
        if (!user) return null;

        // 서버 액션 인자는 선언 타입과 무관하게 런타임에 임의 JSON이 올 수 있다.
        if (typeof id !== 'string') return null;

        const repo = new DrizzleChatConversationRepository(
            getDatabaseClient().db
        );
        const conversation = await repo.findForUser(id, user.id);
        if (!conversation) return null;
        const messages = await repo.listMessages(id);
        return {
            id: conversation.id,
            title: conversation.title,
            messages: messages
                .filter(m => m.status !== 'superseded')
                .map(toMessageView),
        };
    } catch (error) {
        logActionError('[getConversationAction] read failed', error);
        return null;
    }
}
