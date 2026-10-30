import { beforeAll, describe, expect, it } from 'vitest';
import { getFormatter, getTranslations } from 'next-intl/server';
import type { DemoBar, DemoPane, GuideDemo } from '@/views/guide/demos/types';
import {
    describeDemo,
    type DemoDescriptionTranslator,
    type DemoListFormatter,
} from '@/views/guide/lib/demoDescription';

const bars = (count: number): DemoBar[] =>
    Array.from({ length: count }, (_, i) => ({
        time: i,
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume: 1,
    }));

const pane = (label: string): DemoPane => ({ label, lines: [] });

describe('describeDemo', () => {
    describe('ko 카탈로그', () => {
        let t: DemoDescriptionTranslator;
        let format: DemoListFormatter;
        beforeAll(async () => {
            t = await getTranslations({
                locale: 'ko',
                namespace: 'views.guide',
            });
            format = await getFormatter({ locale: 'ko' });
        });

        it('보조 패널이 없으면 봉 수만 적는다', () => {
            const demo: GuideDemo = { bars: bars(7) };
            expect(describeDemo(demo, t, format)).toBe('7개 봉 예시 차트');
        });

        it('보조 패널 이름을 로케일 목록 형식으로 잇는다', () => {
            const demo: GuideDemo = {
                bars: bars(12),
                panes: [pane('RSI 14'), pane('MACD'), pane('거래량')],
            };
            expect(describeDemo(demo, t, format)).toBe(
                '12개 봉 예시 차트 (보조 패널: RSI 14, MACD 및 거래량)'
            );
        });
    });

    describe('en 카탈로그', () => {
        let t: DemoDescriptionTranslator;
        let format: DemoListFormatter;
        beforeAll(async () => {
            t = await getTranslations({
                locale: 'en',
                namespace: 'views.guide',
            });
            format = await getFormatter({ locale: 'en' });
        });

        it('봉 수를 복수형 규칙으로 적는다', () => {
            expect(describeDemo({ bars: bars(1) }, t, format)).toBe(
                'Example chart of 1 candlestick'
            );
        });

        it('패널 둘은 영어 목록 형식(and)으로 잇는다', () => {
            const demo: GuideDemo = {
                bars: bars(30),
                panes: [pane('RSI 14'), pane('MACD')],
            };
            expect(describeDemo(demo, t, format)).toBe(
                'Example chart of 30 candlesticks (indicator panes: RSI 14 and MACD)'
            );
        });
    });
});
