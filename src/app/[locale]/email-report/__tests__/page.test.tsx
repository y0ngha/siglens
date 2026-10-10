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
vi.mock('@/shared/lib/seo', () => ({
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
    ReportPreviewLoader,
    generateMetadata,
} from '@/app/[locale]/email-report/page';
import { loadReportPreview } from '@/app/[locale]/email-report/_lib/loadReportPreview';
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

    it('로그인 회원의 가드는 수신 설정 폼만 그리고 종목은 읽지 않는다', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1' } as never);

        render(await EmailReportGuard({ locale: 'ko' }));

        expect(screen.getByTestId('settings-section')).toBeInTheDocument();
        expect(loadReportPreview).not.toHaveBeenCalled();
        expect(redirect).not.toHaveBeenCalled();
    });

    it('미리보기 로더는 현재 회원의 대상 종목을 상세 그룹에 이름 칩으로 그린다', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1' } as never);
        vi.mocked(loadReportPreview).mockResolvedValue({
            full: [
                { symbol: 'AAPL', name: 'Apple' },
                { symbol: 'TSLA', name: 'Tesla' },
            ],
            brief: [],
        });

        render(await ReportPreviewLoader());

        expect(loadReportPreview).toHaveBeenCalledWith('u-1');
        const group = screen.getByRole('group', { name: '상세' });
        expect(group).toHaveTextContent('Apple');
        expect(group).toHaveTextContent('Tesla');
    });

    it('종목 조회가 실패하면(null) 미리보기만 안내로 대체한다', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1' } as never);
        vi.mocked(loadReportPreview).mockResolvedValue(null);

        render(await ReportPreviewLoader());

        expect(
            screen.getByText('리포트 대상 종목을 지금은 불러오지 못했어요.')
        ).toBeInTheDocument();
    });

    it('제목·안내를 그린다', async () => {
        render(await EmailReportPage({ params: params('ko') }));

        expect(
            screen.getByRole('heading', { level: 1, name: '메일 리포트' })
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                '고른 요일과 시각에 보유·관심종목 리포트를 메일로 받아 보세요.'
            )
        ).toBeInTheDocument();
    });
});
