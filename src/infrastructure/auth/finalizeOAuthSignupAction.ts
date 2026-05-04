'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { applyAuthCookie } from '@/infrastructure/auth/applyAuthCookie';
import { createAuthHintCookie } from '@/infrastructure/auth/authHintCookie';
import {
    createAuthSession,
    DEFAULT_SESSION_TTL_SECONDS,
} from '@/infrastructure/auth/sessionCookie';
import { getAuthDatabaseClient } from '@/infrastructure/auth/db';
import { isSecureCookieEnv } from '@/infrastructure/auth/sessionCookieOptions';
import { createPendingOAuthSignupStoreFromEnv } from '@/infrastructure/auth/pendingOAuthSignupStore';
import { DrizzleAgreementRepository } from '@/infrastructure/db/agreementRepository';
import { DrizzleSessionRepository } from '@/infrastructure/db/sessionRepository';
import { DrizzleTermsRepository } from '@/infrastructure/db/termsRepository';
import { DrizzleUserRepository } from '@/infrastructure/db/userRepository';
import { sanitizeNextPath } from '@/domain/auth/redirect';
import type { FinalizeOAuthSignupState } from '@/domain/auth/formTypes';
import type { SiglensDatabase } from '@/infrastructure/db/types';
import {
    CONSENT_REQUIRED_MESSAGE,
    OAUTH_ERROR_REDIRECT,
} from '@/infrastructure/auth/errorMessages';

export async function finalizeOAuthSignupAction(
    _prev: FinalizeOAuthSignupState,
    formData: FormData
): Promise<FinalizeOAuthSignupState> {
    try {
        const token = String(formData.get('token') ?? '').trim();
        const agreedPrivacy = String(formData.get('agreed_privacy') ?? '');
        const agreedTos = String(formData.get('agreed_tos') ?? '');

        if (!token) {
            redirect(OAUTH_ERROR_REDIRECT.consentInvalid);
        }

        if (agreedPrivacy !== 'true' || agreedTos !== 'true') {
            return {
                error: {
                    code: 'consent_required',
                    message: CONSENT_REQUIRED_MESSAGE,
                },
            };
        }

        const store = createPendingOAuthSignupStoreFromEnv();
        if (!store) {
            redirect(OAUTH_ERROR_REDIRECT.serviceUnavailable);
        }

        const profile = await store.peek(token);
        if (!profile) {
            redirect(OAUTH_ERROR_REDIRECT.consentExpired);
        }

        const { db } = getAuthDatabaseClient();
        const termsRepo = new DrizzleTermsRepository(db);
        const [termsP, termsT] = await Promise.all([
            termsRepo.findActive('privacy'),
            termsRepo.findActive('tos'),
        ]);
        if (!termsP || !termsT) {
            redirect(OAUTH_ERROR_REDIRECT.serviceUnavailable);
        }

        const consumed = await store.consume(token);
        if (!consumed) {
            redirect(OAUTH_ERROR_REDIRECT.consentExpired);
        }

        const userRepo = new DrizzleUserRepository(db);
        const sessionRepo = new DrizzleSessionRepository(db);

        const conflict = await userRepo.findByEmail(consumed.email);
        if (conflict) {
            redirect(OAUTH_ERROR_REDIRECT.emailConflict);
        }

        // .catch(() => redirect(...)) — redirect() returns `never`, so the resolved type is `string | never` = `string`.
        const createdUserId = await db
            .transaction(async tx => {
                // Safe: db.transaction always passes a SiglensDatabase tx to its callback.
                const txDb = tx as unknown as SiglensDatabase;
                const txUserRepo = new DrizzleUserRepository(txDb);
                const txAgreementRepo = new DrizzleAgreementRepository(txDb);
                const created = await txUserRepo.createOAuthUser({
                    email: consumed.email,
                    provider: consumed.provider,
                    providerAccountId: consumed.providerAccountId,
                    name: consumed.name,
                    avatarUrl: consumed.avatarUrl,
                    accessToken: consumed.accessToken,
                    refreshToken: consumed.refreshToken,
                    tokenExpiresAt: consumed.tokenExpiresAt
                        ? new Date(consumed.tokenExpiresAt)
                        : undefined,
                });
                if (!created) {
                    throw new Error('createOAuthUser returned null');
                }
                const now = new Date();
                await txAgreementRepo.insertMany([
                    {
                        userId: created.id,
                        termsId: termsP.id,
                        agreed: true,
                        agreedAt: now,
                    },
                    {
                        userId: created.id,
                        termsId: termsT.id,
                        agreed: true,
                        agreedAt: now,
                    },
                ]);
                return created.id;
            })
            .catch(err => {
                console.error('[finalizeOAuthSignupAction] transaction failed:', err);
                return redirect(OAUTH_ERROR_REDIRECT.serviceUnavailable);
            });

        const secure = isSecureCookieEnv();
        const { cookie } = await createAuthSession({
            userId: createdUserId,
            sessions: sessionRepo,
            now: new Date(),
            secureCookie: secure,
        });

        const cookieStore = await cookies();
        cookieStore.set(applyAuthCookie(cookie));
        cookieStore.set(
            createAuthHintCookie({
                maxAgeSeconds: DEFAULT_SESSION_TTL_SECONDS,
                secure,
            })
        );

        redirect(sanitizeNextPath(consumed.next));
    } catch (err) {
        // Re-throw Next.js redirect (not an error — it's a control-flow signal).
        if (err instanceof Error && err.message.startsWith('NEXT_REDIRECT')) {
            throw err;
        }
        console.error('[finalizeOAuthSignupAction] unexpected error:', err);
        redirect(OAUTH_ERROR_REDIRECT.serviceUnavailable);
    }
}
