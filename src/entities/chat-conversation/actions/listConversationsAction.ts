'use server';

import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleChatConversationRepository } from '../api';
import { logActionError } from '../lib/logActionError';

export interface ConversationListItem {
    id: string;
    title: string;
    lastMessageAt: string;
}

/**
 * Returns the current member's conversations, or `[]` when logged out or on
 * a read failure — mirrors `getPortfolioHoldingsAction`'s never-redirect
 * shape, but this one intentionally swallows DB errors too (a transient
 * list failure degrading to "no conversations" is preferable to a crashed
 * chat sidebar).
 */
export async function listConversationsAction(): Promise<
    ConversationListItem[]
> {
    const user = await getCurrentUser();
    if (!user) return [];
    try {
        const rows = await new DrizzleChatConversationRepository(
            getDatabaseClient().db
        ).listForUser(user.id);
        return rows.map(r => ({
            id: r.id,
            title: r.title,
            lastMessageAt: r.lastMessageAt.toISOString(),
        }));
    } catch (error) {
        logActionError('[listConversationsAction] list failed', error);
        return [];
    }
}
