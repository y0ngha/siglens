import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { DeleteAccountConfirm } from '@/features/account-delete/ui/DeleteAccountConfirm';
import { resolveLocale, type Locale } from '@/shared/i18n/locales';
import { brandName } from '@/shared/lib/brandName';
import { enterLocale } from '@/shared/lib/enterLocale';
import { localeCanonical, localePageSocial } from '@/shared/lib/seoAlternates';
import { AuthCardShell } from '@/shared/ui/auth/AuthCardShell';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { Spinner } from '@/shared/ui/Spinner';
import { localePathToLogin } from '../../_personal/localePathToLogin';

const PATH = '/account/delete';

/**
 * 로케일별 메타데이터 — `/account`와 같은 이유로 정적 `metadata`가 아니다. og·twitter도 이
 * 페이지 값으로 채운다: 일부만 두면 Next가 `openGraph`를 통째로 교체해 og:title이 빠지고,
 * `twitter`는 루트 레이아웃의 홈 제목·설명을 그대로 상속한다.
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
    const title = tSeo('accountDeleteTitle');
    const description = tSeo('accountDeleteFullTitle', {
        v0: brandName(locale),
    });
    return {
        title,
        description,
        alternates: { canonical: localeCanonical(locale, PATH) },
        ...localePageSocial(locale, PATH, { title, description }),
        robots: { index: false, follow: false },
    };
}

/** 세션을 읽어 탈퇴 확인 폼에 본인 이메일을 넘긴다. 쿠키를 읽으므로 Suspense 안에서 그린다. */
async function DeleteAccountContent({ locale }: { locale: Locale }) {
    const user = await getCurrentUser();
    if (!user) redirect(localePathToLogin(locale, PATH));
    return <DeleteAccountConfirm userEmail={user.email} />;
}

/** 회원 탈퇴 확인 페이지. 카드 껍데기·문구는 세션과 무관해 Suspense 밖에서 먼저 그린다. */
export default async function DeleteAccountPage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = enterLocale(rawLocale);
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
            {/* 파괴적 흐름이라 빈 카드 대신 로딩 상태를 보여 주고, role="status"로 스크린 리더에도
                알린다. */}
            <Suspense
                fallback={
                    <div
                        role="status"
                        aria-live="polite"
                        className="flex items-center justify-center gap-2 py-6"
                    >
                        <Spinner size="sm" tone="muted" />
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
