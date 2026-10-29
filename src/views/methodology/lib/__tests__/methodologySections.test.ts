import { createTranslator } from 'next-intl';
import ko from '../../../../../messages/ko.json';
import {
    METHODOLOGY_SECTION_IDS,
    methodologySectionTitles,
} from '../methodologySections';
import type { MethodologyTranslator } from '../../types';

const t = createTranslator({
    locale: 'ko',
    messages: ko,
    namespace: 'views.methodology',
} as never) as unknown as MethodologyTranslator;

const m = ko.views.methodology;

describe('METHODOLOGY_SECTION_IDS', () => {
    /** 종목 페이지 출처 고지와 E2E가 거는 앵커라 순서와 철자를 고정한다. */
    it('keeps the stable anchor ids in table-of-contents order', () => {
        expect(METHODOLOGY_SECTION_IDS).toEqual([
            'overview',
            'data',
            'indicators',
            'fear-greed',
            'ai',
            'backtesting',
            'limits',
            'corrections',
            'changelog',
        ]);
    });
});

describe('methodologySectionTitles', () => {
    it('maps every section id to its catalog title', () => {
        expect(methodologySectionTitles(t)).toEqual({
            overview: m.overview.title,
            data: m.data.title,
            indicators: m.indicators.title,
            'fear-greed': m.fearGreed.title,
            ai: m.ai.title,
            backtesting: m.backtesting.title,
            limits: m.limits.title,
            corrections: m.corrections.title,
            changelog: m.changelog.title,
        });
    });
});
