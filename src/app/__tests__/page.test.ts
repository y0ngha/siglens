vi.mock('@/widgets/home/HeroIllustration', () => ({
    HeroIllustration: () => null,
}));
vi.mock('@/widgets/home/HowItWorks', () => ({ HowItWorks: () => null }));
vi.mock('@/widgets/home/SkillsShowcase', () => ({
    SkillsShowcase: () => null,
    SkillsShowcaseSkeleton: () => null,
}));
vi.mock('@/widgets/home/StatsBar', () => ({
    StatsBar: () => null,
    StatsBarSkeleton: () => null,
}));
vi.mock('@/widgets/home/TickerCategories', () => ({
    TickerCategories: () => null,
}));
vi.mock('@/features/ticker-search', () => ({ SymbolSearchPanel: () => null }));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@/entities/skill', () => ({
    countSkillFiles: vi.fn().mockResolvedValue({
        indicators: 13,
        candlesticks: 30,
        patterns: 5,
        strategies: 4,
        supportResistance: 3,
    }),
    FileSkillsLoader: vi.fn().mockImplementation(() => ({
        loadSkills: vi.fn().mockResolvedValue([]),
    })),
}));
vi.mock('@/shared/lib/seo', () => ({
    SITE_DESCRIPTION: 'test description',
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));
vi.mock('next/link', () => ({ default: () => null }));

import { revalidate } from '@/app/page';

describe('Home page', () => {
    it('exports revalidate as 86400 for ISR', () => {
        expect(revalidate).toBe(86400);
    });
});
