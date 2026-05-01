'use server';

import { waitUntil } from '@vercel/functions';
import {
    DrizzleUserRepository,
    requestPasswordReset,
} from '@y0ngha/siglens-core';
import type { ForgotPasswordFormState } from '@/domain/auth/formTypes';
import { buildPasswordResetEmail } from '@/infrastructure/email/passwordResetEmail';
import { createEmailDispatcher } from '@/infrastructure/email/resend';
import { getAuthDatabaseClient } from './db';
import {
    passwordResetTokenGenerator,
    passwordResetTokenHasher,
} from './passwordResetTokenService';

const EMAIL_SEND_TIMEOUT_MS = 10_000;
const DEFAULT_SITE_URL = 'https://siglens.io';
// Matches SITE_NAME in src/lib/seo.ts; keep email branding in sync with public SEO metadata.
const SITE_NAME = 'Siglens';

function readSiteUrl(): string {
    return process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL;
}

export async function requestPasswordResetAction(
    _prev: ForgotPasswordFormState,
    formData: FormData
): Promise<ForgotPasswordFormState> {
    const email = String(formData.get('email') ?? '').trim();

    const { db } = getAuthDatabaseClient();
    const repo = new DrizzleUserRepository(db);
    const result = await requestPasswordReset(
        { email },
        {
            users: repo,
            passwordResets: repo,
            tokenGenerator: passwordResetTokenGenerator,
            tokenHasher: passwordResetTokenHasher,
        }
    );

    if (result.token !== null) {
        const dispatcher = createEmailDispatcher();
        const message = buildPasswordResetEmail({
            to: email,
            token: result.token,
            expiresAt: result.expiresAt,
            siteUrl: readSiteUrl(),
            siteName: SITE_NAME,
        });
        waitUntil(
            dispatcher.sendEmail(message, {
                signal: AbortSignal.timeout(EMAIL_SEND_TIMEOUT_MS),
            })
        );
    }

    return { submitted: true };
}
