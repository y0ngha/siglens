import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CompanyFiling } from '@/entities/company-filings/model';
import { CompanyFilings } from '@/widgets/news/sections/CompanyFilings';

const mockLocale = vi.hoisted(() => ({
    value: 'ko' as 'ko' | 'en' | 'ja' | 'zh',
}));
vi.mock('@/shared/i18n/useResolvedLocale', () => ({
    useResolvedLocale: () => mockLocale.value,
}));

const filing = (
    n: number,
    over: Partial<CompanyFiling> = {}
): CompanyFiling => ({
    accession: `0001193125-26-4610${String(n).padStart(2, '0')}`,
    form: '8-K',
    filedAt: '2026-11-13',
    items: [
        {
            code: '2.02',
            label: 'Results of operations and financial condition',
        },
        { code: '7.01', label: 'Regulation FD disclosure' },
    ],
    headline: 'IonQ Announces Third Quarter 2026 Financial Results',
    hasPressRelease: true,
    url: `https://www.sec.gov/Archives/edgar/data/1824920/${n}/ex99.htm`,
    ...over,
});

describe('CompanyFilings', () => {
    afterEach(() => {
        mockLocale.value = 'ko';
    });

    it('제목·안내·종류(번역 라벨)·영어 원문 제목·SEC 링크(새 탭, nofollow)를 그린다', () => {
        render(<CompanyFilings filings={[filing(1)]} />);
        expect(
            screen.getByRole('heading', { name: '최근 공시' })
        ).toBeInTheDocument();
        expect(screen.getByText('실적 발표, 공정공시')).toBeInTheDocument();
        const headline = screen.getByText(/Third Quarter 2026/);
        expect(headline).toHaveAttribute('lang', 'en');
        const link = screen.getByRole('link', { name: /SEC 원문 보기/ });
        expect(link).toHaveAttribute('href', filing(1).url);
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener nofollow');
        expect(link).toHaveTextContent('(새 탭)');
        expect(screen.getByText('8-K')).toBeInTheDocument();
    });

    it('6-K는 해외 발행인 보고, 표에 없는 항목 코드는 코드 그대로, 제목이 없으면 제목 줄이 없다', () => {
        render(
            <CompanyFilings
                filings={[
                    filing(1, { form: '6-K', items: [], headline: null }),
                    filing(2, { items: [{ code: '9.99', label: '9.99' }] }),
                ]}
            />
        );
        expect(screen.getByText('해외 발행인 보고')).toBeInTheDocument();
        expect(screen.getByText('항목 9.99')).toBeInTheDocument();
        expect(screen.getAllByText(/Third Quarter/)).toHaveLength(1);
    });

    it.each([
        ['en', '실적 발표, 공정공시'],
        ['ja', '실적 발표、공정공시'],
        ['zh', '실적 발표、공정공시'],
    ] as const)(
        '%s 로케일은 종류 라벨을 그 로케일의 나열 부호로 잇는다',
        (locale, text) => {
            mockLocale.value = locale;
            render(<CompanyFilings filings={[filing(1)]} />);
            expect(screen.getByText(text)).toBeInTheDocument();
        }
    );

    it('5건만 보이고 더보기로 나머지를 펼친다', async () => {
        const user = userEvent.setup();
        render(
            <CompanyFilings
                filings={Array.from({ length: 8 }, (_, i) => filing(i))}
            />
        );
        expect(screen.getAllByRole('listitem')).toHaveLength(5);
        await user.click(
            screen.getByRole('button', { name: '더보기 (3개 남음)' })
        );
        expect(screen.getAllByRole('listitem')).toHaveLength(8);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
});
