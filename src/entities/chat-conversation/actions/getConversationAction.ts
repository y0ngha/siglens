'use server';

import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleChatConversationRepository } from '../api';
import { toMessageView, type ChatMessageView } from '../model';
import { logActionError } from '../lib/logActionError';

export interface ConversationDetail {
    id: string;
    title: string;
    messages: ChatMessageView[];
}

/**
 * Owner-scoped conversation lookup: `null` for missing, another user's
 * conversation, a malformed id, or a DB failure — no distinction is leaked
 * to the client between "doesn't exist" and "not yours" (or "storage
 * unavailable"). `superseded` rows (regenerate leftovers) are filtered out.
 */
export async function getConversationAction(
    id: string
): Promise<ConversationDetail | null> {
    const user = await getCurrentUser();
    if (!user) return null;

    // Server-action args are attacker-controlled at runtime regardless of
    // the declared `string` parameter type — a hostile client can post any
    // JSON value.
    if (typeof id !== 'string') return null;

    try {
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
