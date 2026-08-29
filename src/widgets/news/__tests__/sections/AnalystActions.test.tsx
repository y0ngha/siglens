import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnalystActions } from '@/widgets/news/sections/AnalystActions';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import type { GradesEvent } from '@y0ngha/siglens-core';

vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

const EVENTS: GradesEvent[] = [
    {
        symbol: 'AAPL',
        date: '2025-01-15',
        action: 'upgrade' as const,
        gradingCompany: 'Goldman Sachs',
        previousGrade: 'Neutral',
        newGrade: 'Buy',
    },
    {
        symbol: 'AAPL',
        date: '2025-01-10',
        action: 'downgrade' as const,
        gradingCompany: 'Morgan Stanley',
        previousGrade: 'Overweight',
        newGrade: 'Equal-weight',
    },
    {
        symbol: 'AAPL',
        date: '2025-01-05',
        action: 'initiated' as const,
        gradingCompany: 'JP Morgan',
        previousGrade: null,
        newGrade: 'Overweight',
    },
];

describe('AnalystActions', () => {
    it('renders empty state when no events', () => {
        render(<AnalystActions events={[]} />);
        expect(
            screen.getByText(/최근 애널리스트 등급 변경이 없습니다/)
        ).toBeInTheDocument();
    });

    it('renders heading', () => {
        render(<AnalystActions events={EVENTS} />);
        expect(
            screen.getByRole('heading', { name: /애널리스트 등급 변경/ })
        ).toBeInTheDocument();
    });

    it('renders grade events with company names', () => {
        render(<AnalystActions events={EVENTS} />);
        expect(screen.getByText('Goldman Sachs')).toBeInTheDocument();
        expect(screen.getByText('Morgan Stanley')).toBeInTheDocument();
        expect(screen.getByText('JP Morgan')).toBeInTheDocument();
    });

    it('renders action labels', () => {
        render(<AnalystActions events={EVENTS} />);
        expect(screen.getByText('상향')).toBeInTheDocument();
        expect(screen.getByText('하향')).toBeInTheDocument();
        expect(screen.getByText('신규 커버리지')).toBeInTheDocument();
    });

    it('renders grade transition for upgrade/downgrade', () => {
        render(<AnalystActions events={EVENTS} />);
        expect(screen.getByText('Neutral')).toBeInTheDocument();
        expect(screen.getByText('Buy')).toBeInTheDocument();
    });

    it('renders only new grade for initiated coverage', () => {
        render(<AnalystActions events={EVENTS} />);
        const allOverweight = screen.getAllByText('Overweight');
        expect(allOverweight.length).toBeGreaterThanOrEqual(1);
    });

    it('paginates and shows more button', () => {
        const manyEvents: GradesEvent[] = Array.from({ length: 8 }, (_, i) => ({
            symbol: 'AAPL',
            date: `2025-01-${String(i + 1).padStart(2, '0')}`,
            action: 'maintained' as const,
            gradingCompany: `Firm ${i}`,
            previousGrade: 'Hold',
            newGrade: 'Hold',
        }));

        render(<AnalystActions events={manyEvents} />);
        expect(screen.getByText(/더보기/)).toBeInTheDocument();
        expect(screen.getByText(/3개 남음/)).toBeInTheDocument();
    });

    // 회귀 가드: 등급 변경일 포맷터가 `'ko-KR'` 고정으로 돌아오면 `/en/AAPL/news`가
    // "2026년 8월 10일" 같은 한국어 날짜를 영어 문장 옆에 다시 박는다.
    it('locale=en에서는 등급 변경일에 한글이 섞이지 않는다', () => {
        const { container } = renderWithIntl(
            <AnalystActions events={EVENTS} />,
            { locale: 'en' }
        );
        const dates = container.querySelectorAll('time');
        expect(dates.length).toBeGreaterThan(0);
        dates.forEach(time => {
            expect(time.textContent ?? '').not.toMatch(/[가-힣]/);
        });
    });

    // audit fix item 1: ACTION_LABEL이 GradesAction → 한글 리터럴 맵이라
    // `/en/AAPL/news`의 등급 변경 행이 `Jefferies Hold → changed to
    // Underperform`(영문) 옆에서 `하향`을 그대로 찍었다. 이제
    // shared.enumLabel.gradesAction 카탈로그를 거친다.
    it('locale=en에서는 등급 변경 라벨이 번역되고 한글이 남지 않는다', () => {
        const { container } = renderWithIntl(
            <AnalystActions events={EVENTS} />,
            { locale: 'en' }
        );
        expect(screen.getByText('Upgrade')).toBeInTheDocument();
        expect(screen.getByText('Downgrade')).toBeInTheDocument();
        expect(screen.getByText('New Coverage')).toBeInTheDocument();
        expect(container.textContent ?? '').not.toMatch(/[가-힣]/);
    });

    it('loads more events on button click', async () => {
        const user = userEvent.setup();
        const manyEvents: GradesEvent[] = Array.from({ length: 8 }, (_, i) => ({
            symbol: 'AAPL',
            date: `2025-01-${String(i + 1).padStart(2, '0')}`,
            action: 'maintained' as const,
            gradingCompany: `Firm ${i}`,
            previousGrade: 'Hold',
            newGrade: 'Hold',
        }));

        render(<AnalystActions events={manyEvents} />);
        await user.click(screen.getByText(/더보기/));
        expect(screen.queryByText(/더보기/)).not.toBeInTheDocument();
    });
});
