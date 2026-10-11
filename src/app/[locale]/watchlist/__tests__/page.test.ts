vi.mock('@/features/watchlist/ui/WatchlistPageContent', () => ({
    WatchlistPageContent: function WatchlistPageContent() {
        return null;
    },
}));

import { generateMetadata } from '@/app/[locale]/watchlist/page';

describe('Watchlist page', () => {
    it('제목은 관심종목이고 색인하지 않는다', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });
        expect(metadata.title).toBe('관심종목');
        expect(metadata.robots).toEqual(
            expect.objectContaining({ index: false, follow: false })
        );
    });

    it('canonical은 로케일의 자기 경로다', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'en' }),
        });
        expect(String(metadata.alternates?.canonical)).toMatch(
            /\/en\/watchlist$/
        );
    });
});
