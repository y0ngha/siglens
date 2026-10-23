import { useTranslations } from 'next-intl';
import { localeCanonical, localePageSocial } from '@/shared/lib/seoAlternates';
import { getTranslations } from 'next-intl/server';
import { ApiKeySection } from '@/features/api-key-management/ui/ApiKeySection';
import { SiglensApiKeySection } from '@/features/siglens-api-key-management/ui/SiglensApiKeySection';
import { DefaultModelForm } from '@/features/siglens-api-key-management/ui/DefaultModelForm';
import {
    buildApiModelOptionGroups,
    listApiKeyProviderLabels,
} from '@/features/siglens-api-key-management/lib/buildApiModelOptions';
import { EmailReportLinkCard } from '@/features/email-report-settings/ui/EmailReportLinkCard';
import { localePath, type Locale, resolveLocale } from '@/shared/i18n/locales';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getRegisteredProvidersAction } from '@/entities/api-key/actions/getRegisteredProvidersAction';
import { listSiglensApiKeysAction } from '@/entities/siglens-api-key/actions/listSiglensApiKeysAction';
import { getApiDefaultModelAction } from '@/entities/siglens-api-key/actions/getApiDefaultModelAction';
import {
    API_KEY_MAX_ACTIVE_PER_USER,
    PUBLIC_API_BASE_PATH,
} from '@/shared/config/publicApi';
import { SITE_URL } from '@/shared/lib/seo';
import { getModelDisplay } from '@/shared/lib/modelDisplay';
import { isActiveModelId } from '@/shared/lib/isActiveModelId';
import { TIER_LABEL } from '@/shared/lib/auth/tierLabel';
import type { Metadata } from 'next';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { redirect } from 'next/navigation';
import { isPublicApiEnabled } from '@/shared/api/publicApiEnabled';
import { Suspense } from 'react';
import { enterLocale } from '@/shared/lib/enterLocale';
import { SURFACE_CARD, SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { cn } from '@/shared/lib/cn';

// noindex 페이지에도 canonical/og:url을 명시한다 (login/signup 정책과 일관).
// 외부에 변형 URL이 공유되더라도 "원본은 /account 하나"라는 신호를 명확히 두면
// 일부 크롤러/공유 도구가 변형을 강조하지 않는다.
/**
 * 정적 `metadata`가 아니라 `generateMetadata`인 이유: 정적 객체는 로케일을 볼 수
 * 없어 `/en/account`도 canonical이 `/account`(한국어)로 나갔다. noindex 페이지에
 * 다른 URL을 canonical로 걸면 Google이 noindex를 그 대상으로 전파할 수 있다.
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
    const title = tSeo('account.title');
    const description = tSeo('account.description');
    return {
        title,
        description,
        alternates: { canonical: localeCanonical(locale, '/account') },
        ...localePageSocial(locale, '/account', {
            title,
            description,
        }),
        robots: { index: false, follow: false },
    };
}

/** "AI 모델 API 키" 섹션의 앵커 — API 기본 모델 영역의 "키 등록하러 가기" 링크가 가리킨다. */
const BYOK_SECTION_ID = 'byok-keys';

// Reads cookies via getCurrentUser — must be inside Suspense for PPR.
async function AccountContent({ locale }: { locale: Locale }) {
    const t = await getTranslations('app.account');
    // 공개 API 출시 전에는 "시그렌즈 API" 섹션을 그리지 않고 그 데이터도 읽지 않는다.
    const publicApiEnabled = isPublicApiEnabled();
    const [user, rawProviders, siglensApiKeys, apiDefaultModel] =
        await Promise.all([
            getCurrentUser(),
            getRegisteredProvidersAction(),
            publicApiEnabled ? listSiglensApiKeysAction() : null,
            publicApiEnabled ? getApiDefaultModelAction() : null,
        ]);
    if (!user) {
        // 로케일을 유지한다 — 영어 사용자가 한국어 로그인 페이지로 떨어지면 안 된다.
        redirect(
            `${localePath(locale, '/login')}?next=${encodeURIComponent(
                localePath(locale, '/account')
            )}`
        );
    }
    const registeredProviders = rawProviders.map(({ provider }) => provider);
    const apiModelGroups = buildApiModelOptionGroups(registeredProviders);
    return (
        <>
            <section
                aria-label={t('page.14fab1')}
                className={cn(SURFACE_CARD, 'space-y-4 p-6')}
            >
                <h2 className="text-lg font-semibold text-secondary-100">
                    {t('page.14fab1')}
                </h2>
                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-[120px_1fr]">
                    <dt className="text-secondary-400">{t('page.3c3776')}</dt>
                    <dd className="break-all text-secondary-100">
                        {user.email}
                    </dd>
                    <dt className="text-secondary-400">{t('page.7be993')}</dt>
                    <dd className="text-secondary-100">
                        {user.name ?? (
                            <span className="text-secondary-500">
                                {t('page.c6c674')}
                            </span>
                        )}
                    </dd>
                    <dt className="text-secondary-400">{t('page.f5162c')}</dt>
                    <dd className="text-secondary-100">
                        {TIER_LABEL[user.tier]}
                    </dd>
                </dl>
            </section>

            <EmailReportLinkCard />

            <section
                id={BYOK_SECTION_ID}
                aria-label={t('page.64f90b')}
                // 시그렌즈 API 키 발급 안내 모달의 "키 등록하러 가기"가 포커스를 옮기는 대상이다.
                tabIndex={-1}
                className={cn(
                    SURFACE_CARD,
                    'space-y-4 p-6 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none'
                )}
            >
                <ApiKeySection registeredProviders={registeredProviders} />
            </section>

            {publicApiEnabled && (
                <section
                    aria-label={t('page.siglensApi')}
                    className={cn(SURFACE_CARD, 'space-y-4 p-6')}
                >
                    <SiglensApiKeySection
                        keys={siglensApiKeys}
                        maxKeys={API_KEY_MAX_ACTIVE_PER_USER}
                        emailVerified={user.emailVerified}
                        hasByokKey={apiModelGroups.length > 0}
                        byokSectionId={BYOK_SECTION_ID}
                        apiBaseUrl={`${SITE_URL}${PUBLIC_API_BASE_PATH}`}
                        skillHref={`${PUBLIC_API_BASE_PATH}/skill`}
                        defaultModelSlot={
                            <DefaultModelForm
                                defaultModel={apiDefaultModel}
                                groups={apiModelGroups}
                                defaultModelLabel={
                                    apiDefaultModel !== null &&
                                    isActiveModelId(apiDefaultModel)
                                        ? getModelDisplay(apiDefaultModel)
                                              .fullName
                                        : null
                                }
                                byokHref={`#${BYOK_SECTION_ID}`}
                                keyProviderLabels={listApiKeyProviderLabels()}
                            />
                        }
                    />
                </section>
            )}

            <section
                aria-label={t('page.1987ac')}
                className="space-y-4 rounded-lg border border-ui-danger/30 bg-ui-danger/5 p-6"
            >
                <div
                    className={cn(
                        SURFACE_NESTED,
                        'flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between'
                    )}
                >
                    <div>
                        <h3 className="text-sm font-semibold text-secondary-100">
                            {t('page.3a0c2b')}
                        </h3>
                        <p className="mt-1 text-sm text-secondary-400">
                            {t('page.54ac38')}
                        </p>
                    </div>
                    <Link
                        href="/account/delete"
                        className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg border border-ui-danger px-5 text-sm font-semibold text-ui-danger-text transition-colors hover:bg-ui-danger/10 focus-visible:ring-2 focus-visible:ring-ui-danger focus-visible:outline-none"
                    >
                        {t('page.fa7c86')}
                    </Link>
                </div>
            </section>
        </>
    );
}

function SkeletonLine({ className }: { className?: string }) {
    return (
        <div
            className={`animate-pulse rounded bg-secondary-700 ${className ?? ''}`}
        />
    );
}

function AccountContentSkeleton() {
    const t = useTranslations('app.account');
    return (
        <>
            {/* 프로필 섹션 */}
            <section
                aria-label={t('page.c4079e')}
                className={cn(SURFACE_CARD, 'space-y-4 p-6')}
            >
                <SkeletonLine className="h-6 w-16" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_1fr]">
                    <SkeletonLine className="h-4 w-12" />
                    <SkeletonLine className="h-4 w-48" />
                    <SkeletonLine className="h-4 w-16" />
                    <SkeletonLine className="h-4 w-24" />
                    <SkeletonLine className="h-4 w-16" />
                    <SkeletonLine className="h-4 w-16" />
                </div>
            </section>

            {/* AI 모델 API 키 섹션 */}
            <section
                aria-label={t('page.1b6c6d')}
                className={cn(SURFACE_CARD, 'space-y-4 p-6')}
            >
                <SkeletonLine className="h-6 w-32" />
                <SkeletonLine className="h-4 w-64" />
                {[0, 1, 2].map(i => (
                    <div
                        key={i}
                        className="rounded-lg bg-secondary-900/60 p-4 ring-1 ring-secondary-700"
                    >
                        <div className="flex items-center gap-2">
                            <SkeletonLine className="h-4 w-20" />
                            <SkeletonLine className="h-5 w-12 rounded-full" />
                        </div>
                    </div>
                ))}
            </section>

            {/* SigLens API 키 섹션 — 공개 API 출시 전에는 본문에도 없으므로 스켈레톤도 그리지 않는다. */}
            {isPublicApiEnabled() && (
                <section
                    aria-label={t('page.siglensApi')}
                    className={cn(SURFACE_CARD, 'space-y-4 p-6')}
                >
                    <SkeletonLine className="h-6 w-32" />
                    <SkeletonLine className="h-4 w-64" />
                    <SkeletonLine className="h-10 w-full" />
                </section>
            )}
        </>
    );
}

export default async function AccountPage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = enterLocale(rawLocale);
    const t = await getTranslations('app.account');
    return (
        <main className="min-h-[calc(100dvh-var(--header-h))] bg-secondary-950 px-4 py-12">
            <div className="mx-auto w-full max-w-2xl space-y-6">
                <header>
                    <h1 className="text-2xl font-semibold text-secondary-50">
                        {t('page.622fae')}
                    </h1>
                    <p className="mt-1 text-sm text-secondary-400">
                        {t('page.b8fd1b')}
                    </p>
                </header>
                <Suspense fallback={<AccountContentSkeleton />}>
                    <AccountContent locale={locale} />
                </Suspense>
            </div>
        </main>
    );
}
