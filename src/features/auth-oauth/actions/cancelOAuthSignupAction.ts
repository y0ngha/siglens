'use server';

import { redirect } from 'next/navigation';
import { createPendingOAuthSignupStoreFromEnv } from '@/entities/oauth-account';

export async function cancelOAuthSignupAction(
    formData: FormData
): Promise<void> {
    try {
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
    } catch (err) {
        // Re-throw Next.js redirect (not an error — it's a control-flow signal).
        if (err instanceof Error && err.message.startsWith('NEXT_REDIRECT')) {
            throw err;
        }
        redirect('/login');
    }
}
