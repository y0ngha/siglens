'use server';

import { getCurrentUser } from '@/entities/auth/server/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { logActionError } from '@/shared/lib/logActionError';
import { DrizzleChatConversationRepository } from '../api';

/**
 * 소유자 범위로 대화와 그 메시지를 하드 삭제한다(개인정보 처리방침이 삭제 즉시 파기를
 * 약속한다 — `DrizzleChatConversationRepository.delete` 참고). 비로그인·문자열이 아닌 `id`·
 * 세션/DB 실패는 던지지 않고 `{ ok: false }`로 돌려준다.
 */
export async function deleteConversationAction(
    id: string
): Promise<{ ok: boolean }> {
    try {
        const user = await getCurrentUser();
        if (!user) return { ok: false };

        // 서버 액션 인자는 선언 타입과 무관하게 런타임에 임의 값이 올 수 있다.
        if (typeof id !== 'string') return { ok: false };

        await new DrizzleChatConversationRepository(
            getDatabaseClient().db
        ).delete(id, user.id);
        return { ok: true };
    } catch (error) {
        logActionError('[deleteConversationAction] delete failed', error);
        return { ok: false };
    }
}
