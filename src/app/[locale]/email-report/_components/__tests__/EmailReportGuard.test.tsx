import { render, screen } from '@testing-library/react';

vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));
vi.mock(
    '@/features/email-report-settings/ui/EmailReportSettingsSection',
    () => ({
        EmailReportSettingsSection: () => (
            <div data-testid="settings-section" />
        ),
    })
);
vi.mock('@/app/[locale]/email-report/_lib/loadReportPreview', () => ({
    loadReportPreview: vi.fn(),
}));
vi.mock('next/navigation', () => ({
    redirect: vi.fn(() => {
        throw new Error('NEXT_REDIRECT');
    }),
}));

import { redirect } from 'next/navigation';
import { loadReportPreview } from '@/app/[locale]/email-report/_lib/loadReportPreview';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { EmailReportGuard } from '../EmailReportGuard';

describe('EmailReportGuard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('비로그인이면 돌아올 경로를 달아 로케일 로그인으로 보낸다', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(null);

        await expect(EmailReportGuard({ locale: 'en' })).rejects.toThrow(
            'NEXT_REDIRECT'
        );
        expect(redirect).toHaveBeenCalledWith(
            '/en/login?next=%2Fen%2Femail-report'
        );
    });

    it('로그인 회원의 가드는 수신 설정 폼만 그리고 종목은 읽지 않는다', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1' } as never);

        render(await EmailReportGuard({ locale: 'ko' }));

        expect(screen.getByTestId('settings-section')).toBeInTheDocument();
        expect(loadReportPreview).not.toHaveBeenCalled();
        expect(redirect).not.toHaveBeenCalled();
    });
});
