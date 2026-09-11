'use server';

import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleChatConversationRepository } from '../api';
import { logActionError } from '../lib/logActionError';

/**
 * Trims and length-caps (120) the title; rejects empty/oversized input,
 * non-string args, and unauthenticated callers without throwing. A DB
 * failure also resolves to `{ ok: false }` rather than rejecting.
 */
export async function renameConversationAction(
    id: string,
    title: string
): Promise<{ ok: boolean }> {
    const user = await getCurrentUser();
    if (!user) return { ok: false };

    // Server-action args are attacker-controlled at runtime regardless of
    // the declared `string` parameter types.
    if (typeof id !== 'string' || typeof title !== 'string')
        return { ok: false };

    const trimmed = title.trim();
    if (trimmed.length === 0 || trimmed.length > 120) return { ok: false };

    try {
        await new DrizzleChatConversationRepository(
            getDatabaseClient().db
        ).rename(id, user.id, trimmed);
        return { ok: true };
    } catch (error) {
        logActionError('[renameConversationAction] rename failed', error);
        return { ok: false };
    }
}
