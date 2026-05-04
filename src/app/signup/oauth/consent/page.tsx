import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AuthCardShell } from '@/components/auth/AuthCardShell';
import { OAuthConsentForm } from '@/components/auth/OAuthConsentForm';
import { createPendingOAuthSignupStoreFromEnv } from '@/infrastructure/auth/pendingOAuthSignupStore';
import { cancelOAuthSignupAction } from '@/infrastructure/auth/cancelOAuthSignupAction';
import { OAUTH_ERROR_REDIRECT } from '@/infrastructure/auth/errorMessages';
import { SITE_NAME } from '@/lib/seo';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: '소셜 로그인 가입 동의',
    description: `${SITE_NAME} 소셜 로그인 가입 약관 동의`,
    robots: { index: false, follow: false },
};

interface PageProps {
    searchParams: Promise<{ token?: string }>;
}

async function ConsentContent({ searchParams }: PageProps) {
    const params = await searchParams;
    const token = params.token;
    if (!token) {
        redirect(OAUTH_ERROR_REDIRECT.consentInvalid);
    }

    const store = createPendingOAuthSignupStoreFromEnv();
    if (!store) {
        redirect(OAUTH_ERROR_REDIRECT.serviceUnavailable);
    }

    const profile = await store.peek(token);
    if (!profile) {
        redirect(OAUTH_ERROR_REDIRECT.consentExpired);
    }

    return (
        <OAuthConsentForm
            token={token}
            provider={profile.provider}
            email={profile.email}
            name={profile.name}
            avatarUrl={profile.avatarUrl}
            cancelAction={cancelOAuthSignupAction}
        />
    );
}

export default function OAuthConsentPage({ searchParams }: PageProps) {
    return (
        <AuthCardShell
            title="소셜 로그인 가입"
            subtitle="아래 정보로 SigLens에 가입됩니다"
        >
            <Suspense>
                <ConsentContent searchParams={searchParams} />
            </Suspense>
        </AuthCardShell>
    );
}
