import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnalystActions } from '@/widgets/news/sections/AnalystActions';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import type { GradesEvent } from '@y0ngha/siglens-core';
import {
    fromAnalystAction,
    fromGradesEvent,
} from '@/widgets/news/utils/analystActionItems';

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
        render(<AnalystActions items={[]} />);
        expect(
            screen.getByText(/최근 애널리스트 등급 변경이 없습니다/)
        ).toBeInTheDocument();
    });

    it('renders heading', () => {
        render(<AnalystActions items={EVENTS.map(fromGradesEvent)} />);
        expect(
            screen.getByRole('heading', { name: '애널리스트 등급·목표가 변경' })
        ).toBeInTheDocument();
    });

    it('renders grade events with company names', () => {
        render(<AnalystActions items={EVENTS.map(fromGradesEvent)} />);
        expect(screen.getByText('Goldman Sachs')).toBeInTheDocument();
        expect(screen.getByText('Morgan Stanley')).toBeInTheDocument();
        expect(screen.getByText('JP Morgan')).toBeInTheDocument();
    });

    it('renders action labels', () => {
        render(<AnalystActions items={EVENTS.map(fromGradesEvent)} />);
        expect(screen.getByText('상향')).toBeInTheDocument();
        expect(screen.getByText('하향')).toBeInTheDocument();
        expect(screen.getByText('신규 커버리지')).toBeInTheDocument();
    });

    it('renders grade transition for upgrade/downgrade', () => {
        render(<AnalystActions items={EVENTS.map(fromGradesEvent)} />);
        expect(screen.getByText('Neutral')).toBeInTheDocument();
        expect(screen.getByText('Buy')).toBeInTheDocument();
    });

    it('renders only new grade for initiated coverage', () => {
        render(<AnalystActions items={EVENTS.map(fromGradesEvent)} />);
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

        render(<AnalystActions items={manyEvents.map(fromGradesEvent)} />);
        expect(screen.getByText(/더보기/)).toBeInTheDocument();
        expect(screen.getByText(/3개 남음/)).toBeInTheDocument();
    });

    // 회귀 가드: 등급 변경일 포맷터가 `'ko-KR'` 고정으로 돌아오면 `/en/AAPL/news`가
    // "2026년 8월 10일" 같은 한국어 날짜를 영어 문장 옆에 다시 박는다.
    it('locale=en에서는 등급 변경일에 한글이 섞이지 않는다', () => {
        const { container } = renderWithIntl(
            <AnalystActions items={EVENTS.map(fromGradesEvent)} />,
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
            <AnalystActions items={EVENTS.map(fromGradesEvent)} />,
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

        render(<AnalystActions items={manyEvents.map(fromGradesEvent)} />);
        await user.click(screen.getByText(/더보기/));
        expect(screen.queryByText(/더보기/)).not.toBeInTheDocument();
    });

    it('유지·기타 액션 배지는 AA 대비를 만족하는 중립 토큰(-300)을 쓴다', () => {
        render(
            <AnalystActions
                items={[
                    { ...EVENTS[0]!, action: 'maintained' as const },
                    { ...EVENTS[1]!, action: 'other' as const },
                ].map(fromGradesEvent)}
            />
        );
        const badges = [
            screen.getByText('등급 유지'),
            screen.getByText('기타'),
        ];
        badges.forEach(badge => {
            expect(badge).toHaveClass('text-secondary-300');
            expect(badge).not.toHaveClass('text-secondary-400');
        });
    });

    it('FMP가 같은 날 같은 등급 행을 반복해도 중복 키 없이 모두 렌더한다', () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const duplicate: GradesEvent = { ...EVENTS[0]! };

        render(
            <AnalystActions
                items={[duplicate, { ...duplicate }].map(fromGradesEvent)}
            />
        );

        expect(screen.getAllByText('Goldman Sachs')).toHaveLength(2);
        const keyWarnings = errorSpy.mock.calls.filter(call =>
            String(call[0]).includes('same key')
        );
        expect(keyWarnings).toHaveLength(0);
        errorSpy.mockRestore();
    });
    describe('목표가 변화(Yahoo 이력)', () => {
        const row = (
            over: Partial<Parameters<typeof fromAnalystAction>[0]> = {}
        ) =>
            fromAnalystAction({
                date: '2026-11-10',
                firm: 'Morgan Stanley',
                action: 'maintain',
                fromGrade: 'Overweight',
                toGrade: 'Overweight',
                priorTarget: 150,
                target: 175,
                targetAction: 'raise',
                ...over,
            })!;

        it('이전 → 새 목표가를 보여 주고, 같은 등급은 "A → A"로 쓰지 않는다', () => {
            render(<AnalystActions items={[row()]} />);
            const line = screen.getByText('$175.00').closest('p');
            expect(line).toHaveTextContent('목표가 $150.00 → 에서 $175.00');
            expect(screen.getByText('$175.00')).toHaveClass(
                'text-ui-success-text'
            );
            expect(screen.queryByText(/Overweight →/)).not.toBeInTheDocument();
        });

        it('하향은 위험색, 이전 목표가가 없으면 새 목표가만', () => {
            render(
                <AnalystActions
                    items={[
                        row({
                            priorTarget: 200,
                            target: 160,
                            targetAction: 'lower',
                        }),
                        row({
                            firm: 'UBS',
                            action: 'initiate',
                            fromGrade: null,
                            toGrade: 'Buy',
                            priorTarget: null,
                            target: 210,
                            targetAction: 'announce',
                        }),
                    ]}
                />
            );
            expect(screen.getByText('$160.00')).toHaveClass(
                'text-ui-danger-text'
            );
            const ubs = screen.getByText('UBS').closest('li');
            expect(ubs).toHaveTextContent('목표가 $210.00');
            expect(ubs).not.toHaveTextContent('→');
        });

        it('등급 이벤트(목표가 없음) 행에는 목표가 줄이 없다', () => {
            render(<AnalystActions items={EVENTS.map(fromGradesEvent)} />);
            for (const li of screen.getAllByRole('listitem'))
                expect(li).not.toHaveTextContent('목표가');
        });
    });
});
