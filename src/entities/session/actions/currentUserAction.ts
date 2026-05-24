'use server';

import type { AuthUserRecord } from '@/shared/lib/auth/types';
import { getCurrentUser } from '../lib/getCurrentUser';

export async function currentUserAction(): Promise<AuthUserRecord | null> {
    return getCurrentUser();
}
