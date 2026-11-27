import { fireEvent, render, screen } from '@testing-library/react';
import {
    PRICE_LEVEL_BASE_RATE,
    type ClusteredKeyLevels,
    type Timeframe,
} from '@y0ngha/siglens-core';
import { KeyLevelsSection } from '@/widgets/analysis/sections/KeyLevelsSection';

const KEY_LEVELS: ClusteredKeyLevels = {
    support: [
        {
            price: 100,
            reason: '이동평균',
            count: 3,
            sources: [
                { price: 100, reason: '이동평균' },
                { price: 100.2, reason: '피보나치' },
                { price: 99.9, reason: '피벗' },
            ],
        },
    ],
    resistance: [],
};

function renderSection(timeframe: Timeframe) {
    render(
        <KeyLevelsSection
            keyLevels={KEY_LEVELS}
            symbol="AAPL"
            krxTickTable="share"
            timeframe={timeframe}
        />
    );
    // 섹션 제목 옆 ⓘ 버튼(첫 번째)이 제목 설명 툴팁이다.
    fireEvent.click(screen.getAllByRole('button', { name: '추가 정보' })[0]);
}

describe('KeyLevelsSection header tooltip', () => {
    it('states the measured held rate against the same-distance placebo on daily bars', () => {
        renderSection('1Day');
        const held = (PRICE_LEVEL_BASE_RATE.eventShare * 100).toFixed(1);
        const placebo = (PRICE_LEVEL_BASE_RATE.placeboShare * 100).toFixed(1);
        expect(
            screen.getByText(
                new RegExp(
                    `지켜진 비율은 ${held}%였어요. 같은 거리의 다른 날 가격은 ${placebo}%였어요`
                )
            )
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                new RegExp(
                    `${PRICE_LEVEL_BASE_RATE.scope.symbols}종목의 ${PRICE_LEVEL_BASE_RATE.scope.from.slice(0, 4)}~${PRICE_LEVEL_BASE_RATE.scope.to.slice(0, 4)}년 일봉`
                )
            )
        ).toBeInTheDocument();
    });

    it('keeps the convergence fact and makes no claim that more references hold better', () => {
        renderSection('1Day');
        expect(
            screen.getByText(
                '가까운 가격대에 여러 지표가 함께 모인 레벨이에요.'
            )
        ).toBeInTheDocument();
        expect(screen.queryByText(/신뢰도가 높다고/)).not.toBeInTheDocument();
    });

    it('says it was not measured on a non-daily chart instead of reusing daily numbers', () => {
        renderSection('1Hour');
        expect(
            screen.getByText('일봉이 아닌 차트에서는 아직 측정하지 못했어요.')
        ).toBeInTheDocument();
        expect(screen.queryByText(/지켜진 비율/)).not.toBeInTheDocument();
    });
});
