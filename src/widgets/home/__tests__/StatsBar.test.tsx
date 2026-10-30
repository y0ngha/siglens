vi.mock('@/shared/ui/DotSeparator', () => ({
    DotSeparator: () => <span aria-hidden="true">·</span>,
}));
vi.mock('@/shared/lib/skillStats', () => ({
    buildSkillStats: () => [
        { key: 'indicator_guide', value: 25 },
        { key: 'candlestick', value: 18 },
    ],
}));

import { render, screen } from '@testing-library/react';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';

import { StatsBar } from '../StatsBar';

const EMPTY_COUNTS = {
    indicators: 0,
    candlesticks: 0,
    patterns: 0,
    strategies: 0,
    supportResistance: 0,
    fundamental: 0,
    news: 0,
};

describe('StatsBar', () => {
    it('renders stats from buildSkillStats via the shared.lib.skillStats.count catalog', () => {
        render(<StatsBar counts={EMPTY_COUNTS} />);

        expect(screen.getByText('25종 보조지표')).toBeInTheDocument();
        expect(screen.getByText('18개 캔들 패턴')).toBeInTheDocument();
    });

    it('renders an accessible list', () => {
        render(<StatsBar counts={EMPTY_COUNTS} />);

        expect(
            screen.getByRole('list', { name: /시그렌즈 분석 규모/ })
        ).toBeInTheDocument();
    });

    it('list 역할을 명시하고 통계 수만큼만 listitem을 갖는다(구분자는 항목 수에 포함되지 않는다)', () => {
        render(<StatsBar counts={EMPTY_COUNTS} />);

        const list = screen.getByRole('list');
        expect(list).toHaveAttribute('role', 'list');
        expect(screen.getAllByRole('listitem', { hidden: true })).toHaveLength(
            2
        );
        expect(list.querySelectorAll('li')).toHaveLength(2);
    });

    it('구분자는 첫 항목을 제외한 각 항목 안에 있고 장식으로 숨겨진다', () => {
        render(<StatsBar counts={EMPTY_COUNTS} />);

        const [first, second] = screen.getAllByRole('listitem');
        expect(first!.querySelector('[aria-hidden="true"]')).toBeNull();
        expect(second!.querySelector('[aria-hidden="true"]')).not.toBeNull();
    });

    // 회귀 가드: `stat.value}{stat.label}` 수동 결합이 돌아오면 `/en` 홈이
    // "25개 분석 스킬" 같은 한국어 카운트 문구를 다시 찍는다.
    it('locale=en에서는 한글이 섞이지 않는다', () => {
        renderWithIntl(<StatsBar counts={EMPTY_COUNTS} />, { locale: 'en' });

        expect(screen.queryByText(/[가-힣]/)).not.toBeInTheDocument();
    });
});
