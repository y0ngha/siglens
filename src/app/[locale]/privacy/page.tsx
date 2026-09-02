import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DEFAULT_LOCALE, isLocale } from '@/shared/i18n/locales';
import {
    localeAlternatesFrom,
    localeOpenGraph,
    localeRobots,
} from '@/shared/lib/seoAlternates';
import { PolicyMarkdownBody } from '@/widgets/legal/PolicyMarkdownBody';
import { LegalPageShell } from '@/widgets/legal/LegalPageShell';
import { UntranslatedNotice } from '@/widgets/legal/UntranslatedNotice';
import { JsonLd } from '@/shared/ui/JsonLd';
import {
    formatKoreanDate,
    INVESTMENT_DISCLAIMER_KEY,
    privacyDescription,
    privacyFullTitle,
    PRIVACY_PATH,
    privacyTitle,
    TERMS_PATH,
    termsTitle,
} from '@/shared/lib/legal';
import { extractToc } from '@/shared/lib/legal-toc';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import {
    buildBreadcrumbJsonLd,
    buildWebPageJsonLd,
    SITE_NAME,
    SITE_URL,
    localizedAbsoluteUrl,
} from '@/shared/lib/seo';
import type { Locale } from '@/shared/i18n/locales';
import type { SeoTranslator } from '@/shared/lib/seo';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleTermsRepository } from '@/entities/terms';
import type { Metadata } from 'next';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { notFound } from 'next/navigation';

const PAGE_URL = `${SITE_URL}${PRIVACY_PATH}`;

/**
 * 약관 본문은 코드가 아니라 `terms` 테이블에 있고, 발효일이 되면
 * `findActive`의 `effective_date <= NOW()`가 새 버전으로 넘어간다. 그런데 그
 * 쿼리는 **페이지가 렌더될 때만** 평가된다 — 재검증이 없으면 빌드 시점 HTML이
 * `s-maxage=31536000`으로 굳어, 발효일이 지나도 다음 배포까지 옛 버전이 계속
 * 나간다. 실제로 v0.69.0에서 그 상태를 만들었다(방문자 수집은 시작됐는데 그것을
 * 고지하는 개정 방침은 정적 HTML에 갇혀 있었다).
 *
 * 번역도 같은 경로다. `content_translations`에 인간 번역을 적재해도 재생성이
 * 없으면 화면에 나오지 않는다.
 *
 * 하루면 충분하다 — 약관 개정은 사전 고지를 거치므로 시각 단위 정확도가 필요
 * 없고, 재생성 비용은 DB 조회 한 번이다.
 */
export const revalidate = 86400;

/**
 * 모듈 스코프 상수였다 — 그 자리에서는 번역자도 로케일도 없어 JSON-LD가
 * 항상 한국어·기본 로케일 URL로 굳었다. 렌더 시점 함수로 바꾼다.
 */
function buildPrivacyJsonLd(t: SeoTranslator, locale: Locale) {
    return {
        ...buildWebPageJsonLd({
            url: PAGE_URL,
            name: privacyFullTitle(t),
            description: privacyDescription(t),
            locale,
        }),
    };
}

function buildPrivacyBreadcrumbJsonLd(t: SeoTranslator, locale: Locale) {
    return buildBreadcrumbJsonLd(
        [{ name: privacyTitle(t), url: PAGE_URL }],
        locale
    );
}

interface LocaleMetadataParams {
    readonly params: Promise<{ locale: string }>;
}

