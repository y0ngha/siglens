import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getRegisteredProvidersAction } from '@/entities/api-key/actions/getRegisteredProvidersAction';
import { getCurrentUser } from '@/entities/auth/server/getCurrentUser';
import { getApiDefaultModelAction } from '@/entities/siglens-api-key/actions/getApiDefaultModelAction';
import { listSiglensApiKeysAction } from '@/entities/siglens-api-key/actions/listSiglensApiKeysAction';
import { ApiKeySection } from '@/features/api-key-management/ui/ApiKeySection';
import { EmailReportLinkCard } from '@/features/email-report-settings/ui/EmailReportLinkCard';
import {
    buildApiModelOptionGroups,
    listApiKeyProviderLabels,
} from '@/features/siglens-api-key-management/lib/buildApiModelOptions';
import { DefaultModelForm } from '@/features/siglens-api-key-management/ui/DefaultModelForm';
import { SiglensApiKeySection } from '@/features/siglens-api-key-management/ui/SiglensApiKeySection';
import { isPublicApiEnabled } from '@/shared/api/publicApiEnabled';
import {
    API_KEY_MAX_ACTIVE_PER_USER,
    PUBLIC_API_BASE_PATH,
} from '@/shared/config/publicApi';
import type { Locale } from '@/shared/i18n/locales';
import type { AuthUserRecord } from '@/shared/lib/auth/types';
import { TIER_LABEL } from '@/shared/lib/auth/tierLabel';
import { cn } from '@/shared/lib/cn';
import { SITE_URL } from '@/shared/lib/seo';
import { SURFACE_CARD, SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { localePathToLogin } from '../../_personal/localePathToLogin';
import { defaultModelLabel } from '../_lib/defaultModelLabel';
import { ACCOUNT_PATH } from '../_lib/paths';

/** "AI 모델 API 키" 섹션의 앵커 — API 기본 모델 영역의 "키 등록하러 가기" 링크가 가리킨다. */
const BYOK_SECTION_ID = 'byok-keys';

interface ProfileSectionProps {
    readonly user: AuthUserRecord;
}

async function ProfileSection({ user }: ProfileSectionProps) {
    const t = await getTranslations('app.account');
    return (
        <section
            aria-label={t('page.14fab1')}
            className={cn(SURFACE_CARD, 'space-y-4 p-6')}
        >
            <h2 className="text-lg font-semibold text-secondary-100">
                {t('page.14fab1')}
            </h2>
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-[120px_1fr]">
                <dt className="text-secondary-400">{t('page.3c3776')}</dt>
                <dd className="break-all text-secondary-100">{user.email}</dd>
                <dt className="text-secondary-400">{t('page.7be993')}</dt>
                <dd className="text-secondary-100">
                    {user.name ?? (
                        <span className="text-secondary-500">
                            {t('page.c6c674')}
                        </span>
                    )}
                </dd>
                <dt className="text-secondary-400">{t('page.f5162c')}</dt>
                <dd className="text-secondary-100">{TIER_LABEL[user.tier]}</dd>
            </dl>
        </section>
    );
}

async function DangerZoneSection() {
    const t = await getTranslations('app.account');
    return (
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
    );
}

/** 요청 로케일 — 세션이 없을 때 같은 로케일의 로그인으로 보내는 데 쓴다. */
export interface AccountContentProps {
    readonly locale: Locale;
}

/**
 * `/account` 회원 본문 — 프로필·메일 리포트 링크·AI 모델 API 키·시그렌즈 API·탈퇴 영역.
 * 쿠키로 세션을 읽으므로 페이지의 Suspense 안에서 그려 머리말이 먼저 스트리밍되게 한다.
 * 세션과 키 데이터는 한 번에 병렬로 읽는다 — 키 액션들은 비회원이면 DB를 읽지 않고 빈 값을
 * 돌려주므로 세션 확인을 기다렸다 시작할 이유가 없다. 공개 API 출시 전에는 "시그렌즈 API"
 * 섹션을 그리지 않고 그 데이터도 읽지 않는다.
 */
export async function AccountContent({ locale }: AccountContentProps) {
    const t = await getTranslations('app.account');
    const publicApiEnabled = isPublicApiEnabled();
    const [user, rawProviders, siglensApiKeys, apiDefaultModel] =
        await Promise.all([
            getCurrentUser(),
            getRegisteredProvidersAction(),
            publicApiEnabled ? listSiglensApiKeysAction() : null,
            publicApiEnabled ? getApiDefaultModelAction() : null,
        ]);
    if (!user) redirect(localePathToLogin(locale, ACCOUNT_PATH));
    const registeredProviders = rawProviders.map(({ provider }) => provider);
    const apiModelGroups = buildApiModelOptionGroups(registeredProviders);
    return (
        <>
            <ProfileSection user={user} />

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
                                defaultModelLabel={defaultModelLabel(
                                    apiDefaultModel
                                )}
                                byokHref={`#${BYOK_SECTION_ID}`}
                                keyProviderLabels={listApiKeyProviderLabels()}
                            />
                        }
                    />
                </section>
            )}

            <DangerZoneSection />
        </>
    );
}
