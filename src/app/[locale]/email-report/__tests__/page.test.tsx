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
vi.mock('@/features/email-report-settings/ui/ReportSymbolChip', () => ({
    ReportSymbolChip: ({
        symbol,
        name,
        mode,
    }: {
        symbol: string;
        name: string | null;
        mode: string;
    }) => <li data-mode={mode}>{name ?? symbol}</li>,
}));
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

import EmailReportPage, {
    generateMetadata,
} from '@/app/[locale]/email-report/page';

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

    it('제목과 안내를 그린다', async () => {
        render(await EmailReportPage({ params: params('ko') }));

        expect(
            screen.getByRole('heading', { level: 1, name: '메일 리포트' })
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                '고른 요일과 시각에 보유종목과 관심종목 리포트를 메일로 받아 보세요.'
            )
        ).toBeInTheDocument();
    });
});
