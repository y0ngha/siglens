import { getTranslations } from 'next-intl/server';
import { localeCanonical } from '@/shared/lib/seoAlternates';
import { DEFAULT_LOCALE, isLocale } from '@/shared/i18n/locales';
import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { AuthCardShell, AuthFormSkeleton } from '@/shared/ui/auth';
import { SITE_NAME } from '@/shared/lib/seo';
import type { Metadata } from 'next';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { LoginContent } from './LoginContent';

// noindex 페이지에도 canonical을 두는 이유: ?next=/path 같은 쿼리 변형 URL이 외부에 공유되더라도
// "원본은 /login 하나"라는 신호를 명확히 해 두면 일부 크롤러/공유 도구가 변형을 강조하지 않게 된다.
// openGraph.url을 명시해 두지 않으면 root layout의 og:url(SITE_URL)이 그대로 상속되어
// canonical과 og:url이 불일치한다(SEO 일관성 위반).
/**
 * 정적 `metadata`가 아니라 `generateMetadata`인 이유: 정적 객체는 로케일을 볼 수
 * 없어 `/en/login`도 canonical이 `/login`(한국어)로 나갔다. noindex 페이지에
 * 다른 URL을 canonical로 걸면 Google이 noindex를 그 대상으로 전파할 수 있다.
 */
export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const resolved = isLocale(locale) ? locale : DEFAULT_LOCALE;
    return {
        title: '로그인',
        description: `${SITE_NAME}에 로그인하여 회원 전용 기능을 이용해보세요.`,
        alternates: { canonical: localeCanonical(resolved, '/login') },
        openGraph: { url: localeCanonical(resolved, '/login') },
        robots: { index: false, follow: true },
    };
}

// searchParams 읽기를 LoginContent('use client')로 격리해 이 라우트는 full-static(○)으로 prerender된다.
// shell/footer/metadata는 정적, 쿼리 의존부만 Suspense 아래에서 CSR.
export default async function LoginPage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    // 정적 렌더 활성화. 이 호출이 없으면 next-intl의 서버 API가 `headers()`로
    // 폴백해 **이 라우트의 ISR이 통째로 꺼진다**(빌드 route 표에서 `●` → `ƒ`).
    // 실측으로 확인했다 — Next 16.2는 `next/root-params` 미지원이라 이 경로가 유일하다.
    setRequestLocale(locale);
    const t = await getTranslations('app.login');
    return (
        <AuthCardShell
            title={t('page.9d6e84')}
            subtitle={t('page.2241cc')}
            footer={
                <div className="space-y-2">
                    <p>
                        <Link
                            href="/forgot-password"
                            className="font-medium text-primary-400 underline-offset-4 hover:text-primary-300 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                        >
                            {t('page.313efe')}
                        </Link>
                    </p>
                    <p>
                        {t('page.15bb24')}{' '}
                        <Link
                            href="/signup"
                            className="font-medium text-primary-400 underline-offset-4 hover:text-primary-300 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                        >
                            {t('page.49f561')}
                        </Link>
                    </p>
                </div>
            }
        >
            <Suspense fallback={<AuthFormSkeleton rows={2} />}>
                <LoginContent />
            </Suspense>
        </AuthCardShell>
    );
}
