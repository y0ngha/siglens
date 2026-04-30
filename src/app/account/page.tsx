import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import { TIER_LABEL } from '@/lib/auth/tierLabel';
import { SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
    title: '계정 설정',
    description: `${SITE_NAME} 계정 설정 페이지`,
    robots: { index: false, follow: false },
};

export default async function AccountPage() {
    const user = await getCurrentUser();
    if (!user) {
        redirect('/login?next=/account');
    }
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
                                <span className="text-secondary-500">
                                    미설정
                                </span>
                            )}
                        </dd>
                        <dt className="text-secondary-400">Tier</dt>
                        <dd className="text-secondary-100">
                            {TIER_LABEL[user.tier]}
                        </dd>
                    </dl>
                </section>

                <section
                    aria-label="위험 작업"
                    className="border-ui-danger/30 bg-ui-danger/5 space-y-4 rounded-2xl border p-6"
                >
                    <div>
                        <h2 className="text-ui-danger text-lg font-semibold">
                            위험존
                        </h2>
                        <p className="text-secondary-300 mt-1 text-sm">
                            아래 작업은 되돌릴 수 없습니다.
                        </p>
                    </div>
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
                            className="text-ui-danger border-ui-danger/40 hover:bg-ui-danger/10 inline-flex h-11 shrink-0 items-center justify-center rounded-md border px-5 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none"
                        >
                            회원 탈퇴 진행
                        </Link>
                    </div>
                </section>
            </div>
        </main>
    );
}
