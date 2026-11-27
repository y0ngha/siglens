import { fireEvent, screen } from '@testing-library/react';
import type { CycleReading, StrategyResult } from '@y0ngha/siglens-core';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { StrategyAccordionItem } from '@/widgets/analysis/ui/StrategyAccordionItem';

const CYCLE: CycleReading = {
    kind: 'macd_cycle',
    stage: 4,
    previousStage: 3,
    barsInStage: 12,
    progression: 'forward',
    stageChanges: 2,
    values: { upper: -1.2, middle: -2.5, lower: -1.3 },
    slopes: { ema9: 'falling', ema21: 'falling', ema60: 'flat' },
};

const strategy = (over: Partial<StrategyResult> = {}): StrategyResult => ({
    id: 'strategy-1',
    strategyName: 'MACD 대순환 분석',
    trend: 'bearish',
    summary: 'MACD cycle: stage 4 (English canonical line).',
    confidenceWeight: 0.55,
    cycle: CYCLE,
    ...over,
});

const open = () =>
    fireEvent.click(screen.getByRole('button', { name: /MACD/ }));

describe('StrategyAccordionItem', () => {
    it('대순환 카드는 영어 정본 대신 구조화된 읽기를 독자 언어로 보여 준다', () => {
        renderWithIntl(
            <StrategyAccordionItem strategy={strategy()} showConfidence />
        );
        open();

        expect(
            screen.getByText('MACD 대순환 4단계 (안정 하락기)')
        ).toBeInTheDocument();
        expect(
            screen.getByText('3단계에서 순서대로 넘어왔어요')
        ).toBeInTheDocument();
        expect(
            screen.getByText('이 단계가 12봉째 이어지고 있어요')
        ).toBeInTheDocument();
        expect(screen.queryByText(/English canonical line/)).toBeNull();
    });

    it('en 로케일에서는 영어로 푼다', () => {
        renderWithIntl(
            <StrategyAccordionItem strategy={strategy()} showConfidence />,
            { locale: 'en' }
        );
        open();

        expect(
            screen.getByText('MACD cycle, stage 4 (stable downtrend)')
        ).toBeInTheDocument();
    });

    it('cycle이 없는 전략은 저장된 요약을 그대로 보여 준다', () => {
        renderWithIntl(
            <StrategyAccordionItem
                strategy={strategy({
                    cycle: undefined,
                    summary: '옛 캐시에 저장된 요약',
                })}
                showConfidence
            />
        );
        open();

        expect(screen.getByText('옛 캐시에 저장된 요약')).toBeInTheDocument();
    });

    it('표에 없는 종류의 cycle도 저장된 요약으로 물러난다', () => {
        renderWithIntl(
            <StrategyAccordionItem
                strategy={strategy({
                    // safe: core가 새 종류를 늘렸는데 이 앱이 아직 못 따라간 상황을 흉내 낸다.
                    cycle: { ...CYCLE, kind: 'future_cycle' } as never,
                    summary: 'English canonical line',
                })}
                showConfidence
            />
        );
        open();

        expect(screen.getByText('English canonical line')).toBeInTheDocument();
    });
});
