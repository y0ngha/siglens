'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useLocalePath } from '@/shared/i18n/useLocalePath';
import { PortfolioSection } from '@/features/portfolio-management';

const PRIMARY_BUTTON =
    'bg-primary-600 hover:bg-primary-700 focus-visible:ring-primary-500 focus-visible:ring-offset-secondary-950 active:bg-primary-800 flex h-12 items-center justify-center rounded-lg px-6 text-sm font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:min-w-32';
// Deliberately de-emphasized (tertiary text link, no fill/border) — "시작하기"
// is the expected completion of onboarding, so "나중에 하기" must read as a
// lightweight skip, not a second equal-weight CTA.
const SKIP_LINK =
    'text-secondary-400 hover:text-secondary-200 focus-visible:ring-primary-500 focus-visible:ring-offset-secondary-950 flex h-12 items-center justify-center rounded-lg px-6 text-sm font-medium underline underline-offset-4 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none';

/**
 * Skippable post-signup welcome screen offered to a brand-new member with no
 * specific return target (see `resolvePostSignupDestination`). Reuses the
 * approved account-page `PortfolioSection` add/list/edit/delete UI so a member
 * can seed their holdings immediately after signing up; both actions just
 * return home — adding holdings is entirely optional here.
 */
interface OnboardingContentProps {
    /** `/[symbol]/position` CTA에서 넘어온 심볼. 추가 폼을 미리 채운다. */
    initialSymbol?: string;
}

export function OnboardingContent({
    initialSymbol,
}: OnboardingContentProps = {}) {
    const t = useTranslations('features.portfolio-onboarding');
    const router = useRouter();
    const toLocalePath = useLocalePath();
    const goHome = () => router.push(toLocalePath('/'));

    return (
        <div className="space-y-6">
            <header className="space-y-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-500/10 px-3 py-1 text-xs font-medium text-primary-400 ring-1 ring-primary-500/20">
                    <span aria-hidden="true">🎉</span>{' '}
                    {t('OnboardingContent.643019')}
                </span>
                <h1 className="text-2xl font-semibold text-secondary-50">
                    {t('OnboardingContent.26bd1f')}
                </h1>
                <p className="text-sm text-secondary-400">
                    {t('OnboardingContent.5d18f5')}
                </p>
            </header>

            <section
                aria-label={t('OnboardingContent.cae421')}
                className="space-y-4 rounded-lg border border-secondary-700 bg-secondary-800 p-6"
            >
                <PortfolioSection defaultSymbol={initialSymbol} />
            </section>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={goHome} className={SKIP_LINK}>
                    {t('OnboardingContent.c9c840')}
                </button>
                <button
                    type="button"
                    onClick={goHome}
                    className={PRIMARY_BUTTON}
                >
                    {t('OnboardingContent.389b82')}
                </button>
            </div>
        </div>
    );
}
