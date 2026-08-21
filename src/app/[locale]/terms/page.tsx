import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DEFAULT_LOCALE, isLocale } from '@/shared/i18n/locales';
import {
    localeAlternatesFrom,
    localeOpenGraph,
    localeRobots,
} from '@/shared/lib/seoAlternates';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalPageShell } from '@/widgets/legal/LegalPageShell';
import { UntranslatedNotice } from '@/widgets/legal/UntranslatedNotice';
import { PolicyMarkdownBody } from '@/widgets/legal/PolicyMarkdownBody';
import { JsonLd } from '@/shared/ui/JsonLd';
import {
    formatKoreanDate,
    INVESTMENT_DISCLAIMER_KEY,
    termsDescription,
    termsFullTitle,
    TERMS_PATH,
    termsTitle,
} from '@/shared/lib/legal';
import { extractToc } from '@/shared/lib/legal-toc';
import {
    buildBreadcrumbJsonLd,
    buildWebPageJsonLd,
    SITE_NAME,
    SITE_URL,
    localizedAbsoluteUrl,
} from '@/shared/lib/seo';
import type { SeoTranslator } from '@/shared/lib/seo';
import type { Locale } from '@/shared/i18n/locales';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleTermsRepository } from '@/entities/terms';

const PAGE_URL = `${SITE_URL}${TERMS_PATH}`;

/**
 * 모듈 스코프 상수였다 — 번역자도 로케일도 없는 자리라 JSON-LD가 항상
 * 한국어·기본 로케일 URL로 굳었다. 렌더 시점 함수로 바꾼다.
 */
function buildTermsJsonLd(t: SeoTranslator, locale: Locale) {
    return {
        ...buildWebPageJsonLd({
            url: PAGE_URL,
            name: termsFullTitle(t),
            description: termsDescription(t),
            locale,
        }),
    };
}

function buildTermsBreadcrumbJsonLd(t: SeoTranslator, locale: Locale) {
    return buildBreadcrumbJsonLd(
        [{ name: termsTitle(t), url: PAGE_URL }],
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
    const tSeo = await getTranslations({
        locale: resolved,
        namespace: 'shared.seo',
    });
    const ogLocale = localeOpenGraph(resolved);
    return {
        title: termsTitle(tSeo),
        description: termsDescription(tSeo),
        robots: localeRobots(resolved),
        alternates: await localeAlternatesFrom(params, TERMS_PATH),
        openGraph: {
            type: 'article',
            siteName: SITE_NAME,
            title: termsFullTitle(tSeo),
            description: termsDescription(tSeo),
            url: localizedAbsoluteUrl(PAGE_URL, resolved),
            ...ogLocale,
            images: [
                {
                    url: '/og-image.png',
                    width: OG_IMAGE_WIDTH,
                    height: OG_IMAGE_HEIGHT,
                    alt: termsFullTitle(tSeo),
                },
            ],
        },
        twitter: {
            card: 'summary',
            title: termsFullTitle(tSeo),
            description: termsDescription(tSeo),
            images: ['/og-image.png'],
        },
    };
}

const topNoticeFor = (t: SeoTranslator, tLegal: SeoTranslator) => (
    <div
        role="note"
        aria-label={t('a11y.investmentDisclaimerSummary')}
        className="my-8 rounded-lg border border-ui-danger/30 bg-ui-danger/5 p-5"
    >
        <p className="mb-2 text-xs font-semibold tracking-wider text-ui-danger uppercase">
            {tLegal('termsNoticeHeading')}
        </p>
        <p className="text-sm leading-relaxed text-secondary-200 sm:text-base">
            {tLegal(INVESTMENT_DISCLAIMER_KEY)}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-secondary-400 sm:text-sm">
            {tLegal('termsNoticeBody', { v0: SITE_NAME })}
        </p>
    </div>
);

async function TermsContent({ locale }: { readonly locale: Locale }) {
    const tSeo = await getTranslations({ locale, namespace: 'shared.seo' });
    const tLegal = await getTranslations({
        locale,
        namespace: 'shared.lib.legal',
    });
    const { db } = getDatabaseClient();
    const repo = new DrizzleTermsRepository(db);
    const terms = await repo.findActive('tos', locale);

    if (!terms) {
        notFound();
    }

    const toc = extractToc(terms.body);

    return (
        <LegalPageShell
            breadcrumbTitle={termsTitle(tSeo)}
            eyebrow="TERMS OF SERVICE"
            title={termsTitle(tSeo)}
            intro={tLegal('termsIntro', { v0: SITE_NAME })}
            effectiveDate={formatKoreanDate(terms.effectiveDate, locale)}
            toc={toc}
            topNotice={
                <>
                    {/* 번역 안내가 투자 고지보다 위에 온다 — 이 문서를 읽을 수
                        있는지가 먼저다. */}
                    {terms.isTranslationFallback && (
                        <UntranslatedNotice
                            requested={locale}
                            served={terms.bodyLocale}
                        />
                    )}
                    {topNoticeFor(tSeo, tLegal)}
                </>
            }
        >
            <PolicyMarkdownBody markdown={terms.body} />
        </LegalPageShell>
    );
}

export default async function TermsPage({
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
            <JsonLd data={buildTermsJsonLd(tSeo, resolved)} />
            <JsonLd data={buildTermsBreadcrumbJsonLd(tSeo, resolved)} />
            <Suspense
                fallback={<div className="animate-pulse" aria-hidden="true" />}
            >
                <TermsContent locale={resolved} />
            </Suspense>
        </>
    );
}
