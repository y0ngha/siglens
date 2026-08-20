import { getTranslations } from 'next-intl/server';
import { DEFAULT_LOCALE, isLocale } from '@/shared/i18n/locales';
import { localeCanonical } from '@/shared/lib/seoAlternates';
import { setRequestLocale } from 'next-intl/server';
import { localeRedirect } from '@/shared/i18n/localeRedirect';
import { Suspense } from 'react';
import { AuthCardShell } from '@/shared/ui/auth/AuthCardShell';
import { OAuthConsentForm } from '@/features/auth-oauth-consent';
import { createPendingOAuthSignupStoreFromEnv } from '@/entities/oauth-account';
import { cancelOAuthSignupAction } from '@/features/auth-oauth/actions';
import { OAUTH_ERROR_REDIRECT } from '@/entities/auth';
import { SITE_NAME } from '@/shared/lib/seo';
import type { Metadata } from 'next';

// noindex 페이지에도 canonical/openGraph.url을 명시한다. 자세한 근거는 src/app/login/page.tsx 주석 참조.
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
    const { locale } = await params;
    const resolved = isLocale(locale) ? locale : DEFAULT_LOCALE;
    return {
        title: '소셜 로그인 가입 동의',
        description: `${SITE_NAME} 소셜 로그인 가입 약관 동의`,
        alternates: {
            canonical: localeCanonical(resolved, '/signup/oauth/consent'),
        },
        openGraph: { url: localeCanonical(resolved, '/signup/oauth/consent') },
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
    // 정적 렌더 활성화. 이 호출이 없으면 next-intl의 서버 API가 `headers()`로
    // 폴백해 **이 라우트의 ISR이 통째로 꺼진다**(빌드 route 표에서 `●` → `ƒ`).
    setRequestLocale(locale);
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
