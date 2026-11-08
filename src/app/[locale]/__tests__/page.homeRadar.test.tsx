vi.mock('@/widgets/home/utils/heroQuickLinks', () => ({
    HERO_QUICK_LINKS: [
        { href: '/market', labelKey: 'shared.config.nav.full.market.us' },
    ],
}));
vi.mock('@/widgets/home/CryptoShowcase', () => ({
    CryptoShowcase: () => null,
}));
vi.mock('@/widgets/home/HeroIllustration', () => ({
    HeroIllustration: () => null,
}));
vi.mock('@/widgets/home/SkillsShowcase', () => ({
    SkillsShowcase: () => null,
}));
vi.mock('@/widgets/home/StatsBar', () => ({
    StatsBar: () => null,
}));
vi.mock('@/features/watchlist/ui/HomeWatchlistCard', () => ({
    HomeWatchlistCard: () => null,
}));
vi.mock('@/widgets/home/TickerCategories', () => ({
    TickerCategories: () => null,
}));
vi.mock('@/features/ticker-search/ui/SymbolSearchPanel', () => ({
    SymbolSearchPanel: () => null,
}));
vi.mock('@/entities/skill/api', () => ({
    countSkillFiles: vi.fn().mockResolvedValue({
        indicators: 13,
        candlesticks: 30,
        patterns: 5,
        strategies: 4,
        supportResistance: 3,
        fundamental: 2,
        news: 1,
    }),
    loadShowcaseSkills: vi.fn().mockResolvedValue([]),
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

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

import Home from '@/app/[locale]/(home)/page';
import {
    RADAR_DASHBOARDS,
    RADAR_SITE_URL,
    radarDashboardUrl,
} from '@/shared/config/radar';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';

async function renderHome(locale: string) {
    return await Home({ params: Promise.resolve({ locale }) });
}

describe('홈 종목 레이더 진입 카드', () => {
    it('기본 로케일 홈에는 레이더 카드와 대시보드 칩이 있다', async () => {
        const { container } = render(await renderHome(DEFAULT_LOCALE));

        const hrefs = [...container.querySelectorAll('a')].map(a =>
            a.getAttribute('href')
        );
        expect(hrefs).toContain(RADAR_SITE_URL);
        for (const { slug } of RADAR_DASHBOARDS) {
            expect(hrefs).toContain(radarDashboardUrl(slug));
        }
    });

    it('다른 로케일 홈에는 레이더 링크가 없다', async () => {
        const { container } = render(await renderHome('en'));

        const hrefs = [...container.querySelectorAll('a')].map(
            a => a.getAttribute('href') ?? ''
        );
        expect(hrefs.some(href => href.startsWith(RADAR_SITE_URL))).toBe(false);
    });
});
