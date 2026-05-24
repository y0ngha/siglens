import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AuthCardShell } from '@/shared/ui/auth/AuthCardShell';
import { OAuthConsentForm } from '@/features/auth-oauth-consent';
import { createPendingOAuthSignupStoreFromEnv } from '@/entities/oauth-account';
import { cancelOAuthSignupAction } from '@/features/auth-oauth/actions';
import { OAUTH_ERROR_REDIRECT } from '@/entities/session';
import { SITE_NAME, SITE_URL } from '@/shared/lib/seo';
import type { Metadata } from 'next';

// noindex 페이지에도 canonical/openGraph.url을 명시한다. 자세한 근거는 src/app/login/page.tsx 주석 참조.
export const metadata: Metadata = {
    title: '소셜 로그인 가입 동의',
    description: `${SITE_NAME} 소셜 로그인 가입 약관 동의`,
    alternates: { canonical: `${SITE_URL}/signup/oauth/consent` },
    openGraph: { url: `${SITE_URL}/signup/oauth/consent` },
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
            <Suspense
                fallback={<div className="animate-pulse" aria-hidden="true" />}
            >
                <ConsentContent searchParams={searchParams} />
            </Suspense>
        </AuthCardShell>
    );
}
