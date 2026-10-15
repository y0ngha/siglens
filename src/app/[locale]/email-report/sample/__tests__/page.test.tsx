import { render, screen } from '@testing-library/react';

vi.mock('@/shared/lib/seo', () => ({ SITE_URL: 'https://siglens.io' }));
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

import EmailReportSamplePage, {
    generateMetadata,
    revalidate,
} from '@/app/[locale]/email-report/sample/page';

const params = (locale: string) => Promise.resolve({ locale });

describe('EmailReportSamplePage', () => {
    it('실제 메일 템플릿으로 만든 샘플을 iframe에 담아 그린다', async () => {
        render(await EmailReportSamplePage({ params: params('ko') }));

        const frame = screen.getByTitle('메일 리포트 샘플 미리보기');
        const srcDoc = frame.getAttribute('srcdoc') ?? '';
        expect(srcDoc).toContain('<head><base target="_blank">');
        expect(srcDoc).toContain('>NVDA</h2>');
        expect(srcDoc).toContain('>AAPL</h2>');
        expect(srcDoc).toContain('/api/email-report/sample-chart/NVDA');
        expect(srcDoc).not.toContain('/api/email-report/unsubscribe');
    });

    it('ISR 재검증 주기는 리터럴 하루다', () => {
        expect(revalidate).toBe(86400);
    });

    it('메타데이터는 색인하지 않되 링크는 따라가고 로케일별 canonical을 단다', async () => {
        const ko = await generateMetadata({ params: params('ko') });
        const en = await generateMetadata({ params: params('en') });

        expect(ko.robots).toEqual({ index: false, follow: true });
        expect(ko.title).toBe('메일 리포트 샘플 보기');
        expect(ko.description).toBeTruthy();
        expect(ko.alternates?.canonical).toBe(
            'https://siglens.io/email-report/sample'
        );
        expect(en.alternates?.canonical).toBe(
            'https://siglens.io/en/email-report/sample'
        );
        expect(en.title).toBe('Email report sample');
        expect(ko.openGraph?.url).toBe(
            'https://siglens.io/email-report/sample'
        );
        expect(ko.twitter?.title).toBe('메일 리포트 샘플 보기');
    });
});
