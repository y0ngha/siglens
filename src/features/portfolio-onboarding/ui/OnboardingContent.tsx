'use client';

import { useRouter } from 'next/navigation';
import { PortfolioSection } from '@/features/portfolio-management';

const PRIMARY_BUTTON =
    'bg-primary-600 hover:bg-primary-700 focus-visible:ring-primary-500 focus-visible:ring-offset-secondary-950 active:bg-primary-800 flex h-12 items-center justify-center rounded-md px-6 text-sm font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:min-w-32';
const SECONDARY_BUTTON =
    'border-secondary-700 text-secondary-300 hover:bg-secondary-800 focus-visible:ring-primary-500 focus-visible:ring-offset-secondary-950 flex h-12 items-center justify-center rounded-md border px-6 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:min-w-32';

/**
 * Skippable post-signup welcome screen offered to a brand-new member with no
 * specific return target (see `resolvePostSignupDestination`). Reuses the
 * approved account-page `PortfolioSection` add/list/edit/delete UI so a member
 * can seed their holdings immediately after signing up; both actions just
 * return home — adding holdings is entirely optional here.
 */
export function OnboardingContent() {
    const router = useRouter();
    const goHome = () => router.push('/');

    return (
        <div className="space-y-6">
            <header className="space-y-3">
                <span className="bg-primary-500/10 text-primary-400 ring-primary-500/20 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1">
                    <span aria-hidden="true">🎉</span> 가입을 환영해요
                </span>
                <h1 className="text-secondary-50 text-2xl font-semibold">
                    보유종목을 등록해 보세요
                </h1>
                <p className="text-secondary-400 text-sm">
                    지금 등록하면 내 평균 단가를 기준으로 분석을 받을 수 있어요.
                    나중에 계정 설정에서도 추가할 수 있어요.
                </p>
            </header>

            <section
                aria-label="보유종목"
                className="ring-secondary-800 bg-secondary-900/80 space-y-4 rounded-2xl p-6 ring-1 backdrop-blur-xl"
            >
                <PortfolioSection />
            </section>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                    type="button"
                    onClick={goHome}
                    className={SECONDARY_BUTTON}
                >
                    나중에 하기
                </button>
                <button
                    type="button"
                    onClick={goHome}
                    className={PRIMARY_BUTTON}
                >
                    완료
                </button>
            </div>
        </div>
    );
}
