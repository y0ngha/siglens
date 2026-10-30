import { getTranslations } from 'next-intl/server';
import { beforeAll, describe, expect, it } from 'vitest';
import { GUIDE_CATEGORIES, type GuideCategory } from '@/entities/guide/types';
import ko from '../../../../../messages/ko.json';
import en from '../../../../../messages/en.json';
import ja from '../../../../../messages/ja.json';
import zh from '../../../../../messages/zh.json';
import { SEO_TITLE_MAX_WIDTH, seoTitleWidth } from '@/shared/lib/seo';

import {
    HOWTO_COUNT_DISPLAY_MIN,
    countGuideHubEntries,
    hubSeoDescription,
    loadGuideCategoryCopy,
    loadGuideHubSeoCopy,
    type HubSeoDescriptionTranslator,
} from '../guideCopy';

const catalogs = { ko, en } as const;

const CATEGORY_KEYS = {
    howto: 'Howto',
    candlesticks: 'Candlesticks',
    'chart-patterns': 'ChartPatterns',
    indicators: 'Indicators',
    strategies: 'Strategies',
} as const;

describe('loadGuideCategoryCopy', () => {
    it.each(GUIDE_CATEGORIES)(
        'ko: %s의 표시명·소개·SEO 제목이 각자의 카탈로그 키를 읽는다',
        async category => {
            const copy = await loadGuideCategoryCopy('ko');
            const g = ko.views.guide;
            const suffix = CATEGORY_KEYS[category];

            expect(copy.label[category]).toBe(
                g[`category${suffix}` as keyof typeof g]
            );
            expect(copy.intro[category]).toBe(
                g[`categoryIntro${suffix}` as keyof typeof g]
            );
            expect(copy.seoTitle[category]).toBe(
                g[`categorySeoTitle${suffix}` as keyof typeof g]
            );
        }
    );

    it('모든 분류 키가 채워지고 분류끼리 서로 다른 문구다', async () => {
        const copy = await loadGuideCategoryCopy('ko');

        for (const field of ['label', 'intro', 'seoTitle'] as const) {
            expect(Object.keys(copy[field]).sort()).toEqual(
                [...GUIDE_CATEGORIES].sort()
            );
            const values = GUIDE_CATEGORIES.map(c => copy[field][c]);
            expect(values.every(v => v !== '')).toBe(true);
            expect(new Set(values).size).toBe(GUIDE_CATEGORIES.length);
        }
    });

    it('요청 로케일의 views.guide 카탈로그를 읽는다', async () => {
        const copy = await loadGuideCategoryCopy('en');

        expect(copy.label.indicators).toBe(en.views.guide.categoryIndicators);
        expect(copy.label.indicators).not.toBe(
            ko.views.guide.categoryIndicators
        );
    });
});