export async function generateMetadata({
    params,
}: LocaleMetadataParams): Promise<Metadata> {
    const { locale } = await params;
    const resolved = isLocale(locale) ? locale : DEFAULT_LOCALE;
    const ogLocale = localeOpenGraph(resolved);
    const tSeo = await getTranslations({
        locale: resolved,
        namespace: 'shared.seo',
    });
    return {
        title: privacyTitle(tSeo),
        description: privacyDescription(tSeo),
        robots: localeRobots(resolved),
        alternates: await localeAlternatesFrom(params, PRIVACY_PATH),
        openGraph: {
            type: 'article',
            siteName: SITE_NAME,
            title: privacyFullTitle(tSeo),
            description: privacyDescription(tSeo),
            url: localizedAbsoluteUrl(PAGE_URL, resolved),
            ...ogLocale,
            images: [
                {
                    url: '/og-image.png',
                    width: OG_IMAGE_WIDTH,
                    height: OG_IMAGE_HEIGHT,
                    alt: privacyFullTitle(tSeo),
                },
            ],
        },
        twitter: {
            card: 'summary',
            title: privacyFullTitle(tSeo),
            description: privacyDescription(tSeo),
            images: ['/og-image.png'],
        },
    };
}

async function PrivacyContent({ locale }: { readonly locale: Locale }) {
    const tSeo = await getTranslations({ locale, namespace: 'shared.seo' });
    const tLegal = await getTranslations({
        locale,
        namespace: 'shared.lib.legal',
    });
    const { db } = getDatabaseClient();
    const repo = new DrizzleTermsRepository(db);
    const terms = await repo.findActive('privacy', locale);

    if (!terms) {
        notFound();
    }

    const toc = extractToc(terms.body);

    return (
        <LegalPageShell
            breadcrumbTitle={privacyTitle(tSeo)}
            eyebrow="PRIVACY POLICY"
            title={privacyTitle(tSeo)}
            intro={tLegal('privacyIntro', { v0: SITE_NAME })}
            effectiveDate={formatKoreanDate(terms.effectiveDate, locale)}
            toc={toc}
            topNotice={
                terms.isTranslationFallback ? (
                    <UntranslatedNotice
                        requested={locale}
                        served={terms.bodyLocale}
                    />
                ) : undefined
            }
            bottomNotice={
                <div
                    role="note"
                    aria-label={tSeo('a11y.investmentDisclaimer')}
                    className="mt-12 rounded-lg border border-secondary-700 bg-secondary-900/40 p-5"
                >
                    <p className="text-xs leading-relaxed text-secondary-400 sm:text-sm">
                        {tLegal(INVESTMENT_DISCLAIMER_KEY)}{' '}
                        {/*
                            약관 링크는 문장 **안에** 둔다 — 한국어는
                            "…조건은 X을(를) 참고", 영어는 "see the X" 순서라
                            링크를 문장 밖에 이어 붙이면 로케일마다 어순이 깨진다.
                            `<link>` 태그 안의 텍스트는 렌더하지 않는다: 표시
                            라벨은 `termsTitle`이 카탈로그에서 가져오므로 여기서
                            복제하면 둘이 갈라진다.
                        */}
                        {tLegal.rich('privacyBottomNotice', {
                            link: () => (
                                <Link
                                    href={TERMS_PATH}
                                    className="rounded-sm text-primary-400 transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                                >
                                    {termsTitle(tSeo)}
                                </Link>
                            ),
                        })}
                    </p>
                </div>
            }
        >
            <PolicyMarkdownBody markdown={terms.body} />
        </LegalPageShell>
    );
}

export default async function PrivacyPage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    // 정적 렌더 활성화. 이 호출이 없으면 next-intl의 서버 API가 `headers()`로
    // 폴백해 **이 라우트의 ISR이 통째로 꺼진다**(빌드 route 표에서 `●` → `ƒ`).
    // 실측으로 확인했다 — Next 16.2는 `next/root-params` 미지원이라 이 경로가 유일하다.
    setRequestLocale(locale);
    const resolved = isLocale(locale) ? locale : DEFAULT_LOCALE;
    const tSeo = await getTranslations({
        locale: resolved,
        namespace: 'shared.seo',
    });
    return (
        <>
            <JsonLd data={buildPrivacyJsonLd(tSeo, resolved)} />
            <JsonLd data={buildPrivacyBreadcrumbJsonLd(tSeo, resolved)} />
            <Suspense
                fallback={<div className="animate-pulse" aria-hidden="true" />}
            >
                <PrivacyContent locale={resolved} />
            </Suspense>
        </>
    );
}
