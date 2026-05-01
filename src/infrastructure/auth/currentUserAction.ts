'use server';

import type { AuthUserRecord } from '@/infrastructure/db/types';
import { getCurrentUser } from './getCurrentUser';

export async function currentUserAction(): Promise<AuthUserRecord | null> {
    return getCurrentUser();
}
