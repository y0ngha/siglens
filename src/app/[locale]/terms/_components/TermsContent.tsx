import { getTranslations } from 'next-intl/server';
import type { TermsRecord } from '@/entities/terms/api';
import type { Locale } from '@/shared/i18n/locales';
import { brandName } from '@/shared/lib/brandName';
import {
    formatKoreanDate,
    INVESTMENT_DISCLAIMER_KEY,
    termsTitle,
} from '@/shared/lib/legal';
import { extractToc } from '@/shared/lib/legal-toc';
import type { SeoTranslator } from '@/shared/lib/seo';
import { LegalPageShell } from '@/widgets/legal/LegalPageShell';
import { PolicyMarkdownBody } from '@/widgets/legal/PolicyMarkdownBody';
import { UntranslatedNotice } from '@/widgets/legal/UntranslatedNotice';

/** 본문과 대체 화면(`LegalUnavailable`)이 같은 eyebrow를 쓰도록 한 곳에 둔다. */
export const TERMS_EYEBROW = 'TERMS OF SERVICE';

interface TermsNoticeProps {
    readonly t: SeoTranslator;
    readonly tLegal: SeoTranslator;
    readonly locale: Locale;
}

function InvestmentNotice({ t, tLegal, locale }: TermsNoticeProps) {
    return (
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
                {tLegal('termsNoticeBody', { v0: brandName(locale) })}
            </p>
        </div>
    );
}

interface TermsContentProps {
    readonly locale: Locale;
    readonly terms: TermsRecord;
}

/**
 * `/terms` 본문. 활성 약관 레코드(`terms`)를 이미 조회한 페이지가 넘기며, 번역 fallback 안내를
 * 투자 고지보다 위에 둔다 — 이 문서를 읽을 수 있는지가 먼저다.
 */
export async function TermsContent({ locale, terms }: TermsContentProps) {
    const [tSeo, tLegal] = await Promise.all([
        getTranslations({ locale, namespace: 'shared.seo' }),
        getTranslations({ locale, namespace: 'shared.lib.legal' }),
    ]);
    const toc = extractToc(terms.body);

    return (
        <LegalPageShell
            breadcrumbTitle={termsTitle(tSeo)}
            eyebrow={TERMS_EYEBROW}
            title={termsTitle(tSeo)}
            intro={tLegal('termsIntro', { v0: brandName(locale) })}
            effectiveDate={formatKoreanDate(terms.effectiveDate, locale)}
            toc={toc}
            bodyLocale={terms.bodyLocale}
            topNotice={
                <>
                    {terms.isTranslationFallback && (
                        <UntranslatedNotice
                            requested={locale}
                            served={terms.bodyLocale}
                        />
                    )}
                    <InvestmentNotice
                        t={tSeo}
                        tLegal={tLegal}
                        locale={locale}
                    />
                </>
            }
        >
            <PolicyMarkdownBody markdown={terms.body} />
        </LegalPageShell>
    );
}
