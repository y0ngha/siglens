import type { Metadata } from 'next';
import {
    DEFAULT_LOCALE,
    isLocale,
    localePath,
    type Locale,
} from '@/shared/i18n/locales';
import { setRequestLocale } from 'next-intl/server';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { AuthCardShell } from '@/shared/ui/auth/AuthCardShell';
import { DeleteAccountConfirm } from '@/features/account-delete';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { SITE_NAME, SITE_URL } from '@/shared/lib/seo';

// noindex 페이지에도 canonical/og:url을 명시한다 (login/signup 정책과 일관).
export const metadata: Metadata = {
    title: '회원 탈퇴',
    description: `${SITE_NAME} 회원 탈퇴`,
    alternates: { canonical: `${SITE_URL}/account/delete` },
    openGraph: { url: `${SITE_URL}/account/delete` },
    robots: { index: false, follow: false },
};

// Reads cookies via getCurrentUser — must be inside Suspense for PPR.
async function DeleteAccountContent({ locale }: { locale: Locale }) {
    const user = await getCurrentUser();
    if (!user) {
        // 로케일을 유지한다 — 영어 사용자가 한국어 로그인 페이지로 떨어지면 안 된다.
        redirect(
            `${localePath(locale, '/login')}?next=${encodeURIComponent(
                localePath(locale, '/account/delete')
            )}`
        );
    }
    return <DeleteAccountConfirm userEmail={user.email} />;
}

export default async function DeleteAccountPage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
    // 정적 렌더 활성화. 이 호출이 없으면 next-intl의 서버 API가 `headers()`로
    // 폴백해 **이 라우트의 ISR이 통째로 꺼진다**(빌드 route 표에서 `●` → `ƒ`).
    // 실측으로 확인했다 — Next 16.2는 `next/root-params` 미지원이라 이 경로가 유일하다.
    setRequestLocale(locale);
    return (
        <AuthCardShell
            title="회원 탈퇴"
            subtitle="이 작업은 되돌릴 수 없습니다"
            footer={
                <p>
                    마음이 바뀌셨나요?{' '}
                    <Link
                        href="/account"
                        className="font-medium text-primary-400 underline-offset-4 hover:text-primary-300 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        계정 설정으로 돌아가기 →
                    </Link>
                </p>
            }
        >
            {/* fallback: 인접 /account 페이지가 skeleton을 제공하는 패턴과
                일관성. 빈 카드 대신 최소한의 시각 피드백을 줘 destructive 흐름
                에서 사용자가 시스템이 응답 중임을 인지하게 한다. role="status"
                + aria-live="polite"로 스크린 리더가 마운트 시 로딩 상태를
                즉시 announce하도록 명시. */}
            <Suspense
                fallback={
                    <div
                        role="status"
                        aria-live="polite"
                        className="flex items-center justify-center gap-2 py-6"
                    >
                        <span
                            aria-hidden="true"
                            className="h-3 w-3 animate-spin rounded-full border-2 border-secondary-500 border-t-transparent"
                        />
                        <span className="text-xs text-secondary-400">
                            계정 정보를 불러오고 있어요…
                        </span>
                    </div>
                }
            >
                <DeleteAccountContent locale={locale} />
            </Suspense>
        </AuthCardShell>
    );
}
