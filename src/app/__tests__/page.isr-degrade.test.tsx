/**
 * ISR empty-cache prevention tests for the home page (app/page.tsx).
 *
 * loadSkills() and countSkillFiles() failures during ISR cold-gen must NOT
 * propagate — the Home() RSC must resolve to a non-empty element using the
 * graceful fallback paths already in place ([] / zeroed counts).
 *
 * Strategy: mock @/entities/skill to reject, invoke Home() directly, and
 * confirm it resolves without throwing. Mirrors page.test.ts mocking pattern.
 */

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
vi.mock('@/widgets/home', () => ({
    CryptoShowcase: () => null,
    HeroIllustration: () => null,
    HowItWorks: () => null,
    SkillsShowcase: () => null,
    SkillsShowcaseSkeleton: () => null,
    StatsBar: () => null,
    StatsBarSkeleton: () => null,
    TickerCategories: () => null,
}));
vi.mock('@/features/ticker-search', () => ({ SymbolSearchPanel: () => null }));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@/entities/skill', () => ({
    countSkillFiles: vi.fn(),
    FileSkillsLoader: vi.fn(),
}));
vi.mock('@/shared/lib/seo', () => ({
    SITE_DESCRIPTION: 'test description',
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));
vi.mock('next/link', () => ({ default: () => null }));

import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    type MockedFunction,
    type MockedClass,
} from 'vitest';
import { isValidElement } from 'react';
import Home from '@/app/page';
import { countSkillFiles, FileSkillsLoader } from '@/entities/skill';

const mockCountSkillFiles = countSkillFiles as MockedFunction<
    typeof countSkillFiles
>;
const MockFileSkillsLoader = FileSkillsLoader as MockedClass<
    typeof FileSkillsLoader
>;

describe('Home page ISR empty-cache prevention', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('countSkillFiles throw → Home resolves (non-empty element, does not throw)', async () => {
        // Simulate a transient fs failure during ISR cold-gen.
        mockCountSkillFiles.mockRejectedValue(
            new Error('ENOENT: skill dir missing')
        );
        MockFileSkillsLoader.mockImplementation(
            () =>
                ({
                    loadSkills: vi.fn().mockResolvedValue([]),
                }) as unknown as InstanceType<typeof FileSkillsLoader>
        );

        // Must NOT reject — the .catch() in Home() must absorb and use zero counts.
        const element = await Home();

        expect(isValidElement(element)).toBe(true);
    });

    it('loadSkills throw → Home resolves (non-empty element, does not throw)', async () => {
        // countSkillFiles succeeds but FileSkillsLoader.loadSkills rejects.
        mockCountSkillFiles.mockResolvedValue({
            indicators: 0,
            candlesticks: 0,
            patterns: 0,
            strategies: 0,
            supportResistance: 0,
            fundamental: 0,
            news: 0,
        });
        MockFileSkillsLoader.mockImplementation(
            () =>
                ({
                    loadSkills: vi
                        .fn()
                        .mockRejectedValue(new Error('skills dir unreadable')),
                }) as unknown as InstanceType<typeof FileSkillsLoader>
        );

        // Must NOT reject — the try/catch in loadSkills() must absorb and return [].
        const element = await Home();

        expect(isValidElement(element)).toBe(true);
    });

    it('both countSkillFiles and loadSkills throw → Home still resolves non-empty', async () => {
        mockCountSkillFiles.mockRejectedValue(new Error('fs error'));
        MockFileSkillsLoader.mockImplementation(
            () =>
                ({
                    loadSkills: vi
                        .fn()
                        .mockRejectedValue(new Error('fs error')),
                }) as unknown as InstanceType<typeof FileSkillsLoader>
        );

        const element = await Home();

        // Page is non-empty — returns a valid React element (not null / undefined).
        expect(isValidElement(element)).toBe(true);
    });
});
