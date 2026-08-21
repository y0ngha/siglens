import { getTranslations } from 'next-intl/server';
import { localeCanonical } from '@/shared/lib/seoAlternates';
import type { Metadata } from 'next';
import {
    DEFAULT_LOCALE,
    isLocale,
    localePath,
    type Locale,
} from '@/shared/i18n/locales';
import { setRequestLocale } from 'next-intl/server';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { AuthCardShell } from '@/shared/ui/auth/AuthCardShell';
import { DeleteAccountConfirm } from '@/features/account-delete';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { SITE_NAME } from '@/shared/lib/seo';

// noindex 페이지에도 canonical/og:url을 명시한다 (login/signup 정책과 일관).
/**
 * 정적 `metadata`가 아니라 `generateMetadata`인 이유: 정적 객체는 로케일을 볼 수
 * 없어 `/ja/account/delete`도 canonical이 한국어 URL로 나갔다. noindex 페이지에 다른 URL을
 * canonical로 걸면 Google이 noindex를 그 대상으로 전파할 수 있다.
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
    return {
        title: tSeo('accountDeleteTitle'),
        description: tSeo('accountDeleteFullTitle', { v0: SITE_NAME }),
        alternates: { canonical: localeCanonical(resolved, '/account/delete') },
        openGraph: { url: localeCanonical(resolved, '/account/delete') },
        robots: { index: false, follow: false },
    };
}

// Reads cookies via getCurrentUser — must be inside Suspense for PPR.
async function DeleteAccountContent({ locale }: { locale: Locale }) {
    const user = await getCurrentUser();
    if (!user) {
        // 로케일을 유지한다 — 영어 사용자가 한국어 로그인 페이지로 떨어지면 안 된다.
        redirect(
            `${localePath(locale, '/login')}?next=${encodeURIComponent(
                localePath(locale, '/account/delete')
            )}`
        );
    }
    return <DeleteAccountConfirm userEmail={user.email} />;
}

export default async function DeleteAccountPage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
    // 정적 렌더 활성화. 이 호출이 없으면 next-intl의 서버 API가 `headers()`로
    // 폴백해 **이 라우트의 ISR이 통째로 꺼진다**(빌드 route 표에서 `●` → `ƒ`).
    // 실측으로 확인했다 — Next 16.2는 `next/root-params` 미지원이라 이 경로가 유일하다.
    setRequestLocale(locale);
    const t = await getTranslations('app.account');
    return (
        <AuthCardShell
            title={t('page.3a0c2b')}
            subtitle={t('page.752a1e')}
            footer={
                <p>
                    {t('page.bfc060')}{' '}
                    <Link
                        href="/account"
                        className="font-medium text-primary-400 underline-offset-4 hover:text-primary-300 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        {t('page.1b62d0')}
                    </Link>
                </p>
            }
        >
            {/* fallback: 인접 /account 페이지가 skeleton을 제공하는 패턴과
                일관성. 빈 카드 대신 최소한의 시각 피드백을 줘 destructive 흐름
                에서 사용자가 시스템이 응답 중임을 인지하게 한다. role="status"
                + aria-live="polite"로 스크린 리더가 마운트 시 로딩 상태를
                즉시 announce하도록 명시. */}
            <Suspense
                fallback={
                    <div
                        role="status"
                        aria-live="polite"
                        className="flex items-center justify-center gap-2 py-6"
                    >
                        <span
                            aria-hidden="true"
                            className="h-3 w-3 animate-spin rounded-full border-2 border-secondary-500 border-t-transparent"
                        />
                        <span className="text-xs text-secondary-400">
                            {t('page.109043')}
                        </span>
                    </div>
                }
            >
                <DeleteAccountContent locale={locale} />
            </Suspense>
        </AuthCardShell>
    );
}
