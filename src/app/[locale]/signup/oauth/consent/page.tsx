import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { resolveLocale } from '@/shared/i18n/locales';
import { brandName } from '@/shared/lib/brandName';
import { enterLocale } from '@/shared/lib/enterLocale';
import { localeCanonical, localePageSocial } from '@/shared/lib/seoAlternates';
import { AuthCardShell } from '@/shared/ui/auth/AuthCardShell';
import { ConsentContent } from './_components/ConsentContent';

const PATH = '/signup/oauth/consent';

/**
 * 로케일별 메타데이터 — 정적 `metadata`는 로케일을 볼 수 없어 `/ja/signup/oauth/consent`의
 * canonical이 한국어 URL로 나간다. og·twitter도 이 페이지 값으로 채운다: 일부만 두면 Next가
 * `openGraph`를 통째로 교체해 og:title이 빠지고, `twitter`는 루트 레이아웃의 홈 제목·설명을
 * 그대로 상속한다.
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
    const title = tSeo('oauthConsentTitle');
    const description = tSeo('oauthConsentFullTitle', {
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

/** 페이지 props — 로케일 세그먼트의 `params`와 동의 토큰이 든 `searchParams`. */
interface PageProps {
    readonly params: Promise<{ locale: string }>;
    readonly searchParams: Promise<{ token?: string | string[] }>;
}

/** 소셜 로그인 신규 가입의 약관 동의 페이지. 카드 껍데기는 쿼리와 무관해 먼저 그린다. */
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
