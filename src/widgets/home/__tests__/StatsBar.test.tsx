vi.mock('@/shared/ui/DotSeparator', () => ({
    DotSeparator: () => <span aria-hidden="true">·</span>,
}));
vi.mock('@/shared/lib/skillStats', () => ({
    buildSkillStats: () => [
        { key: 'indicator_guide', value: 25 },
        { key: 'candlestick', value: 18 },
    ],
}));

import React from 'react';
import { render, screen } from '@testing-library/react';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';

import { StatsBar, StatsBarSkeleton } from '../StatsBar';

describe('StatsBar', () => {
    it('renders stats from buildSkillStats via the shared.lib.skillStats.count catalog', () => {
        render(<StatsBar skills={[]} />);

        expect(screen.getByText('25종 보조지표')).toBeInTheDocument();
        expect(screen.getByText('18개 캔들 패턴')).toBeInTheDocument();
    });

    it('renders an accessible list', () => {
        render(<StatsBar skills={[]} />);

        expect(
            screen.getByRole('list', { name: /Siglens 분석 규모/ })
        ).toBeInTheDocument();
    });

    // 회귀 가드: `stat.value}{stat.label}` 수동 결합이 돌아오면 `/en` 홈이
    // "25개 분석 스킬" 같은 한국어 카운트 문구를 다시 찍는다.
    it('locale=en에서는 한글이 섞이지 않는다', () => {
        renderWithIntl(<StatsBar skills={[]} />, { locale: 'en' });

        expect(screen.queryByText(/[가-힣]/)).not.toBeInTheDocument();
    });
});

describe('StatsBarSkeleton', () => {
    it('renders skeleton bars with aria-hidden', () => {
        const { container } = render(<StatsBarSkeleton />);

        expect(container.firstElementChild).toHaveAttribute(
            'aria-hidden',
            'true'
        );
    });
});
