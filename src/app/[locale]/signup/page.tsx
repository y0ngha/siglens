import { getTranslations } from 'next-intl/server';
import { localeCanonical, localePageSocial } from '@/shared/lib/seoAlternates';
import { DEFAULT_LOCALE, isLocale } from '@/shared/i18n/locales';
import { Suspense } from 'react';

import { setRequestLocale } from 'next-intl/server';
import { AuthCardShell, AuthFormSkeleton } from '@/shared/ui/auth';
import type { Metadata } from 'next';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { SignupContent } from './SignupContent';

// noindex 페이지에도 canonical/openGraph.url을 명시한다. 자세한 근거는 src/app/login/page.tsx 주석 참조.
/**
 * 정적 `metadata`가 아니라 `generateMetadata`인 이유: 정적 객체는 로케일을 볼 수
 * 없어 `/en/signup`도 canonical이 `/signup`(한국어)로 나갔다. noindex 페이지에
 * 다른 URL을 canonical로 걸면 Google이 noindex를 그 대상으로 전파할 수 있다.
 */
export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const resolved = isLocale(locale) ? locale : DEFAULT_LOCALE;
    const tSeo = await getTranslations({
        locale: resolved,
        namespace: 'shared.seo',
    });
    const title = tSeo('signup.title');
    const description = tSeo('signup.description');
    return {
        title,
        description,
        alternates: { canonical: localeCanonical(resolved, '/signup') },
        ...localePageSocial(resolved, '/signup', {
            title,
            description,
        }),
        robots: { index: false, follow: true },
    };
}

// searchParams 읽기를 SignupContent('use client')로 격리해 이 라우트는 full-static(○)으로 prerender된다.
export default async function SignupPage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    // 정적 렌더 활성화. 이 호출이 없으면 next-intl의 서버 API가 `headers()`로
    // 폴백해 **이 라우트의 ISR이 통째로 꺼진다**(빌드 route 표에서 `●` → `ƒ`).
    // 실측으로 확인했다 — Next 16.2는 `next/root-params` 미지원이라 이 경로가 유일하다.
    setRequestLocale(locale);
    const t = await getTranslations('app.signup');
    return (
        <AuthCardShell
            title={t('page.925d56')}
            subtitle={t('page.1c6c68')}
            footer={
                <p>
                    {t('page.9922a0')}{' '}
                    <Link
                        href="/login"
                        className="font-medium text-primary-400 underline-offset-4 hover:text-primary-300 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        {t('page.e2d231')}
                    </Link>
                </p>
            }
        >
            <Suspense fallback={<AuthFormSkeleton rows={3} />}>
                <SignupContent />
            </Suspense>
        </AuthCardShell>
    );
}
