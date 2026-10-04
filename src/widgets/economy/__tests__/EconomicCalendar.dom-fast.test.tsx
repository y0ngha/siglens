/**
 * EconomicCalendar 최소 smoke-test.
 *
 * 페이지들은 `EconomicCalendarGrid as EconomicCalendar`로 import해 쓴다. 이 파일은
 * 그 사용 형태가 정상 동작함을 확인하는 최소 smoke 테스트다.
 * 상세 동작(KST 변환, 임팩트 뱃지, time dateTime 등)은 EconomicCalendarGrid.test.tsx에서 검증한다.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { EconomicCalendarEvent } from '@y0ngha/siglens-core';

import { EconomicCalendarGrid as EconomicCalendar } from '@/widgets/economy/sections/EconomicCalendarGrid';

const EVENT: EconomicCalendarEvent = {
    date: '2026-06-17 14:00:00',
    event: 'Fed Rate Decision',
    impact: 'High',
    actual: null,
    estimate: 3.63,
    previous: 3.63,
    unit: '%',
};

describe('EconomicCalendar (alias of EconomicCalendarGrid)', () => {
    it('이벤트 0건이면 안내 문구', () => {
        render(<EconomicCalendar country="US" events={[]} />);
        expect(
            screen.getByText('다가오는 미국 경제 발표 일정이 아직 없어요.')
        ).toBeInTheDocument();
    });

    it('이벤트 1건이면 이벤트 이름이 DOM에 존재한다', () => {
        const { container } = render(
            <EconomicCalendar country="US" events={[EVENT]} />
        );
        expect(container.textContent).toContain('Fed Rate Decision');
    });
});
