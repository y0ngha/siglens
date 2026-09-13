'use server';

import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleChatConversationRepository } from '../api';
import { logActionError } from '../lib/logActionError';

/**
 * Hard-deletes the conversation and its messages, scoped to the owner
 * (privacy policy commits to immediate destruction on deletion — see
 * `DrizzleChatConversationRepository.delete`). Non-string `id` and
 * unauthenticated callers get a non-throwing `{ ok: false }`; a DB failure
 * resolves to `{ ok: false }` too rather than rejecting.
 */
export async function deleteConversationAction(
    id: string
): Promise<{ ok: boolean }> {
    const user = await getCurrentUser();
    if (!user) return { ok: false };

    // Server-action args are attacker-controlled at runtime regardless of
    // the declared `string` parameter type.
    if (typeof id !== 'string') return { ok: false };

    try {
        await new DrizzleChatConversationRepository(
            getDatabaseClient().db
        ).delete(id, user.id);
        return { ok: true };
    } catch (error) {
        logActionError('[deleteConversationAction] delete failed', error);
        return { ok: false };
    }
}
