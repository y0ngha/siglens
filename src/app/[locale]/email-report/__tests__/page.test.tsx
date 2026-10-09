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
const mockFindHoldings = vi.fn();
const mockFindWatchlist = vi.fn();
vi.mock('@/entities/portfolio/api', () => ({
    DrizzlePortfolioRepository: vi.fn().mockImplementation(function () {
        return { findByUser: mockFindHoldings };
    }),
}));
vi.mock('@/entities/watchlist/api', () => ({
    DrizzleWatchlistRepository: vi.fn().mockImplementation(function () {
        return { findByUser: mockFindWatchlist };
    }),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn().mockReturnValue({ db: {} }),
}));
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
    ReportPreviewLoader,
    generateMetadata,
} from '@/app/[locale]/email-report/page';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';

const params = (locale: string) => Promise.resolve({ locale });

describe('EmailReportPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFindHoldings.mockResolvedValue([]);
        mockFindWatchlist.mockResolvedValue([]);
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
        expect(mockFindHoldings).not.toHaveBeenCalled();
        expect(redirect).not.toHaveBeenCalled();
    });

    it('미리보기 로더는 보유·관심종목을 읽어 상세 그룹에 이름 칩을 그린다', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1' } as never);
        mockFindHoldings.mockResolvedValue([
            {
                symbol: 'AAPL',
                companyName: 'Apple',
                quantity: '1',
                averagePrice: '100',
            },
        ]);
        mockFindWatchlist.mockResolvedValue([
            {
                symbol: 'TSLA',
                companyName: 'Tesla',
                createdAt: new Date('2026-10-08T00:00:00Z'),
            },
        ]);

        render(await ReportPreviewLoader());

        expect(mockFindHoldings).toHaveBeenCalledWith('u-1');
        expect(mockFindWatchlist).toHaveBeenCalledWith('u-1');
        const group = screen.getByRole('group', { name: '상세' });
        expect(group).toHaveTextContent('Apple');
        expect(group).toHaveTextContent('Tesla');
    });

    it('이름이 null인 행이 다른 쪽의 알려진 이름을 덮지 않는다', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1' } as never);
        mockFindHoldings.mockResolvedValue([
            {
                symbol: 'AAPL',
                companyName: null,
                quantity: '1',
                averagePrice: '100',
            },
        ]);
        mockFindWatchlist.mockResolvedValue([
            {
                symbol: 'AAPL',
                companyName: 'Apple',
                createdAt: new Date('2026-10-08T00:00:00Z'),
            },
        ]);

        render(await ReportPreviewLoader());

        expect(screen.getByRole('group', { name: '상세' })).toHaveTextContent(
            'Apple'
        );
    });

    it('종목 조회가 실패하면 미리보기만 안내로 대체한다', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u-1' } as never);
        mockFindWatchlist.mockRejectedValue(new Error('db down'));

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
