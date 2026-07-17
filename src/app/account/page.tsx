import { ApiKeySection } from '@/features/api-key-management';
import { PortfolioSection } from '@/features/portfolio-management';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getRegisteredProvidersAction } from '@/entities/api-key/actions';
import { TIER_LABEL } from '@/shared/lib/auth/tierLabel';
import { SITE_NAME, SITE_URL } from '@/shared/lib/seo';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

// noindex 페이지에도 canonical/og:url을 명시한다 (login/signup 정책과 일관).
// 외부에 변형 URL이 공유되더라도 "원본은 /account 하나"라는 신호를 명확히 두면
// 일부 크롤러/공유 도구가 변형을 강조하지 않는다.
export const metadata: Metadata = {
    title: '계정 설정',
    description: `${SITE_NAME} 계정 설정 페이지`,
    alternates: { canonical: `${SITE_URL}/account` },
    openGraph: { url: `${SITE_URL}/account` },
    robots: { index: false, follow: false },
};

// Reads cookies via getCurrentUser — must be inside Suspense for PPR.
async function AccountContent() {
    const [user, rawProviders] = await Promise.all([
        getCurrentUser(),
        getRegisteredProvidersAction(),
    ]);
    if (!user) {
        redirect('/login?next=/account');
    }
    const registeredProviders = rawProviders.map(({ provider }) => provider);
    return (
        <>
            <section
                aria-label="프로필"
                className="ring-secondary-800 bg-secondary-900/80 space-y-4 rounded-2xl p-6 ring-1 backdrop-blur-xl"
            >
                <h2 className="text-secondary-100 text-lg font-semibold">
                    프로필
                </h2>
                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-[120px_1fr]">
                    <dt className="text-secondary-400">이메일</dt>
                    <dd className="text-secondary-100 break-all">
                        {user.email}
                    </dd>
                    <dt className="text-secondary-400">표시 이름</dt>
                    <dd className="text-secondary-100">
                        {user.name ?? (
                            <span className="text-secondary-500">미설정</span>
                        )}
                    </dd>
                    <dt className="text-secondary-400">회원 등급</dt>
                    <dd className="text-secondary-100">
                        {TIER_LABEL[user.tier]}
                    </dd>
                </dl>
            </section>

            <section
                aria-label="AI 모델 API 키"
                className="ring-secondary-800 bg-secondary-900/80 space-y-4 rounded-2xl p-6 ring-1 backdrop-blur-xl"
            >
                <ApiKeySection registeredProviders={registeredProviders} />
            </section>

            <section
                aria-label="보유종목"
                className="ring-secondary-800 bg-secondary-900/80 space-y-4 rounded-2xl p-6 ring-1 backdrop-blur-xl"
            >
                <PortfolioSection />
            </section>

            <section
                aria-label="위험영역"
                className="border-ui-danger/30 bg-ui-danger/5 space-y-4 rounded-2xl border p-6"
            >
                <div className="border-secondary-800 bg-secondary-900/60 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="text-secondary-100 text-sm font-semibold">
                            회원 탈퇴
                        </h3>
                        <p className="text-secondary-400 mt-1 text-sm">
                            계정과 관련된 모든 정보가 즉시 영구 파기됩니다.
                        </p>
                    </div>
                    <Link
                        href="/account/delete"
                        className="text-ui-danger border-ui-danger/40 hover:bg-ui-danger/10 focus-visible:ring-ui-danger inline-flex h-11 shrink-0 items-center justify-center rounded-md border px-5 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                        회원 탈퇴 진행
                    </Link>
                </div>
            </section>
        </>
    );
}

function SkeletonLine({ className }: { className?: string }) {
    return (
        <div
            className={`bg-secondary-800 animate-pulse rounded ${className ?? ''}`}
        />
    );
}

function AccountContentSkeleton() {
    return (
        <>
            {/* 프로필 섹션 */}
            <section
                aria-label="프로필 로딩 중"
                className="ring-secondary-800 bg-secondary-900/80 space-y-4 rounded-2xl p-6 ring-1 backdrop-blur-xl"
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
                aria-label="AI 모델 API 키 로딩 중"
                className="ring-secondary-800 bg-secondary-900/80 space-y-4 rounded-2xl p-6 ring-1 backdrop-blur-xl"
            >
                <SkeletonLine className="h-6 w-32" />
                <SkeletonLine className="h-4 w-64" />
                {[0, 1, 2].map(i => (
                    <div
                        key={i}
                        className="ring-secondary-800 bg-secondary-900/60 rounded-xl p-4 ring-1"
                    >
                        <div className="flex items-center gap-2">
                            <SkeletonLine className="h-4 w-20" />
                            <SkeletonLine className="h-5 w-12 rounded-full" />
                        </div>
                    </div>
                ))}
            </section>
        </>
    );
}

export default function AccountPage() {
    return (
        <main className="bg-secondary-950 min-h-[calc(100dvh-3.5rem)] px-4 py-12">
            <div className="mx-auto w-full max-w-2xl space-y-6">
                <header>
                    <h1 className="text-secondary-50 text-2xl font-semibold">
                        계정 설정
                    </h1>
                    <p className="text-secondary-400 mt-1 text-sm">
                        프로필 정보를 확인하고 계정을 관리합니다.
                    </p>
                </header>
                <Suspense fallback={<AccountContentSkeleton />}>
                    <AccountContent />
                </Suspense>
            </div>
        </main>
    );
}
