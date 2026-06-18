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

    // ── DST boundary tests ───────────────────────────────────────────────────
    it.each([
        // [description, date string, expected offset]
        // EST구간: 3월 springDay 전날(2월 28일)
        ['2월 말(EST)', '2026-02-28 14:00:00', '-05:00'],
        // Spring 당일 springDay 전(3월 8일 01:59)
        [
            'spring 당일 전 (3월 8일 01:59, EST)',
            '2026-03-08 01:59:00',
            '-05:00',
        ],
        // Spring 당일 springDay 후(3월 8일 03:00) — 2026년 3월 두 번째 일요일=3월 8일
        [
            'spring 당일 후 (3월 8일 03:00, EDT)',
            '2026-03-08 03:00:00',
            '-04:00',
        ],
        // Spring forward day 02:00 자체 → EDT (실제 존재하지 않는 시각, EDT 처리)
        [
            'spring 02:00(시계가 앞당겨지는 순간, EDT)',
            '2026-03-08 02:00:00',
            '-04:00',
        ],
        // Spring forward day 다음날 (3월 14일 — 3월 두 번째 일요일=3월 8일이므로 3월 14일은 EDT 구간)
        ['3월 14일(EDT)', '2026-03-14 14:00:00', '-04:00'],
        // 7월(EDT 한복판)
        ['7월(EDT)', '2026-07-01 10:00:00', '-04:00'],
        // Fall back day 전(11월 1일 01:00) — 2026년 11월 첫 번째 일요일=11월 1일
        [
            'fall 당일 01:00(EDT — 중복 구간 첫 발생)',
            '2026-11-01 01:00:00',
            '-04:00',
        ],
        // Fall back day 02:00 이후(11월 1일 03:00) → EST
        ['fall 당일 03:00(EST)', '2026-11-01 03:00:00', '-05:00'],
        // Fall back day 02:00 → EST
        ['fall 02:00(EST)', '2026-11-01 02:00:00', '-05:00'],
        // 12월(EST 겨울)
        ['12월(EST)', '2026-12-01 10:00:00', '-05:00'],
    ])('DST offset: %s → %s', (_, dateStr, expectedOffset) => {
        const { container } = render(
            <EconomicCalendar events={[{ ...EVENT, date: dateStr }]} />
        );
        const time = container.querySelector('time');
        expect(time?.getAttribute('dateTime')).toBe(
            `${dateStr.replace(' ', 'T')}${expectedOffset}`
        );
    });
});