describe('loadGuideHubSeoCopy', () => {
    it('ko: 제목·설명(용어 수 치환)·키워드를 카탈로그에서 읽는다', async () => {
        const copy = await loadGuideHubSeoCopy('ko', { terms: 42, howto: 0 });

        expect(copy.hubTitle).toBe(ko.views.guide.hubTitle);
        expect(copy.hubSeoTitle).toBe(ko.views.guide.hubSeoTitle);
        expect(copy.hubSeoDescription).toBe(
            ko.views.guide.hubSeoDescription.replace('{terms}', '42')
        );
        expect(copy.hubSeoDescription).toContain('42');
    });

    it('실전 가이드가 기준 편수 이상이면 용어 수와 가이드 수를 따로 적는다', async () => {
        const copy = await loadGuideHubSeoCopy('ko', {
            terms: 90,
            howto: HOWTO_COUNT_DISPLAY_MIN,
        });

        expect(copy.hubSeoDescription).toBe(
            ko.views.guide.hubSeoDescriptionWithHowto
                .replace('{terms}', '90')
                .replace('{howto}', String(HOWTO_COUNT_DISPLAY_MIN))
        );
        expect(copy.hubSeoDescription).toContain('90');
        expect(copy.hubSeoDescription).toContain(
            `${HOWTO_COUNT_DISPLAY_MIN}편`
        );
    });

    it('실전 가이드가 기준 편수 미만이면 가이드 수를 빼고 용어 수만 적는다', async () => {
        const copy = await loadGuideHubSeoCopy('ko', {
            terms: 90,
            howto: HOWTO_COUNT_DISPLAY_MIN - 1,
        });

        expect(copy.hubSeoDescription).toBe(
            ko.views.guide.hubSeoDescriptionWithHowtoNoCount.replace(
                '{terms}',
                '90'
            )
        );
        expect(copy.hubSeoDescription).toContain('실전 가이드');
        expect(copy.hubSeoDescription).not.toMatch(/\d+편/);
    });

    it('실전 가이드가 없으면 "0편"을 적지 않는다', async () => {
        const copy = await loadGuideHubSeoCopy('ko', { terms: 90, howto: 0 });

        expect(copy.hubSeoDescription).not.toContain('0편');
        expect(copy.hubSeoDescription).not.toContain('실전 가이드');
    });

    it('키워드는 쉼표로 나눠 앞뒤 공백을 자른다', async () => {
        const copy = await loadGuideHubSeoCopy('ko', { terms: 1, howto: 0 });

        expect(copy.hubSeoKeywords).toEqual(
            ko.views.guide.hubSeoKeywords.split(',').map(k => k.trim())
        );
        expect(copy.hubSeoKeywords.length).toBeGreaterThan(1);
        expect(copy.hubSeoKeywords.every(k => k === k.trim() && k !== '')).toBe(
            true
        );
    });

    it('categoryDescription은 count를 치환하고 분류마다 다른 문장이다', async () => {
        const copy = await loadGuideHubSeoCopy('ko', { terms: 1, howto: 0 });
        const count = HOWTO_COUNT_DISPLAY_MIN + 17;
        const texts = GUIDE_CATEGORIES.map(category =>
            copy.categoryDescription(category, count)
        );

        expect(texts.every(text => text.includes(String(count)))).toBe(true);
        expect(texts.some(text => text.includes('{'))).toBe(false);
        expect(new Set(texts).size).toBe(GUIDE_CATEGORIES.length);
    });

    it('categoryDescription은 모르는 분류를 조용히 undefined로 넘기지 않고 던진다', async () => {
        const copy = await loadGuideHubSeoCopy('ko', { terms: 1, howto: 0 });

        expect(() =>
            copy.categoryDescription('unknown' as GuideCategory, 1)
        ).toThrow('Unhandled guide category: unknown');
    });

    it.each(['ko', 'en'] as const)(
        '%s 전략·이론 SEO 제목에 특정 이론명이 박혀 있지 않다',
        async locale => {
            const copy = await loadGuideCategoryCopy(locale);
            expect(copy.seoTitle.strategies).not.toMatch(
                /엘리[엇어]트|Elliott/
            );
        }
    );

    it('howto SEO 설명은 기준 편수 이상이면 count를 치환해 ko 카탈로그에서 읽는다', async () => {
        const copy = await loadGuideHubSeoCopy('ko', { terms: 3, howto: 0 });

        expect(copy.categoryDescription('howto', HOWTO_COUNT_DISPLAY_MIN)).toBe(
            ko.views.guide.categorySeoDescriptionHowto.replace(
                '{count}',
                String(HOWTO_COUNT_DISPLAY_MIN)
            )
        );
    });

    it.each(['ko', 'en'] as const)(
        '%s howto SEO 설명은 기준 편수 미만이면 수를 적지 않는다',
        async locale => {
            const copy = await loadGuideHubSeoCopy(locale, {
                terms: 3,
                howto: 0,
            });
            const text = copy.categoryDescription(
                'howto',
                HOWTO_COUNT_DISPLAY_MIN - 1
            );

            expect(text).toBe(
                catalogs[locale].views.guide.categorySeoDescriptionHowtoNoCount
            );
            expect(text).not.toMatch(/\d/);
            expect(text).not.toContain('{');
        }
    );

    it('en은 영어 카탈로그를 읽는다', async () => {
        const copy = await loadGuideHubSeoCopy('en', { terms: 3, howto: 0 });

        expect(copy.hubTitle).toBe(en.views.guide.hubTitle);
        expect(copy.hubTitle).not.toBe(ko.views.guide.hubTitle);
    });
});

describe('hubSeoDescription', () => {
    let t: HubSeoDescriptionTranslator;
    beforeAll(async () => {
        t = await getTranslations({ locale: 'ko', namespace: 'views.guide' });
    });

    it('실전 가이드가 기준 편수 이상이면 용어 수와 가이드 수를 함께 적는 문구다', () => {
        expect(
            hubSeoDescription(t, {
                terms: 90,
                howto: HOWTO_COUNT_DISPLAY_MIN,
            })
        ).toBe(
            ko.views.guide.hubSeoDescriptionWithHowto
                .replace('{terms}', '90')
                .replace('{howto}', String(HOWTO_COUNT_DISPLAY_MIN))
        );
    });

    it('실전 가이드가 1편 이상 기준 편수 미만이면 가이드 수를 뺀 문구다', () => {
        expect(
            hubSeoDescription(t, {
                terms: 90,
                howto: HOWTO_COUNT_DISPLAY_MIN - 1,
            })
        ).toBe(
            ko.views.guide.hubSeoDescriptionWithHowtoNoCount.replace(
                '{terms}',
                '90'
            )
        );
    });

    it('실전 가이드가 없으면 실전 가이드를 언급하지 않는 기본 문구다', () => {
        expect(hubSeoDescription(t, { terms: 90, howto: 0 })).toBe(
            ko.views.guide.hubSeoDescription.replace('{terms}', '90')
        );
    });
});

describe('countGuideHubEntries', () => {
    it('howto가 아닌 항목은 용어로, howto는 따로 센다', () => {
        expect(
            countGuideHubEntries([
                { category: 'indicators' },
                { category: 'chart-patterns' },
                { category: 'howto' },
                { category: 'candlesticks' },
                { category: 'howto' },
            ])
        ).toEqual({ terms: 3, howto: 2 });
        expect(countGuideHubEntries([])).toEqual({ terms: 0, howto: 0 });
    });
});

describe('howto 분류 SEO 제목', () => {
    it.each([
        ['ko', ko],
        ['en', en],
        ['ja', ja],
        ['zh', zh],
    ] as const)(
        '%s 폭이 SEO_TITLE_MAX_WIDTH를 넘지 않는다',
        (_locale, messages) => {
            expect(
                seoTitleWidth(messages.views.guide.categorySeoTitleHowto)
            ).toBeLessThanOrEqual(SEO_TITLE_MAX_WIDTH);
        }
    );

    it('항목 "주식 차트 보는 법"과 같은 검색어를 제목에 쓰지 않는다', () => {
        expect(ko.views.guide.categorySeoTitleHowto).not.toContain('보는 법');
    });
});
