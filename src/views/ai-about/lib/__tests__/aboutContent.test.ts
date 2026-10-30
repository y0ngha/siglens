import { getTranslations } from 'next-intl/server';
import { beforeAll, describe, expect, expectTypeOf, it } from 'vitest';
import { GUEST_TURNS_PER_DAY } from '@/widgets/agent-chat/utils/guestTurnLimit';
import ko from '../../../../../messages/ko.json';
import type { Locale } from '@/shared/i18n/locales';
import {
    buildScenarios,
    getAboutFaq,
    getAboutSeoCopy,
    type AboutT,
    type AnswerRaws,
} from '../aboutContent';

const aboutTranslator = (locale: Locale): Promise<AboutT> =>
    getTranslations({ locale, namespace: 'views.ai-about' });

let translators: Record<Locale, AboutT>;
beforeAll(async () => {
    translators = {
        ko: await aboutTranslator('ko'),
        en: await aboutTranslator('en'),
        ja: await aboutTranslator('ja'),
        zh: await aboutTranslator('zh'),
    };
});

describe('getAboutSeoCopy', () => {
    it('resolves the seo copy from the ko catalog', async () => {
        const copy = await getAboutSeoCopy('ko');
        expect(copy.title.length).toBeGreaterThan(0);
        expect(copy.description.length).toBeGreaterThan(0);
        expect(copy.ogLabel.length).toBeGreaterThan(0);
        expect(copy).toEqual({
            title: ko.views['ai-about'].seo.title,
            description: ko.views['ai-about'].seo.description,
            ogLabel: ko.views['ai-about'].seo.ogLabel,
        });
    });
});

describe('getAboutFaq', () => {
    it('returns 8 items, with the price answer carrying the guest turn count', async () => {
        const faq = await getAboutFaq('ko');
        expect(faq).toHaveLength(8);
        const price = faq.find(
            f => f.question === ko.views['ai-about'].faq.priceQ
        );
        expect(price?.answer).toContain(String(GUEST_TURNS_PER_DAY));
        expect(price?.answer).not.toContain('{guest}');
    });
});

describe('buildScenarios', () => {
    it('builds 5 scenarios with unique ids and parsed, markup-free lines', async () => {
        const t = await getTranslations({
            locale: 'ko',
            namespace: 'views.ai-about',
        });
        const scenarios = buildScenarios(t, 'ko');

        expect(scenarios).toHaveLength(5);
        expect(new Set(scenarios.map(s => s.id)).size).toBe(5);

        for (const scenario of scenarios) {
            for (const line of scenario.lines) {
                expect(line.segments.length).toBeGreaterThan(0);
                for (const segment of line.segments)
                    expect(segment.text).not.toMatch(/<\/?(b|up|down)>/);
            }

            for (const tool of scenario.tools)
                expect(tool.pendingLabel).toContain(tool.label);

            for (const tool of scenario.tools)
                expect(scenario.summary).toContain(tool.label);

            expect(scenario.asOf.startsWith('기준')).toBe(true);
        }
    });
});

describe('buildScenarios summary', () => {
    it.each([
        ['ko', '종목 검색, 시세, 차트와 지표 및 시그렌즈 분석 확인, 3.0초'],
        [
            'en',
            'Checked Ticker search, Quote, Charts & indicators, and SIGLENS analysis in 3.0s',
        ],
        ['ja', '銘柄検索、株価、チャートと指標、SIGLENS分析を確認（3.0秒）'],
        ['zh', '已查看股票搜索、行情、图表与指标和SIGLENS 分析，用时3.0秒'],
    ] as const)(
        'joins the tool labels with the %s list separators',
        (locale, summary) => {
            const [samsung] = buildScenarios(translators[locale], locale);
            expect(samsung?.summary).toBe(summary);
        }
    );

    it('joins two tool labels with the conjunction alone', () => {
        const nvdaPro = buildScenarios(translators.ko, 'ko').find(
            s => s.id === 'nvdaPro'
        );
        expect(nvdaPro?.summary).toBe('시세 및 옵션 확인, 1.8초');
    });
});

describe('buildScenarios answer lines', () => {
    it('reads each answer as a lead paragraph, three bullets and a closing paragraph', () => {
        for (const scenario of buildScenarios(translators.ko, 'ko'))
            expect(scenario.lines.map(line => line.kind)).toEqual([
                'p',
                'li',
                'li',
                'li',
                'p',
            ]);
    });

    it('types the raw answers as exactly five values (type-level check)', () => {
        // Checked by `tsc`, not at runtime: `expectTypeOf` is a no-op when the
        // test runs, and each `@ts-expect-error` fails the type check the moment
        // a four- or six-value answer becomes assignable.
        expectTypeOf<AnswerRaws['length']>().toEqualTypeOf<5>();
        // @ts-expect-error one value short of the five answer lines
        const four: AnswerRaws = ['a', 'b', 'c', 'd'];
        // @ts-expect-error one value past the five answer lines
        const six: AnswerRaws = ['a', 'b', 'c', 'd', 'e', 'f'];
        expectTypeOf(four).toEqualTypeOf<AnswerRaws>();
        expectTypeOf(six).toEqualTypeOf<AnswerRaws>();
    });
});
