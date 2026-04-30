import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthCardShell } from '@/components/auth/AuthCardShell';
import { DeleteAccountConfirm } from '@/components/auth/DeleteAccountConfirm';
import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import { SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
    title: '회원 탈퇴',
    description: `${SITE_NAME} 회원 탈퇴`,
    robots: { index: false, follow: false },
};

export default async function DeleteAccountPage() {
    const user = await getCurrentUser();
    if (!user) {
        redirect('/login?next=/account/delete');
    }
    return (
        <AuthCardShell
            title="회원 탈퇴"
            subtitle="이 작업은 되돌릴 수 없습니다"
            footer={
                <p>
                    마음이 바뀌셨나요?{' '}
                    <Link
                        href="/account"
                        className="text-primary-400 hover:text-primary-300 focus-visible:ring-primary-500 font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                    >
                        계정 설정으로 돌아가기 →
                    </Link>
                </p>
            }
        >
            <DeleteAccountConfirm userEmail={user.email} />
        </AuthCardShell>
    );
}
