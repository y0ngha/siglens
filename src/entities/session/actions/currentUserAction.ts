'use server';

import type { AuthUserRecord } from '@/shared/lib/auth/types';
import { getCurrentUser } from '../lib/getCurrentUser';

export async function currentUserAction(): Promise<AuthUserRecord | null> {
    try {
        return await getCurrentUser();
    } catch (err) {
        console.error('[currentUserAction] unexpected error:', err);
        return null;
    }
}
