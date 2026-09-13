'use server';

import { createChatTokenStore, hashClientIp } from '@y0ngha/siglens-core';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getOrCreateGuestId } from '@/shared/api/guestId';

export async function getRemainingTokensAction(): Promise<number | null> {
    try {
        const user = await getCurrentUser();
        /**
         * Core's token bucket key is an opaque per-visitor id, not
         * necessarily an IP — a signed-in user's own id, or the
         * `siglens_guest` cookie id for a guest (`shared/api/guestId.ts`),
         * mirroring `chatAction`'s `clientKey`. Hashed the same way
         * (`hashClientIp`) so both actions read/write the same bucket for a
         * given visitor.
         */
        const clientKey = user
            ? `user:${user.id}`
            : `guest:${await getOrCreateGuestId()}`;
        const tokenStore = createChatTokenStore();
        return await tokenStore.getRemainingTokens(hashClientIp(clientKey));
    } catch {
        return null;
    }
}
