'use server';

import { headers } from 'next/headers';
import { hashIp, getRemainingTokens } from '@/infrastructure/chat/tokenStore';

export async function getRemainingTokensAction(): Promise<number | null> {
    try {
        const headersList = await headers();
        const ip =
            headersList.get('x-forwarded-for')?.split(',')[0].trim() ??
            'unknown';
        return await getRemainingTokens(hashIp(ip));
    } catch {
        return null;
    }
}
