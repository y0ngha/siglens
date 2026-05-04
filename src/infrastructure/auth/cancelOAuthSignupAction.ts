'use server';

import { redirect } from 'next/navigation';
import { createPendingOAuthSignupStoreFromEnv } from '@/infrastructure/auth/pendingOAuthSignupStore';

export async function cancelOAuthSignupAction(formData: FormData): Promise<void> {
    const token = String(formData.get('token') ?? '').trim();
    if (token) {
        const store = createPendingOAuthSignupStoreFromEnv();
        if (store) await store.delete(token);
    }
    redirect('/login');
}
