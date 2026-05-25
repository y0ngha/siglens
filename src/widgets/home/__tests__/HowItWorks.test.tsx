import { render, screen } from '@testing-library/react';
import type { SkillCounts } from '@y0ngha/siglens-core';

import { HowItWorks } from '../HowItWorks';

const SKILL_COUNTS: SkillCounts = {
    indicators: 25,
    candlesticks: 18,
    patterns: 12,
    strategies: 8,
    supportResistance: 5,
    fundamental: 3,
    news: 2,
};

describe('HowItWorks', () => {
    it('renders three steps', () => {
        render(<HowItWorks skillCounts={SKILL_COUNTS} />);

        expect(screen.getByText('01')).toBeInTheDocument();
        expect(screen.getByText('02')).toBeInTheDocument();
        expect(screen.getByText('03')).toBeInTheDocument();
    });

    it('renders the section heading', () => {
        render(<HowItWorks skillCounts={SKILL_COUNTS} />);

        expect(
            screen.getByRole('heading', { name: /이용 방법/ })
        ).toBeInTheDocument();
    });

    it('interpolates skill counts in step 2 description', () => {
        render(<HowItWorks skillCounts={SKILL_COUNTS} />);

        expect(
            screen.getByText(
                new RegExp(`보조지표 ${SKILL_COUNTS.indicators}종`)
            )
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                new RegExp(`캔들 패턴 ${SKILL_COUNTS.candlesticks}종`)
            )
        ).toBeInTheDocument();
    });

    it('renders step titles', () => {
        render(<HowItWorks skillCounts={SKILL_COUNTS} />);

        expect(
            screen.getByRole('heading', { name: /종목 입력/ })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: /자동 분석/ })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: /AI 리포트/ })
        ).toBeInTheDocument();
    });
});
