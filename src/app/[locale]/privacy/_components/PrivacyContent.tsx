import { getTranslations } from 'next-intl/server';
import type { TermsRecord } from '@/entities/terms/api';
import type { Locale } from '@/shared/i18n/locales';
import { brandName } from '@/shared/lib/brandName';
import { cn } from '@/shared/lib/cn';
import {
    formatKoreanDate,
    INVESTMENT_DISCLAIMER_KEY,
    privacyTitle,
    TERMS_PATH,
    termsTitle,
} from '@/shared/lib/legal';
import { extractToc } from '@/shared/lib/legal-toc';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { LegalPageShell } from '@/widgets/legal/LegalPageShell';
import { PolicyMarkdownBody } from '@/widgets/legal/PolicyMarkdownBody';
import { UntranslatedNotice } from '@/widgets/legal/UntranslatedNotice';

/** 본문과 대체 화면(`LegalUnavailable`)이 같은 eyebrow를 쓰도록 한 곳에 둔다. */
export const PRIVACY_EYEBROW = 'PRIVACY POLICY';

interface PrivacyContentProps {
    readonly locale: Locale;
    readonly terms: TermsRecord;
}

/**
 * `/privacy` 본문. 활성 방침 레코드(`terms`)를 이미 조회한 페이지가 넘기며, 번역 fallback이면
 * 안내를 위에, 투자 고지와 약관 링크를 아래에 둔다.
 */
export async function PrivacyContent({ locale, terms }: PrivacyContentProps) {
    const [tSeo, tLegal] = await Promise.all([
        getTranslations({ locale, namespace: 'shared.seo' }),
        getTranslations({ locale, namespace: 'shared.lib.legal' }),
    ]);
    const toc = extractToc(terms.body);

    return (
        <LegalPageShell
            breadcrumbTitle={privacyTitle(tSeo)}
            eyebrow={PRIVACY_EYEBROW}
            title={privacyTitle(tSeo)}
            intro={tLegal('privacyIntro', { v0: brandName(locale) })}
            effectiveDate={formatKoreanDate(terms.effectiveDate, locale)}
            toc={toc}
            bodyLocale={terms.bodyLocale}
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
                    className={cn(SURFACE_CARD, 'mt-12 p-5')}
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
