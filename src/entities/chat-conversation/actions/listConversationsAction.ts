'use server';

import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { logActionError } from '@/shared/lib/logActionError';
import { DrizzleChatConversationRepository } from '../api';
import { toConversationListItem, type ConversationListItem } from '../model';

/**
 * 현재 회원의 대화 목록. 비로그인이거나 세션/DB 읽기가 실패하면 `[]`를 돌려준다 —
 * 일시적 목록 실패는 채팅 사이드바가 깨지는 것보다 "대화 없음"으로 보이는 편이 낫다.
 */
export async function listConversationsAction(): Promise<
    ConversationListItem[]
> {
    try {
        const user = await getCurrentUser();
        if (!user) return [];
        const rows = await new DrizzleChatConversationRepository(
            getDatabaseClient().db
        ).listForUser(user.id);
        return rows.map(toConversationListItem);
    } catch (error) {
        logActionError('[listConversationsAction] list failed', error);
        return [];
    }
}
