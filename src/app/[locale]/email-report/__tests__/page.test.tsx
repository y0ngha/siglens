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
vi.mock('@/shared/lib/seo', () => ({
    SITE_NAME: 'SIGLENS',
    SITE_URL: 'https://siglens.io',
}));
vi.mock('next/navigation', () => ({
    redirect: vi.fn(() => {
        throw new Error('NEXT_REDIRECT');
    }),
}));
vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        ...rest
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));

import { redirect } from 'next/navigation';
import EmailReportPage, {
    EmailReportGuard,
    generateMetadata,
} from '@/app/[locale]/email-report/page';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';

const params = (locale: string) => Promise.resolve({ locale });

describe('EmailReportPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('메타데이터는 색인하지 않고 로케일별 canonical을 단다', async () => {
        const ko = await generateMetadata({ params: params('ko') });
        const en = await generateMetadata({ params: params('en') });

        expect(ko.title).toBe('메일 리포트');
        expect(ko.robots).toEqual({ index: false, follow: false });
        expect(ko.alternates?.canonical).toBe(
            'https://siglens.io/email-report'
        );
        expect(en.title).toBe('Email report');
        expect(en.alternates?.canonical).toBe(
            'https://siglens.io/en/email-report'
        );
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

    it('로그인 회원에게는 수신 설정 폼을 보인다', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1' } as never);

        render(await EmailReportGuard({ locale: 'ko' }));

        expect(screen.getByTestId('settings-section')).toBeInTheDocument();
        expect(redirect).not.toHaveBeenCalled();
    });

    it('제목·안내와 리포트에 담기는 종목 설명, 포트폴리오 링크를 그린다', async () => {
        render(await EmailReportPage({ params: params('ko') }));

        expect(
            screen.getByRole('heading', { level: 1, name: '메일 리포트' })
        ).toBeInTheDocument();
        expect(
            screen.getByText(/포트폴리오에 담은 종목 중 최대 5개/)
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: '포트폴리오에서 종목 관리하기' })
        ).toHaveAttribute('href', '/portfolio');
    });
});
