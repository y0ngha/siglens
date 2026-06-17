import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { EconomicCalendarEvent } from '@y0ngha/siglens-core';

import { EconomicCalendar } from '@/widgets/economy/sections/EconomicCalendar';

const EVENT: EconomicCalendarEvent = {
    date: '2026-06-17 14:00:00',
    event: 'Fed Rate Decision',
    impact: 'High',
    actual: null,
    estimate: 3.63,
    previous: 3.63,
    unit: '%',
};

describe('EconomicCalendar', () => {
    it('이벤트 0건이면 안내 문구', () => {
        render(<EconomicCalendar events={[]} />);
        expect(
            screen.getByText('다가오는 미국 경제 발표 일정이 아직 없어요.')
        ).toBeInTheDocument();
    });

    it('이벤트 본문 표시 (제목 + 예상/이전치)', () => {
        render(<EconomicCalendar events={[EVENT]} />);
        expect(screen.getByText('Fed Rate Decision')).toBeInTheDocument();
        expect(screen.getByText(/예상 3\.63%/)).toBeInTheDocument();
        expect(screen.getByText(/이전 3\.63%/)).toBeInTheDocument();
    });

    it('정수 큰 값은 천 단위 콤마로 표기', () => {
        render(
            <EconomicCalendar
                events={[
                    {
                        ...EVENT,
                        estimate: 230000,
                        previous: 229000,
                        unit: '건',
                    },
                ]}
            />
        );
        expect(screen.getByText(/예상 230,000건/)).toBeInTheDocument();
        expect(screen.getByText(/이전 229,000건/)).toBeInTheDocument();
    });

    it('time 요소에 ISO-8601 dateTime 속성 (EDT offset 포함, 6월은 -04:00)', () => {
        const { container } = render(<EconomicCalendar events={[EVENT]} />);
        const time = container.querySelector('time');
        expect(time?.getAttribute('dateTime')).toBe(
            '2026-06-17T14:00:00-04:00'
        );
    });

    it('EDT 구간(6월) 이벤트 → dateTime에 -04:00 offset', () => {
        const { container } = render(
            <EconomicCalendar
                events={[{ ...EVENT, date: '2026-06-17 14:00:00' }]}
            />
        );
        const time = container.querySelector('time');
        expect(time?.getAttribute('dateTime')).toBe(
            '2026-06-17T14:00:00-04:00'
        );
    });

    it('EST 구간(12월) 이벤트 → dateTime에 -05:00 offset', () => {
        const { container } = render(
            <EconomicCalendar
                events={[{ ...EVENT, date: '2026-12-10 14:00:00' }]}
            />
        );
        const time = container.querySelector('time');
        expect(time?.getAttribute('dateTime')).toBe(
            '2026-12-10T14:00:00-05:00'
        );
    });

    it('impact 뱃지 한국어 변환 (High → 높음)', () => {
        render(<EconomicCalendar events={[EVENT]} />);
        expect(screen.getByText('높음')).toBeInTheDocument();
    });

    it('actual이 있으면 실제 값 함께 표시', () => {
        render(<EconomicCalendar events={[{ ...EVENT, actual: 3.5 }]} />);
        expect(screen.getByText(/실제 3\.5%/)).toBeInTheDocument();
    });

    it('actual=null이면 실제 표기 미렌더', () => {
        render(<EconomicCalendar events={[EVENT]} />);
        expect(screen.queryByText(/실제 /)).not.toBeInTheDocument();
    });
});
