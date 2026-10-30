import { render, screen } from '@testing-library/react';
import type { CalendarImpact } from '@y0ngha/siglens-core';
import type { KstEvent } from '@/widgets/economy/model/calendarTypes';
import { MonthCell } from '@/widgets/economy/sections/calendar/MonthCell';

const ALL_ON = new Set<CalendarImpact>(['High', 'Medium', 'Low']);

const highEvent = {
    iso: '2026-06-01T12:30:00Z',
    kstTimeLabel: '오후 9:30',
    inlineTimeLabel: '9:30',
    original: { event: 'CPI', impact: 'High', actual: null },
} as unknown as KstEvent;

function renderCell(cell: Parameters<typeof MonthCell>[0]['cell']) {
    return render(
        <table>
            <tbody>
                <tr>
                    <MonthCell
                        cell={cell}
                        selectedDateKey=""
                        todayKey="2026-06-02"
                        activeImpacts={ALL_ON}
                        onSelect={vi.fn()}
                        labels={{}}
                    />
                </tr>
            </tbody>
        </table>
    );
}

describe('MonthCell', () => {
    it('그 달 밖 패딩 칸은 내용 없이 숨긴다', () => {
        const { container } = renderCell(null);
        const td = container.querySelector('td');
        expect(td).toHaveAttribute('aria-hidden', 'true');
        expect(td).toBeEmptyDOMElement();
    });

    it('이벤트 없는 날은 버튼 없이 날짜만 그린다', () => {
        renderCell({ dateKey: '2026-06-01', day: 1, group: null });
        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.getByText('1')).toBeInTheDocument();
    });

    describe('이벤트 있는 날', () => {
        it('선택 버튼이 중요도까지 담은 한 문장으로 읽힌다', () => {
            renderCell({
                dateKey: '2026-06-01',
                day: 1,
                group: {
                    dateKey: '2026-06-01',
                    dayOfWeek: 1,
                    year: 2026,
                    month: 5,
                    day: 1,
                    events: [highEvent],
                },
            });
            expect(screen.getByRole('button')).toHaveAccessibleName(
                /^6월 1일, 이벤트 1건, 중요도 /
            );
        });
    });
});
