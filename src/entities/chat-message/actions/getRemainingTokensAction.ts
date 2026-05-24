'use server';

import { createChatTokenStore, hashClientIp } from '@y0ngha/siglens-core';
import { headers } from 'next/headers';

export async function getRemainingTokensAction(): Promise<number | null> {
    try {
        const headersList = await headers();
        const clientIp =
            headersList.get('x-forwarded-for')?.split(',')[0].trim() ??
            'unknown';
        const tokenStore = createChatTokenStore();
        return await tokenStore.getRemainingTokens(hashClientIp(clientIp));
    } catch {
        return null;
    }
}
