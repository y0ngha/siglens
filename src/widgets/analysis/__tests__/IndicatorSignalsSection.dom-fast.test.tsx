import { screen } from '@testing-library/react';
import type {
    IndicatorGuideResult,
    IndicatorReading,
} from '@y0ngha/siglens-core';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { IndicatorSignalsSection } from '@/widgets/analysis/sections/IndicatorSignalsSection';

const RSI_READING: IndicatorReading = {
    kind: 'rsi',
    basis: 'event',
    state: 'rsi_oversold',
    values: { rsi: 28.4 },
    signals: [{ type: 'rsi_oversold', phase: 'confirmed', barsAgo: 0 }],
};

const card = (
    over: Partial<IndicatorGuideResult['signals'][number]> = {}
): IndicatorGuideResult => ({
    indicatorName: 'RSI Signal Guide',
    signals: [
        {
            type: 'skill',
            trend: 'bullish',
            strength: 'strong',
            description: 'RSI is oversold at 28.4 (English canonical line).',
            reading: RSI_READING,
            ...over,
        },
    ],
});

describe('IndicatorSignalsSection', () => {
    it('코드로 만든 카드는 영어 정본 대신 독자 언어로 푼 읽기를 보여 준다', () => {
        renderWithIntl(<IndicatorSignalsSection indicatorResults={[card()]} />);

        expect(
            screen.getByText('RSI 과매도 (현재 RSI 28.4)')
        ).toBeInTheDocument();
        expect(screen.queryByText(/English canonical line/)).toBeNull();
    });

    it.each([
        ['en', 'RSI oversold (current RSI 28.4)'],
        ['ja', 'RSI 売られすぎ（現在のRSI 28.4）'],
        ['zh', 'RSI 超卖（当前RSI 28.4）'],
    ] as const)('%s 로케일에서는 그 언어로 푼다', (locale, expected) => {
        renderWithIntl(
            <IndicatorSignalsSection indicatorResults={[card()]} />,
            {
                locale,
            }
        );

        expect(screen.getByText(expected)).toBeInTheDocument();
    });

    it('강도 배지는 core가 강도를 실은 카드에만 나온다', () => {
        renderWithIntl(
            <IndicatorSignalsSection
                indicatorResults={[
                    card(),
                    card({ strength: undefined, description: 'no badge' }),
                ]}
            />
        );

        expect(screen.getAllByText('강한 시그널')).toHaveLength(1);
    });

    it('읽기가 없는 카드(옛 캐시, 모델이 쓴 카드)는 description을 그대로 보여 준다', () => {
        renderWithIntl(
            <IndicatorSignalsSection
                indicatorResults={[
                    card({
                        reading: undefined,
                        description: '모델이 쓴 한국어 설명',
                    }),
                ]}
            />
        );

        expect(screen.getByText('모델이 쓴 한국어 설명')).toBeInTheDocument();
    });

    it('표에 없는 종류의 읽기는 description으로 물러난다', () => {
        renderWithIntl(
            <IndicatorSignalsSection
                indicatorResults={[
                    card({
                        // safe: core가 새 종류를 늘렸는데 이 앱이 아직 못 따라간 상황을 흉내 낸다.
                        reading: { ...RSI_READING, kind: 'future' } as never,
                        description: 'English canonical line',
                    }),
                ]}
            />
        );

        expect(screen.getByText('English canonical line')).toBeInTheDocument();
    });

    it('표시할 지표가 없으면 아무것도 그리지 않는다', () => {
        const { container } = renderWithIntl(
            <IndicatorSignalsSection indicatorResults={[]} />
        );
        expect(container).toBeEmptyDOMElement();
    });
});
