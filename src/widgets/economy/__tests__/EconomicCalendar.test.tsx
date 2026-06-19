/**
 * EconomicCalendar barrel 별칭 smoke-test.
 *
 * `EconomicCalendar`는 index.ts에서 `EconomicCalendarGrid as EconomicCalendar`로
 * re-export된다. 이 파일은 barrel 별칭이 정상 동작함을 확인하는 최소 smoke 테스트다.
 * 상세 동작은 EconomicCalendarGrid.test.tsx에서 검증한다.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { EconomicCalendarEvent } from '@y0ngha/siglens-core';

// barrel 별칭을 통해 import — 실제 경로가 아닌 공개 API 검증.
import { EconomicCalendar } from '@/widgets/economy';

const EVENT: EconomicCalendarEvent = {
    date: '2026-06-17 14:00:00',
    event: 'Fed Rate Decision',
    impact: 'High',
    actual: null,
    estimate: 3.63,
    previous: 3.63,
    unit: '%',
};

describe('EconomicCalendar (barrel alias → EconomicCalendarGrid)', () => {
    it('이벤트 0건이면 안내 문구', () => {
        render(<EconomicCalendar events={[]} />);
        expect(
            screen.getByText('다가오는 미국 경제 발표 일정이 아직 없어요.')
        ).toBeInTheDocument();
    });

    it('이벤트 1건이면 이벤트 이름이 DOM에 존재한다', () => {
        const { container } = render(<EconomicCalendar events={[EVENT]} />);
        expect(container.textContent).toContain('Fed Rate Decision');
    });

    it('h2 제목에 "(한국시간)" 포함 (KST 캘린더 전환 확인)', () => {
        render(<EconomicCalendar events={[EVENT]} />);
        expect(screen.getByText('(한국시간)')).toBeInTheDocument();
    });

    it('time 요소에 ET ISO-8601 dateTime 속성 (-04:00 EDT)', () => {
        const { container } = render(<EconomicCalendar events={[EVENT]} />);
        const time = container.querySelector('time');
        expect(time?.getAttribute('dateTime')).toBe(
            '2026-06-17T14:00:00-04:00'
        );
    });

    it('임팩트 뱃지 한국어 변환 (High → 높음)', () => {
        render(<EconomicCalendar events={[EVENT]} />);
        // 이벤트 1건(High) → 상세 패널에 뱃지 1개만 렌더됨
        expect(screen.getAllByText('높음')).toHaveLength(1);
    });
});
