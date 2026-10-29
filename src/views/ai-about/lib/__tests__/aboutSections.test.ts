import { getTranslations } from 'next-intl/server';
import { beforeAll, describe, expect, it } from 'vitest';
import ko from '../../../../../messages/ko.json';
import type { AboutT } from '../aboutContent';
import {
    buildDataTiles,
    buildExampleChips,
    buildMoreLinks,
    buildPainPoints,
} from '../aboutSections';

const copy = ko.views['ai-about'];
let t: AboutT;
beforeAll(async () => {
    t = await getTranslations({ locale: 'ko', namespace: 'views.ai-about' });
});

describe('buildPainPoints', () => {
    it('pairs each complaint with its own fix, in display order', () => {
        expect(buildPainPoints(t)).toEqual([
            { was: copy.pain.stale, now: copy.pain.staleFix },
            { was: copy.pain.madeUp, now: copy.pain.madeUpFix },
            { was: copy.pain.rumor, now: copy.pain.rumorFix },
            { was: copy.pain.jargon, now: copy.pain.jargonFix },
            { was: copy.pain.chartOnly, now: copy.pain.chartOnlyFix },
        ]);
    });
});

describe('buildDataTiles', () => {
    it('lists the eight data sources in display order', () => {
        expect(buildDataTiles(t).map(tile => tile.id)).toEqual([
            'quote',
            'chart',
            'analysis',
            'news',
            'options',
            'company',
            'market',
            'portfolio',
        ]);
    });

    it('keeps each tile title with its own body and scope', () => {
        expect(buildDataTiles(t).find(tile => tile.id === 'options')).toEqual({
            id: 'options',
            title: copy.data.options,
            body: copy.data.optionsBody,
            scope: copy.data.optionsScope,
        });
    });
});

describe('buildExampleChips', () => {
    it('shows the two lookups and the as-of time', () => {
        expect(buildExampleChips(t)).toEqual([
            copy.tool.quote,
            copy.tool.bars,
            copy.data.exampleAsOf,
        ]);
    });
});

describe('buildMoreLinks', () => {
    it('points every link at the siglens.io origin without a prefix for the default locale', () => {
        expect(
            buildMoreLinks(t, 'https://siglens.io', '').map(link => link.href)
        ).toEqual([
            'https://siglens.io/market',
            'https://siglens.io/market/kr',
            'https://siglens.io/fear-greed',
            'https://siglens.io/fear-greed/crypto',
            'https://siglens.io/news',
            'https://siglens.io/about',
        ]);
    });

    it('carries the locale prefix and keeps each label on its own path', () => {
        expect(buildMoreLinks(t, 'https://siglens.io', '/ja')[1]).toEqual({
            href: 'https://siglens.io/ja/market/kr',
            label: copy.more.marketKr,
        });
    });
});
