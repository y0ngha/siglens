import { render, screen } from '@testing-library/react';

vi.mock('@/features/email-report-unsubscribe/ui/UnsubscribeConfirm', () => ({
    UnsubscribeConfirm: () => <div data-testid="unsubscribe-confirm" />,
}));
vi.mock('@/shared/ui/auth/AuthCardShell', () => ({
    AuthCardShell: ({
        title,
        subtitle,
        children,
    }: {
        title: string;
        subtitle: string;
        children: React.ReactNode;
    }) => (
        <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
            {children}
        </div>
    ),
}));
vi.mock('@/shared/ui/auth/AuthFormSkeleton', () => ({
    AuthFormSkeleton: () => <div data-testid="skeleton" />,
}));
vi.mock('@/shared/lib/seo', () => ({
    SITE_NAME: 'SIGLENS',
    SITE_URL: 'https://siglens.io',
}));

import EmailReportUnsubscribePage, {
    generateMetadata,
} from '@/app/[locale]/email-report/unsubscribe/page';

const params = (locale: string) => Promise.resolve({ locale });

describe('EmailReportUnsubscribePage', () => {
    it('제목·안내와 확인 컴포넌트를 그린다', async () => {
        render(await EmailReportUnsubscribePage({ params: params('ko') }));

        expect(
            screen.getByRole('heading', { name: '메일 리포트 수신 거부' })
        ).toBeInTheDocument();
        expect(screen.getByTestId('unsubscribe-confirm')).toBeInTheDocument();
    });

    it('메타데이터는 색인하지 않고 로케일별 canonical을 단다', async () => {
        const ko = await generateMetadata({ params: params('ko') });
        const en = await generateMetadata({ params: params('en') });

        expect(ko.title).toBe('메일 리포트 수신 거부');
        expect(ko.description).toBe(
            'SIGLENS 정기 메일 리포트 수신을 거부합니다.'
        );
        expect(ko.robots).toEqual({ index: false, follow: false });
        expect(ko.alternates?.canonical).toBe(
            'https://siglens.io/email-report/unsubscribe'
        );
        expect(en.title).toBe('Unsubscribe from email reports');
        expect(en.alternates?.canonical).toBe(
            'https://siglens.io/en/email-report/unsubscribe'
        );
    });
});
