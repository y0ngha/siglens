import { getTranslations } from 'next-intl/server';
import { beforeAll, describe, expect, it } from 'vitest';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import { METHODOLOGY_PATH, SITE_OPERATOR } from '@/shared/lib/legal';
import { CORE_GITHUB_URL, GITHUB_URL } from '@/shared/lib/seo';
import en from '../../../../../messages/en.json';
import ko from '../../../../../messages/ko.json';
import { EMPTY_SKILL_COUNTS } from '../../lib/aboutContent';
import {
    BACKTESTING_PATH,
    buildAiAboutLink,
    buildDataTiles,
    buildFreshnessLines,
    buildLimits,
    buildMethodLinks,
    buildMethodSteps,
    buildMoreLinks,
    buildOperatorLinks,
    buildPainPoints,
    toSkillCountValues,
} from '../../lib/aboutSections';
import type { AboutT } from '../../lib/types';

let t: AboutT;
beforeAll(async () => {
    t = await getTranslations({ locale: 'ko', namespace: 'views.about' });
});

const about = ko.views.about;

const SKILL_COUNTS = toSkillCountValues({
    ...EMPTY_SKILL_COUNTS,
    indicators: 41,
    candlesticks: 9,
    patterns: 13,
    strategies: 7,
});

describe('toSkillCountValues', () => {
    it('renames candlesticks to the copy’s {candles} argument', () => {
        expect(SKILL_COUNTS).toEqual({
            indicators: 41,
            candles: 9,
            patterns: 13,
            strategies: 7,
        });
    });
});

describe('buildPainPoints', () => {
    it('pairs each complaint with its answer, filling the indicator count', () => {
        const pains = buildPainPoints(t, SKILL_COUNTS);
        expect(pains).toHaveLength(5);
        expect(pains[0]).toEqual({
            was: about.pain.scattered,
            now: about.pain.scatteredFix,
        });
        expect(pains[1]!.now).toBe(
            '보조지표 41종을 모두 계산하고, 지금 눈여겨볼 신호만 골라 설명해요.'
        );
    });
});

describe('buildDataTiles', () => {
    it('gives eight tiles, each with a link label naming its example and tab', () => {
        const tiles = buildDataTiles(t, SKILL_COUNTS);
        expect(tiles.map(x => x.href)).toEqual([
            '/BTCUSD',
            '/005930.KS',
            '/005930.KS/financials',
            '/AAPL/fundamental',
            '/NVDA/news',
            '/NVDA/options',
            '/NVDA/congress',
            '/AAPL/fear-greed',
        ]);
        expect(tiles[2]).toMatchObject({
            title: about.data.financials,
            scope: about.data.scopeEquity,
            exampleLabel: '삼성전자 재무제표 보기',
        });
        expect(tiles[0]!.body).toBe(
            '가격과 거래량으로 이동평균, RSI, MACD 같은 보조지표 41종을 계산해요.'
        );
    });

    it('drops the intermediate example name from the tile record', () => {
        const [first] = buildDataTiles(t, SKILL_COUNTS);
        expect(first).not.toHaveProperty('exampleName');
    });
});

describe('buildMethodSteps', () => {
    it('fills the step-two counts', () => {
        const steps = buildMethodSteps(t, SKILL_COUNTS);
        expect(steps.map(s => s.title)).toEqual([
            about.method.step1,
            about.method.step2,
            about.method.step3,
        ]);
        expect(steps[1]!.body).toContain(
            '보조지표 41종, 캔들 패턴 9종, 전략 7종'
        );
    });
});

describe('method box content', () => {
    it('lists the three freshness lines in order', () => {
        expect(buildFreshnessLines(t)).toEqual([
            about.method.freshQuote,
            about.method.freshRefresh,
            about.method.freshMember,
        ]);
    });

    it('links to the methodology and backtesting pages', () => {
        expect(buildMethodLinks(t)).toEqual([
            { href: METHODOLOGY_PATH, label: about.method.methodology },
            { href: BACKTESTING_PATH, label: about.method.backtest },
        ]);
    });
});

describe('buildOperatorLinks', () => {
    it('gives mail, profile, repo and core repo, with rel=me only on the profile', () => {
        expect(buildOperatorLinks(t)).toEqual([
            {
                href: `mailto:${SITE_OPERATOR.email}`,
                label: about.operator.email,
            },
            {
                href: SITE_OPERATOR.githubUrl,
                label: about.operator.github,
                rel: 'me noopener',
                withGithubIcon: true,
            },
            { href: GITHUB_URL, label: about.operator.repo, rel: 'noopener' },
            {
                href: CORE_GITHUB_URL,
                label: about.operator.coreRepo,
                rel: 'noopener',
            },
        ]);
    });
});

describe('buildLimits', () => {
    it('lists the five limits in order', () => {
        expect(buildLimits(t)).toEqual([
            about.limits.wrong,
            about.limits.past,
            about.limits.personal,
            about.limits.variance,
            about.limits.levels,
        ]);
    });
});

describe('buildMoreLinks', () => {
    it('lists the hub paths with their labels', () => {
        expect(buildMoreLinks(t)).toEqual([
            { href: '/market', label: about.more.marketUs },
            { href: '/market/kr', label: about.more.marketKr },
            { href: '/fear-greed', label: about.more.fearGreed },
            { href: '/fear-greed/crypto', label: about.more.fearGreedCrypto },
            { href: BACKTESTING_PATH, label: about.more.backtesting },
        ]);
    });
});

describe('buildAiAboutLink', () => {
    it('points the default locale at the unprefixed ai about page', () => {
        expect(buildAiAboutLink(t, 'ko')).toEqual({
            href: `${AI_SITE_URL}/about`,
            label: about.more.ai,
        });
    });

    it('keeps a non-default locale’s prefix on the ai host', async () => {
        const tEn = await getTranslations({
            locale: 'en',
            namespace: 'views.about',
        });
        expect(buildAiAboutLink(tEn, 'en')).toEqual({
            href: `${AI_SITE_URL}/en/about`,
            label: en.views.about.more.ai,
        });
    });
});
