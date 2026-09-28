import { getTranslations } from 'next-intl/server';
import { resolveLocale } from '@/shared/i18n/locales';
import { localeCanonical } from '@/shared/lib/seoAlternates';
import { localeRedirect } from '@/shared/i18n/localeRedirect';
import { Suspense } from 'react';
import { AuthCardShell } from '@/shared/ui/auth/AuthCardShell';
import { OAuthConsentForm } from '@/features/auth-oauth-consent/ui/OAuthConsentForm';
import { createPendingOAuthSignupStoreFromEnv } from '@/entities/oauth-account/lib/pendingOAuthSignupStore';
import { cancelOAuthSignupAction } from '@/features/auth-oauth/actions/cancelOAuthSignupAction';
import { OAUTH_ERROR_REDIRECT } from '@/entities/auth/lib/errorMessages';
import { SITE_NAME } from '@/shared/lib/seo';
import type { Metadata } from 'next';
import { enterLocale } from '@/shared/lib/enterLocale';

// noindex 페이지에도 canonical/openGraph.url을 명시한다. 자세한 근거는 src/app/[locale]/login/page.tsx 주석 참조.
/**
 * 정적 `metadata`가 아니라 `generateMetadata`인 이유: 정적 객체는 로케일을 볼 수
 * 없어 `/ja/signup/oauth/consent`도 canonical이 한국어 URL로 나갔다. noindex 페이지에 다른 URL을
 * canonical로 걸면 Google이 noindex를 그 대상으로 전파할 수 있다.
 */
export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale: rawLocale } = await params;
    const locale = resolveLocale(rawLocale);
    const tSeo = await getTranslations({
        locale,
        namespace: 'shared.seo',
    });
    return {
        title: tSeo('oauthConsentTitle'),
        description: tSeo('oauthConsentFullTitle', { v0: SITE_NAME }),
        alternates: {
            canonical: localeCanonical(locale, '/signup/oauth/consent'),
        },
        openGraph: { url: localeCanonical(locale, '/signup/oauth/consent') },
        robots: { index: false, follow: false },
    };
}

interface ConsentContentProps {
    searchParams: Promise<{ token?: string }>;
}

/** 페이지 props — 로케일 세그먼트 때문에 `params`가 추가로 들어온다. */
interface PageProps extends ConsentContentProps {
    readonly params: Promise<{ locale: string }>;
}

async function ConsentContent({ searchParams }: ConsentContentProps) {
    const params = await searchParams;
    const token = params.token;
    if (!token) {
        return localeRedirect(OAUTH_ERROR_REDIRECT.consentInvalid);
    }

    const store = createPendingOAuthSignupStoreFromEnv();
    if (!store) {
        return localeRedirect(OAUTH_ERROR_REDIRECT.serviceUnavailable);
    }

    const profile = await store.peek(token);
    if (!profile) {
        return localeRedirect(OAUTH_ERROR_REDIRECT.consentExpired);
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

export default async function OAuthConsentPage({
    params,
    searchParams,
}: PageProps) {
    const { locale } = await params;
    enterLocale(locale);
    const t = await getTranslations('app.signup');
    return (
        <AuthCardShell title={t('page.8ba06b')} subtitle={t('page.f0c59b')}>
            <Suspense
                fallback={<div className="animate-pulse" aria-hidden="true" />}
            >
                <ConsentContent searchParams={searchParams} />
            </Suspense>
        </AuthCardShell>
    );
}
