import { Suspense } from 'react';
import { PolicyMarkdownBody } from '@/components/legal/PolicyMarkdownBody';
import { LegalPageShell } from '@/components/legal/LegalPageShell';
import { JsonLd } from '@/components/ui/JsonLd';
import {
    formatKoreanDate,
    INVESTMENT_DISCLAIMER,
    PRIVACY_DESCRIPTION,
    PRIVACY_FULL_TITLE,
    PRIVACY_PATH,
    PRIVACY_TITLE,
    TERMS_PATH,
    TERMS_TITLE,
} from '@/shared/lib/legal';
import { extractToc } from '@/shared/lib/legal-toc';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { buildBreadcrumbJsonLd, SITE_NAME, SITE_URL } from '@/shared/lib/seo';
import { getDatabaseClient } from '@/infrastructure/db/client';
import { DrizzleTermsRepository } from '@/infrastructure/db/termsRepository';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

const PAGE_URL = `${SITE_URL}${PRIVACY_PATH}`;

const JSON_LD = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${PAGE_URL}#webpage`,
    name: `${PRIVACY_TITLE} | ${SITE_NAME}`,
    description: PRIVACY_DESCRIPTION,
    url: PAGE_URL,
    inLanguage: 'ko',
    isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}#website` },
};

const BREADCRUMB_JSON_LD = buildBreadcrumbJsonLd([
    { name: PRIVACY_TITLE, url: PAGE_URL },
]);

export const metadata: Metadata = {
    title: PRIVACY_TITLE,
    description: PRIVACY_DESCRIPTION,
    robots: {
        index: true,
        follow: true,
    },
    alternates: {
        canonical: PAGE_URL,
    },
    openGraph: {
        type: 'article',
        siteName: SITE_NAME,
        title: PRIVACY_FULL_TITLE,
        description: PRIVACY_DESCRIPTION,
        url: PAGE_URL,
        locale: 'ko_KR',
        images: [
            {
                url: '/og-image.png',
                width: OG_IMAGE_WIDTH,
                height: OG_IMAGE_HEIGHT,
                alt: PRIVACY_FULL_TITLE,
            },
        ],
    },
    twitter: {
        card: 'summary',
        title: PRIVACY_FULL_TITLE,
        description: PRIVACY_DESCRIPTION,
        images: ['/og-image.png'],
    },
};

const bottomNotice = (
    <div
        role="note"
        aria-label="투자 면책 고지"
        className="border-secondary-800 bg-secondary-900/40 mt-12 rounded-lg border p-5"
    >
        <p className="text-secondary-400 text-xs leading-relaxed sm:text-sm">
            {INVESTMENT_DISCLAIMER} 서비스 이용과 관련한 자세한 조건은&nbsp;
            <Link
                href={TERMS_PATH}
                className="text-primary-400 hover:text-primary-300 focus-visible:ring-primary-500 rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
                {TERMS_TITLE}
            </Link>
            을(를) 참고해 주세요.
        </p>
    </div>
);

async function PrivacyContent() {
    const { db } = getDatabaseClient();
    const repo = new DrizzleTermsRepository(db);
    const terms = await repo.findActive('privacy');

    if (!terms) {
        notFound();
    }

    const toc = extractToc(terms.body);

    return (
        <LegalPageShell
            breadcrumbTitle={PRIVACY_TITLE}
            eyebrow="PRIVACY POLICY"
            title={PRIVACY_TITLE}
            intro={`${SITE_NAME}(이하 "운영자")는 이용자의 개인정보를 중요시하며, 「개인정보 보호법」 등 관련 법령을 준수하기 위하여 노력하고 있습니다. 운영자는 개인정보처리방침을 통하여 이용자가 제공하는 개인정보가 어떠한 용도와 방식으로 이용되고 있으며, 개인정보 보호를 위해 어떠한 조치가 취해지고 있는지 알려드립니다.`}
            effectiveDate={formatKoreanDate(terms.effectiveDate)}
            toc={toc}
            bottomNotice={bottomNotice}
        >
            <PolicyMarkdownBody markdown={terms.body} />
        </LegalPageShell>
    );
}

export default function PrivacyPage() {
    return (
        <>
            <JsonLd data={JSON_LD} />
            <JsonLd data={BREADCRUMB_JSON_LD} />
            <Suspense
                fallback={<div className="animate-pulse" aria-hidden="true" />}
            >
                <PrivacyContent />
            </Suspense>
        </>
    );
}
