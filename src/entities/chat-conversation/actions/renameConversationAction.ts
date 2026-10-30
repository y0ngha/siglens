'use server';

import { getCurrentUser } from '@/entities/auth/server/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { logActionError } from '@/shared/lib/logActionError';
import { DrizzleChatConversationRepository } from '../api';
import { CONVERSATION_TITLE_COLUMN_MAX } from '../model';

/**
 * 제목을 trim해 저장한다. 빈 제목·{@link CONVERSATION_TITLE_COLUMN_MAX}자 초과·문자열이 아닌 인자·
 * 비로그인·세션/DB 실패는 던지지 않고 `{ ok: false }`로 돌려준다.
 */
export async function renameConversationAction(
    id: string,
    title: string
): Promise<{ ok: boolean }> {
    try {
        const user = await getCurrentUser();
        if (!user) return { ok: false };

        // 서버 액션 인자는 선언 타입과 무관하게 런타임에 임의 값이 올 수 있다.
        if (typeof id !== 'string' || typeof title !== 'string')
            return { ok: false };

        const trimmed = title.trim();
        if (
            trimmed.length === 0 ||
            trimmed.length > CONVERSATION_TITLE_COLUMN_MAX
        )
            return { ok: false };

        await new DrizzleChatConversationRepository(
            getDatabaseClient().db
        ).rename(id, user.id, trimmed);
        return { ok: true };
    } catch (error) {
        logActionError('[renameConversationAction] rename failed', error);
        return { ok: false };
    }
}
