// @vitest-environment jsdom
vi.mock('next-intl/server', () => ({
    getTranslations: vi.fn(async () => (key: string) => `t:${key}`),
}));
vi.mock('@/views/watchlist/WatchlistPageContent', () => ({
    WatchlistPageContent: () => <p>목록 본문</p>,
}));
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

import { render, screen } from '@testing-library/react';
import { WatchlistShell } from '@/app/[locale]/watchlist/_components/WatchlistShell';

describe('WatchlistShell', () => {
    it('main 랜드마크 안에 h1 제목을 둔다', async () => {
        render(await WatchlistShell());
        expect(screen.getByRole('main')).toContainElement(
            screen.getByRole('heading', { level: 1, name: 't:page.title' })
        );
    });

    it('보유종목 링크는 /portfolio이며 prefetch하지 않는다', async () => {
        render(await WatchlistShell());
        const link = screen.getByRole('link', { name: 't:page.toPortfolio' });
        expect(link).toHaveAttribute('href', '/portfolio');
        expect(link).toHaveAttribute('data-prefetch', 'false');
    });

    it('클라이언트 목록 본문을 함께 렌더한다', async () => {
        render(await WatchlistShell());
        expect(screen.getByText('목록 본문')).toBeInTheDocument();
    });
});
