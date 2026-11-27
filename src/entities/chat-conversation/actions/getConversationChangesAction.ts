'use server';

import { getCurrentUser } from '@/entities/auth/server/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { logActionError } from '@/shared/lib/logActionError';
import { DrizzleChatConversationRepository } from '../api';
import { loadConversationChanges } from '../server/loadConversationChanges';
import type { ChatSymbolChangesResult } from '../types';

/**
 * 다시 연 대화 아래 "달라진 점" 카드의 값. 페이지가 뜬 **뒤에** 클라이언트가 부른다 — 시세·봉 조회가
 * 대화 열기를 막지 않게 하려는 것이다. 소유자 범위: 타인의 대화·없는 대화·세션/DB 실패는 모두 빈 배열이라 카드가
 * 그려지지 않는다(이유를 구분해 알려 주지 않는다). 읽기만 하고 저장하지 않으며 LLM도 부르지 않는다.
 * 비교할 게 없는 종목(`same_session`)은 페이로드에서 뺀다.
 */
export async function getConversationChangesAction(
    id: string
): Promise<ChatSymbolChangesResult[]> {
    try {
        const user = await getCurrentUser();
        if (!user) return [];
        // 서버 액션 인자는 선언 타입과 무관하게 런타임에 임의 JSON이 올 수 있다.
        if (typeof id !== 'string') return [];

        const repo = new DrizzleChatConversationRepository(
            getDatabaseClient().db
        );
        const conversation = await repo.findForUser(id, user.id);
        if (!conversation) return [];
        const rows = await repo.listMessages(id);
        const results = await loadConversationChanges(
            rows.filter(row => row.status !== 'superseded')
        );
        return results.filter(result => result.status !== 'same_session');
    } catch (error) {
        logActionError('[getConversationChangesAction] read failed', error);
        return [];
    }
}
