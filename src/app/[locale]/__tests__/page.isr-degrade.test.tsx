/**
 * ISR empty-cache prevention tests for the home page (app/page.tsx).
 *
 * loadSkills() and countSkillFiles() failures during ISR cold-gen must NOT
 * propagate — the Home({ params: Promise.resolve({ locale: 'ko' }) }) RSC must resolve to a non-empty element using the
 * graceful fallback paths already in place ([] / zeroed counts).
 *
 * Strategy: mock @/entities/skill to reject, invoke Home({ params: Promise.resolve({ locale: 'ko' }) }) directly, and
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
    // 컴포넌트가 아닌 상수도 이 배럴을 통해 나간다 — 빠뜨리면 `page.tsx`가
    // `undefined.map`으로 죽어 ISR degrade 테스트가 엉뚱한 이유로 실패한다.
    //
    // 빈 배열로 두지 않는다. degrade 경로에서 홈이 "비지 않은 엘리먼트"를 낸다는
    // 이 파일의 단언은, 히어로 퀵링크 렌더 블록이 통째로 사라져도 통과해 버린다.
    // 라벨은 이제 **메시지 키**다. 실제 카탈로그에 있는 키를 쓴다 — 지어낸 키면
    // 폴백 문자열이 나와 아래 단언이 카탈로그 누락을 잡지 못한다.
    HERO_QUICK_LINKS: [
        { href: '/market', labelKey: 'shared.config.nav.full.market.us' },
        { href: '/news', labelKey: 'shared.config.nav.full.news.us' },
    ],
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
    buildWebPageJsonLd: () => ({}),
    localizedAbsoluteUrl: (url: string) => url,
    SITE_DESCRIPTION: 'test description',
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));
// `() => null` 로 두면 홈의 모든 내부 링크가 사라진 상태를 테스트하게 된다.
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

import { koMessage } from '@/shared/test-utils/koMessage';
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
import { render, screen } from '@testing-library/react';
import Home from '@/app/[locale]/(home)/page';
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

        // Must NOT reject — the .catch() in Home({ params: Promise.resolve({ locale: 'ko' }) }) must absorb and use zero counts.
        const element = await Home({
            params: Promise.resolve({ locale: 'ko' }),
        });

        expect(isValidElement(element)).toBe(true);
    });

    /**
     * `isValidElement`만 보면 히어로 퀵링크 렌더 블록이 통째로 사라져도 통과한다.
     * degrade 경로에서도 홈의 주요 내부 링크가 살아 있어야 한다 — 홈은 이 사이트에서
     * 가장 링크 자산이 몰린 페이지다.
     */
    it('degrade 상태에서도 히어로 퀵링크를 렌더한다', async () => {
        mockCountSkillFiles.mockRejectedValue(new Error('ENOENT'));
        MockFileSkillsLoader.mockImplementation(
            () =>
                ({
                    loadSkills: vi.fn().mockResolvedValue([]),
                }) as unknown as InstanceType<typeof FileSkillsLoader>
        );

        render(await Home({ params: Promise.resolve({ locale: 'ko' }) }));

        expect(
            screen.getByRole('link', {
                name: koMessage('shared.config.nav.full.news.us'),
            })
        ).toHaveAttribute('href', '/news');
        expect(
            screen.getByRole('link', {
                name: koMessage('shared.config.nav.full.market.us'),
            })
        ).toHaveAttribute('href', '/market');
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
        const element = await Home({
            params: Promise.resolve({ locale: 'ko' }),
        });

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

        const element = await Home({
            params: Promise.resolve({ locale: 'ko' }),
        });

        // Page is non-empty — returns a valid React element (not null / undefined).
        expect(isValidElement(element)).toBe(true);
    });
});
