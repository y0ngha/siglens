import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { DEFAULT_LOCALE, isLocale } from '@/shared/i18n/locales';
import {
    localeAlternatesFrom,
    localeOpenGraph,
    localeRobots,
} from '@/shared/lib/seoAlternates';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalPageShell } from '@/widgets/legal/LegalPageShell';
import { PolicyMarkdownBody } from '@/widgets/legal/PolicyMarkdownBody';
import { JsonLd } from '@/shared/ui/JsonLd';
import {
    formatKoreanDate,
    INVESTMENT_DISCLAIMER,
    TERMS_DESCRIPTION,
    TERMS_FULL_TITLE,
    TERMS_PATH,
    TERMS_TITLE,
} from '@/shared/lib/legal';
import { extractToc } from '@/shared/lib/legal-toc';
import { buildBreadcrumbJsonLd, SITE_NAME, SITE_URL } from '@/shared/lib/seo';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleTermsRepository } from '@/entities/terms';

const PAGE_URL = `${SITE_URL}${TERMS_PATH}`;

const JSON_LD = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${PAGE_URL}#webpage`,
    name: TERMS_TITLE,
    description: TERMS_DESCRIPTION,
    url: PAGE_URL,
    inLanguage: 'ko',
    isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}#website` },
};

const BREADCRUMB_JSON_LD = buildBreadcrumbJsonLd([
    { name: TERMS_TITLE, url: PAGE_URL },
]);

interface LocaleMetadataParams {
    readonly params: Promise<{ locale: string }>;
}

export async function generateMetadata({
    params,
}: LocaleMetadataParams): Promise<Metadata> {
    const { locale } = await params;
    const resolved = isLocale(locale) ? locale : DEFAULT_LOCALE;
    const ogLocale = localeOpenGraph(resolved);
    return {
        title: TERMS_TITLE,
        description: TERMS_DESCRIPTION,
        robots: localeRobots(resolved),
        alternates: await localeAlternatesFrom(params, TERMS_PATH),
        openGraph: {
            type: 'article',
            siteName: SITE_NAME,
            title: TERMS_FULL_TITLE,
            description: TERMS_DESCRIPTION,
            url: PAGE_URL,
            ...ogLocale,
            images: [
                {
                    url: '/og-image.png',
                    width: OG_IMAGE_WIDTH,
                    height: OG_IMAGE_HEIGHT,
                    alt: TERMS_FULL_TITLE,
                },
            ],
        },
        twitter: {
            card: 'summary',
            title: TERMS_FULL_TITLE,
            description: TERMS_DESCRIPTION,
            images: ['/og-image.png'],
        },
    };
}

const topNotice = (
    <div
        role="note"
        aria-label="투자 면책 고지 요약"
        className="my-8 rounded-lg border border-ui-danger/30 bg-ui-danger/5 p-5"
    >
        <p className="mb-2 text-xs font-semibold tracking-wider text-ui-danger uppercase">
            중요 안내
        </p>
        <p className="text-sm leading-relaxed text-secondary-200 sm:text-base">
            {INVESTMENT_DISCLAIMER}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-secondary-400 sm:text-sm">
            {SITE_NAME}은(는) 투자 자문이나 매매 권유를 제공하지 않으며,
            제공되는 모든 분석은 통계적·기술적 관점의 정보입니다. 자세한 내용은
            아래 제5조를 확인해 주세요.
        </p>
    </div>
);

async function TermsContent() {
    const { db } = getDatabaseClient();
    const repo = new DrizzleTermsRepository(db);
    const terms = await repo.findActive('tos');

    if (!terms) {
        notFound();
    }

    const toc = extractToc(terms.body);

    return (
        <LegalPageShell
            breadcrumbTitle={TERMS_TITLE}
            eyebrow="TERMS OF SERVICE"
            title={TERMS_TITLE}
            intro={`본 약관은 ${SITE_NAME}(이하 "운영자")이 제공하는 미국 주식 기술적 분석 웹 서비스의 이용 조건 및 운영자와 이용자 간의 권리, 의무 및 책임 사항을 규정함을 목적으로 합니다. 서비스를 이용하기 전에 본 약관을 주의 깊게 읽어 주시기 바랍니다.`}
            effectiveDate={formatKoreanDate(terms.effectiveDate)}
            toc={toc}
            topNotice={topNotice}
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
    return (
        <>
            <JsonLd data={JSON_LD} />
            <JsonLd data={BREADCRUMB_JSON_LD} />
            <Suspense
                fallback={<div className="animate-pulse" aria-hidden="true" />}
            >
                <TermsContent />
            </Suspense>
        </>
    );
}
