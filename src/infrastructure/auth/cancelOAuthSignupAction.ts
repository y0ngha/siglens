'use server';

import { redirect } from 'next/navigation';
import { createPendingOAuthSignupStoreFromEnv } from '@/infrastructure/auth/pendingOAuthSignupStore';

export async function cancelOAuthSignupAction(formData: FormData): Promise<void> {
    const token = String(formData.get('token') ?? '').trim();
    if (token) {
        const store = createPendingOAuthSignupStoreFromEnv();
        if (store) {
            try {
                await store.delete(token);
            } catch {
                // Best-effort cleanup: if Redis is unavailable, the token will TTL-expire on its own.
            }
        }
    }
    redirect('/login');
}
