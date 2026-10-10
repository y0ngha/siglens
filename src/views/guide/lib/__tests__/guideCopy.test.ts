import { createTranslator } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GUIDE_CATEGORIES, type GuideCategory } from '@/entities/guide/types';
import ko from '../../../../../messages/ko.json';
import en from '../../../../../messages/en.json';

const catalogs = { ko, en } as const;

vi.mock('next-intl/server', () => ({
    getTranslations: vi.fn(
        async ({
            locale,
            namespace,
        }: {
            locale: 'ko' | 'en';
            namespace: string;
        }) =>
            createTranslator({
                locale,
                messages: catalogs[locale],
                namespace,
            } as never)
    ),
}));

import { loadGuideCategoryCopy, loadGuideHubSeoCopy } from '../guideCopy';

const CATEGORY_KEYS = {
    candlesticks: 'Candlesticks',
    'chart-patterns': 'ChartPatterns',
    indicators: 'Indicators',
    strategies: 'Strategies',
} as const;

beforeEach(() => {
    vi.mocked(getTranslations).mockClear();
});

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

    it('요청 로케일과 views.guide 네임스페이스로 번역자를 만든다', async () => {
        const copy = await loadGuideCategoryCopy('en');

        expect(getTranslations).toHaveBeenCalledWith({
            locale: 'en',
            namespace: 'views.guide',
        });
        expect(copy.label.indicators).toBe(en.views.guide.categoryIndicators);
        expect(copy.label.indicators).not.toBe(
            ko.views.guide.categoryIndicators
        );
    });
});

describe('loadGuideHubSeoCopy', () => {
    it('ko: 제목·설명(count 치환)·키워드를 카탈로그에서 읽는다', async () => {
        const copy = await loadGuideHubSeoCopy('ko', 42);

        expect(copy.hubTitle).toBe(ko.views.guide.hubTitle);
        expect(copy.hubSeoTitle).toBe(ko.views.guide.hubSeoTitle);
        expect(copy.hubSeoDescription).toBe(
            ko.views.guide.hubSeoDescription.replace('{count}', '42')
        );
        expect(copy.hubSeoDescription).toContain('42');
    });

    it('키워드는 쉼표로 나눠 앞뒤 공백을 자른다', async () => {
        const copy = await loadGuideHubSeoCopy('ko', 1);

        expect(copy.hubSeoKeywords).toEqual(
            ko.views.guide.hubSeoKeywords.split(',').map(k => k.trim())
        );
        expect(copy.hubSeoKeywords.length).toBeGreaterThan(1);
        expect(copy.hubSeoKeywords.every(k => k === k.trim() && k !== '')).toBe(
            true
        );
    });

    it('categoryDescription은 count를 치환하고 분류마다 다른 문장이다', async () => {
        const copy = await loadGuideHubSeoCopy('ko', 1);
        const texts = GUIDE_CATEGORIES.map(category =>
            copy.categoryDescription(category, 17)
        );

        expect(texts.every(text => text.includes('17'))).toBe(true);
        expect(texts.some(text => text.includes('{'))).toBe(false);
        expect(new Set(texts).size).toBe(GUIDE_CATEGORIES.length);
    });

    it('categoryDescription은 모르는 분류를 조용히 undefined로 넘기지 않고 던진다', async () => {
        const copy = await loadGuideHubSeoCopy('ko', 1);

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

    it('en은 영어 카탈로그를 읽는다', async () => {
        const copy = await loadGuideHubSeoCopy('en', 3);

        expect(copy.hubTitle).toBe(en.views.guide.hubTitle);
        expect(copy.hubTitle).not.toBe(ko.views.guide.hubTitle);
    });
});
