'use server';

import type { AuthUserRecord } from '@y0ngha/siglens-core';
import { getCurrentUser } from './getCurrentUser';

export async function currentUserAction(): Promise<AuthUserRecord | null> {
    return getCurrentUser();
}
