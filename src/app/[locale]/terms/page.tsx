import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
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
import { SITE_NAME } from '@/shared/lib/seo';
import type { SeoTranslator } from '@/shared/lib/seo';
import type { Locale } from '@/shared/i18n/locales';
import { getActiveTerms, type TermsRecord } from '@/entities/terms/api';
import { enterLocale } from '@/shared/lib/enterLocale';
import {
    legalPolicyBreadcrumbJsonLd,
    legalPolicyMetadata,
    legalPolicyWebPageJsonLd,
    type LegalPolicy,
} from '../_legal/legalPolicy';

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
 * 하루면 보통 충분하다 — 약관 개정은 대개 사전 고지를 거치므로 시각 단위 정확도가
 * 필요 없고, 재생성 비용은 DB 조회 한 번이다. 고지 기간이 짧아 발효 직후 노출이
 * 중요하면(2026-09-14 tos v2·privacy v4처럼) 발효 시각 이후 배포로 즉시 재생성한다
 * (`docs/architecture/DEPLOY_RUNBOOK.md` §3.5).
 */
export const revalidate = 86400;

const POLICY: LegalPolicy = {
    kind: 'tos',
    path: TERMS_PATH,
    title: termsTitle,
    fullTitle: termsFullTitle,
    description: termsDescription,
};

interface LocaleMetadataParams {
    readonly params: Promise<{ locale: string }>;
}

export async function generateMetadata({
    params,
}: LocaleMetadataParams): Promise<Metadata> {
    return legalPolicyMetadata(params, POLICY);
}

const topNoticeFor = (t: SeoTranslator, tLegal: SeoTranslator) => (
    <div
        role="note"
        aria-label={t('a11y.investmentDisclaimerSummary')}
        className="my-8 rounded-lg border border-ui-danger/30 bg-ui-danger/5 p-5"
    >
        <p className="mb-2 text-xs font-semibold text-ui-danger-text">
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

interface TermsContentProps {
    readonly locale: Locale;
    readonly terms: TermsRecord;
}

async function TermsContent({ locale, terms }: TermsContentProps) {
    const tSeo = await getTranslations({ locale, namespace: 'shared.seo' });
    const tLegal = await getTranslations({
        locale,
        namespace: 'shared.lib.legal',
    });
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
    const { locale: rawLocale } = await params;
    const locale = enterLocale(rawLocale);
    // **`<Suspense>` 밖에서** 조회하고 `notFound()`를 던진다. 안에서 던지면 셸이
    // 이미 스트리밍을 시작한 뒤라 Next가 응답을 200으로 확정해 버려, 화면은 404인데
    // 상태 코드는 200인 soft-404가 된다(2026-09 구글 정책 감사 M7).
    const [terms, tSeo] = await Promise.all([
        getActiveTerms(POLICY.kind, locale),
        getTranslations({ locale, namespace: 'shared.seo' }),
    ]);
    if (terms === null) notFound();
    return (
        <>
            <JsonLd data={legalPolicyWebPageJsonLd(POLICY, tSeo, locale)} />
            <JsonLd data={legalPolicyBreadcrumbJsonLd(POLICY, tSeo, locale)} />
            <Suspense
                fallback={<div className="animate-pulse" aria-hidden="true" />}
            >
                <TermsContent locale={locale} terms={terms} />
            </Suspense>
        </>
    );
}
