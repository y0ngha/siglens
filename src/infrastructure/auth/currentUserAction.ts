'use server';

import type { AuthUserRecord } from '@/domain/auth/types';
import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';

export async function currentUserAction(): Promise<AuthUserRecord | null> {
    return getCurrentUser();
}
