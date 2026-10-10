import { getTranslations } from 'next-intl/server';
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
import type { Locale } from '@/shared/i18n/locales';
import type { TermsRecord } from '@/entities/terms/api';
import type { Metadata } from 'next';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { notFound } from 'next/navigation';
import { enterLocale } from '@/shared/lib/enterLocale';
import {
    legalPolicyBreadcrumbJsonLd,
    legalPolicyMetadata,
    legalPolicyWebPageJsonLd,
    loadLegalTerms,
    type LegalPolicy,
} from '../_legal/legalPolicy';
import { renderLegalUnavailable } from '../_legal/renderLegalUnavailable';
import { brandName } from '@/shared/lib/brandName';

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

/** 본문과 대체 화면이 같은 eyebrow를 쓰도록 한 곳에 둔다. */
const PRIVACY_EYEBROW = 'PRIVACY POLICY';

const POLICY: LegalPolicy = {
    kind: 'privacy',
    path: PRIVACY_PATH,
    title: privacyTitle,
    fullTitle: privacyFullTitle,
    description: privacyDescription,
};

interface LocaleMetadataParams {
    readonly params: Promise<{ locale: string }>;
}

export async function generateMetadata({
    params,
}: LocaleMetadataParams): Promise<Metadata> {
    return legalPolicyMetadata(params, POLICY);
}

interface PrivacyContentProps {
    readonly locale: Locale;
    readonly terms: TermsRecord;
}

async function PrivacyContent({ locale, terms }: PrivacyContentProps) {
    const tSeo = await getTranslations({ locale, namespace: 'shared.seo' });
    const tLegal = await getTranslations({
        locale,
        namespace: 'shared.lib.legal',
    });
    const toc = extractToc(terms.body);

    return (
        <LegalPageShell
            breadcrumbTitle={privacyTitle(tSeo)}
            eyebrow={PRIVACY_EYEBROW}
            title={privacyTitle(tSeo)}
            intro={tLegal('privacyIntro', { v0: brandName(locale) })}
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
    const { locale: rawLocale } = await params;
    const locale = enterLocale(rawLocale);
    // 조회와 `notFound()`는 **Suspense 경계 밖**(여기)에서 한다. 경계 안에서 던지면
    // 셸이 이미 스트리밍을 시작한 뒤라 Next가 응답을 200으로 확정해 버려, 화면은
    // 404인데 상태 코드는 200인 soft-404가 된다(2026-09 구글 정책 감사 M7).
    // 이 페이지에 경계를 다시 넣게 되더라도 이 줄들은 그 위에 남아야 한다.
    const [load, tSeo] = await Promise.all([
        loadLegalTerms(POLICY.kind, locale),
        getTranslations({ locale, namespace: 'shared.seo' }),
    ]);
    // DB 없이 도는 배포 빌드 — 404도 빈 페이지도 굽지 않고 안내문을 60초 revalidate로 낸다.
    if (load.status === 'unavailable')
        return renderLegalUnavailable(POLICY, PRIVACY_EYEBROW, tSeo);
    if (load.status === 'missing') notFound();
    const { terms } = load;
    return (
        <>
            <JsonLd data={legalPolicyWebPageJsonLd(POLICY, tSeo, locale)} />
            <JsonLd data={legalPolicyBreadcrumbJsonLd(POLICY, tSeo, locale)} />
            {/* 본문을 Suspense로 감싸지 않는다. ISR 응답은 통째로 버퍼링돼 스트리밍
                이득이 없는데, React는 500B를 넘는 경계를 fallback + 숨김 청크로
                내보낸다 — 빈 fallback 자리에 푸터가 먼저 그려졌다가 본문이 풀리며
                밀려 모바일 CLS가 0.74였다(2026-10-04 운영 Lighthouse). */}
            <PrivacyContent locale={locale} terms={terms} />
        </>
    );
}
