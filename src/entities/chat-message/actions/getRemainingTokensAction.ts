'use server';

import { createChatTokenStore, hashClientIp } from '@y0ngha/siglens-core';
import { getClientIp } from '../api/getClientIp';

export async function getRemainingTokensAction(): Promise<number | null> {
    try {
        const clientIp = await getClientIp();
        const tokenStore = createChatTokenStore();
        return await tokenStore.getRemainingTokens(hashClientIp(clientIp));
    } catch {
        return null;
    }
}
