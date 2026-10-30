// @vitest-environment jsdom
vi.mock('@/shared/ui/LocaleLink', () => ({
    LocaleLink: ({
        href,
        prefetch,
        children,
    }: {
        href: string;
        prefetch?: boolean;
        children: React.ReactNode;
    }) => (
        <a href={href} data-prefetch={String(prefetch)}>
            {children}
        </a>
    ),
}));

import { render, screen, within } from '@testing-library/react';
import { SymbolDirectoryList } from '@/app/[locale]/symbols/_components/SymbolDirectoryList';
import type { SymbolDirectorySection } from '@/shared/lib/symbolDirectory';

const SECTIONS: readonly SymbolDirectorySection[] = [
    {
        id: 'us',
        labelKey: 'nav.us',
        items: [
            { symbol: 'AAPL', label: 'Apple (AAPL)' },
            { symbol: 'MSFT', label: 'Microsoft (MSFT)' },
        ],
    },
    {
        id: 'crypto',
        labelKey: 'nav.crypto',
        items: [{ symbol: 'BTC', label: 'Bitcoin (BTC)' }],
    },
];

const renderList = () =>
    render(
        <SymbolDirectoryList
            sections={SECTIONS}
            labelOf={key => `라벨:${key}`}
        />
    );

describe('SymbolDirectoryList', () => {
    it('섹션 제목은 labelOf로 번역한 라벨과 개수를 보여 준다', () => {
        renderList();
        expect(
            screen.getByRole('heading', { name: '라벨:nav.us2' })
        ).toBeInTheDocument();
    });

    it('섹션 제목 id는 symbols-<id> 형식이다', () => {
        renderList();
        expect(
            screen.getByRole('heading', { name: '라벨:nav.crypto1' })
        ).toHaveAttribute('id', 'symbols-crypto');
    });

    it('목록은 같은 섹션 제목 id를 aria-labelledby로 가리킨다', () => {
        renderList();
        const lists = screen.getAllByRole('list');
        expect(lists.map(list => list.getAttribute('aria-labelledby'))).toEqual(
            ['symbols-us', 'symbols-crypto']
        );
    });

    it('모든 종목 링크는 /<symbol> 경로로 나간다', () => {
        renderList();
        expect(
            screen.getAllByRole('link').map(link => link.getAttribute('href'))
        ).toEqual(['/AAPL', '/MSFT', '/BTC']);
    });

    it('모든 종목 링크는 prefetch={false}다', () => {
        renderList();
        expect(
            screen
                .getAllByRole('link')
                .map(link => link.getAttribute('data-prefetch'))
        ).toEqual(['false', 'false', 'false']);
    });

    it('링크 라벨은 항목 label 그대로다', () => {
        renderList();
        const [first] = screen.getAllByRole('list');
        expect(
            within(first).getByRole('link', { name: 'Apple (AAPL)' })
        ).toBeInTheDocument();
    });
});
