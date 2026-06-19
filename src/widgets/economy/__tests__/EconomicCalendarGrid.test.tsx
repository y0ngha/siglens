import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { EconomicCalendarEvent } from '@y0ngha/siglens-core';

import { EconomicCalendarGrid } from '@/widgets/economy/sections/EconomicCalendarGrid';

// ---------------------------------------------------------------------------
// 픽스처
// ---------------------------------------------------------------------------

/**
 * 기준 이벤트: 2026-06-19 19:30:00 ET(-04:00) → KST 2026-06-20 오전 8:30
 * (날짜 롤오버 케이스)
 */
const EVENT_A: EconomicCalendarEvent = {
    date: '2026-06-19 19:30:00',
    event: 'Fed Rate Decision',
    impact: 'High',
    actual: null,
    estimate: 3.63,
    previous: 3.63,
    unit: '%',
};

/** 같은 KST 날(2026-06-20)에 속하는 두 번째 이벤트 */
const EVENT_B: EconomicCalendarEvent = {
    date: '2026-06-19 20:00:00',
    event: 'CPI Release',
    impact: 'Medium',
    actual: 2.5,
    estimate: 2.4,
    previous: 2.3,
    unit: '%',
};

/** 다른 KST 날(2026-06-21)에 속하는 이벤트 */
const EVENT_C: EconomicCalendarEvent = {
    date: '2026-06-20 14:00:00',
    event: 'Unemployment Claims',
    impact: 'Low',
    actual: null,
    estimate: 230000,
    previous: 229000,
    unit: '건',
};

// ---------------------------------------------------------------------------
// 빈 상태
// ---------------------------------------------------------------------------

describe('EconomicCalendarGrid — 빈 상태', () => {
    it('events가 0건이면 안내 문구 렌더', () => {
        render(<EconomicCalendarGrid events={[]} />);
        expect(
            screen.getByText('다가오는 미국 경제 발표 일정이 아직 없어요.')
        ).toBeInTheDocument();
    });

    it('빈 상태에서 "(한국시간)" 부제가 있는 h2 렌더', () => {
        render(<EconomicCalendarGrid events={[]} />);
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
            '경제 캘린더'
        );
        expect(screen.getByText('(한국시간)')).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// KST 그룹핑
// ---------------------------------------------------------------------------

describe('EconomicCalendarGrid — KST 그룹핑', () => {
    it('ET 날짜가 다르더라도 같은 KST 날이면 한 그룹으로 묶인다', () => {
        render(<EconomicCalendarGrid events={[EVENT_A, EVENT_B]} />);
        // EVENT_A(2026-06-19 ET) + EVENT_B(2026-06-19 ET) 모두 KST 2026-06-20
        // → 한 날짜 버튼에 "이벤트 2건" aria-label
        const btn = screen.getByRole('button', {
            name: /6월 20일.*이벤트 2건/,
        });
        expect(btn).toBeInTheDocument();
    });

    it('KST 날이 다른 이벤트는 별도 날짜 버튼으로 렌더된다', () => {
        render(<EconomicCalendarGrid events={[EVENT_A, EVENT_C]} />);
        // EVENT_A → KST 6/20, EVENT_C → KST 6/21
        expect(
            screen.getByRole('button', { name: /6월 20일/ })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /6월 21일/ })
        ).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// 기본 선택 날짜
// ---------------------------------------------------------------------------

describe('EconomicCalendarGrid — 기본 선택 날짜', () => {
    it('가장 이른 KST 날짜가 기본 선택된다 (aria-pressed=true)', () => {
        render(<EconomicCalendarGrid events={[EVENT_A, EVENT_C]} />);
        // KST 상 EVENT_A(2026-06-20) < EVENT_C(2026-06-21)
        const earliest = screen.getByRole('button', { name: /6월 20일/ });
        expect(earliest).toHaveAttribute('aria-pressed', 'true');
        const later = screen.getByRole('button', { name: /6월 21일/ });
        expect(later).toHaveAttribute('aria-pressed', 'false');
    });
});

// ---------------------------------------------------------------------------
// 상호작용 — 날짜 선택
// ---------------------------------------------------------------------------

describe('EconomicCalendarGrid — 날짜 선택', () => {
    it('날짜 버튼 클릭 시 aria-pressed가 해당 버튼으로 이동한다', () => {
        render(<EconomicCalendarGrid events={[EVENT_A, EVENT_C]} />);
        const btn21 = screen.getByRole('button', { name: /6월 21일/ });
        fireEvent.click(btn21);
        expect(btn21).toHaveAttribute('aria-pressed', 'true');
        // 이전 기본 선택은 해제
        const btn20 = screen.getByRole('button', { name: /6월 20일/ });
        expect(btn20).toHaveAttribute('aria-pressed', 'false');
    });

    it('선택된 날짜 패널에 이벤트 이름이 보인다', () => {
        render(<EconomicCalendarGrid events={[EVENT_A, EVENT_C]} />);
        // 기본 선택 = 6월 20일 → EVENT_A 상세가 표시
        expect(screen.getByText('Fed Rate Decision')).toBeVisible();
    });

    it('다른 날짜 클릭 후 해당 날 상세가 표시된다', () => {
        render(<EconomicCalendarGrid events={[EVENT_A, EVENT_C]} />);
        const btn21 = screen.getByRole('button', { name: /6월 21일/ });
        fireEvent.click(btn21);
        // EVENT_C(6/21)의 이벤트 이름이 보여야 한다
        expect(screen.getByText('Unemployment Claims')).toBeVisible();
    });
});

// ---------------------------------------------------------------------------
// SSR 크롤러 접근성 — 모든 이벤트 DOM에 존재
// ---------------------------------------------------------------------------

describe('EconomicCalendarGrid — SSR 크롤러 접근성', () => {
    it('선택되지 않은 날짜의 이벤트 텍스트도 DOM에 존재한다 (hidden 속성, 크롤러 색인 가능)', () => {
        const { container } = render(
            <EconomicCalendarGrid events={[EVENT_A, EVENT_C]} />
        );
        // 기본 선택 = 6/20(EVENT_A). EVENT_C(6/21)는 숨겨져 있지만 DOM에 있어야 한다.
        // `screen.getByText`는 hidden을 제외하므로 container.textContent로 확인.
        expect(container.textContent).toContain('Unemployment Claims');
    });

    it('모든 이벤트의 event.event 텍스트가 container에 포함된다', () => {
        const { container } = render(
            <EconomicCalendarGrid events={[EVENT_A, EVENT_B, EVENT_C]} />
        );
        expect(container.textContent).toContain('Fed Rate Decision');
        expect(container.textContent).toContain('CPI Release');
        expect(container.textContent).toContain('Unemployment Claims');
    });

    it('비선택 패널은 hidden 속성을 가진다', () => {
        const { container } = render(
            <EconomicCalendarGrid events={[EVENT_A, EVENT_C]} />
        );
        // panel-2026-06-21은 선택되지 않으므로 hidden
        const hiddenPanel = container.querySelector('#panel-2026-06-21');
        expect(hiddenPanel).toHaveAttribute('hidden');
    });

    it('선택된 패널은 hidden 속성이 없다', () => {
        const { container } = render(
            <EconomicCalendarGrid events={[EVENT_A, EVENT_C]} />
        );
        // 기본 선택 = 6/20
        const selectedPanel = container.querySelector('#panel-2026-06-20');
        expect(selectedPanel).not.toHaveAttribute('hidden');
    });
});

// ---------------------------------------------------------------------------
// 상세 패널 — 데이터 표시
// ---------------------------------------------------------------------------

describe('EconomicCalendarGrid — 상세 패널 데이터', () => {
    it('예상·이전 값 표시', () => {
        render(<EconomicCalendarGrid events={[EVENT_A]} />);
        expect(screen.getByText(/예상 3\.63%/)).toBeInTheDocument();
        expect(screen.getByText(/이전 3\.63%/)).toBeInTheDocument();
    });

    it('actual이 있으면 실제 값 표시', () => {
        render(<EconomicCalendarGrid events={[EVENT_B]} />);
        expect(screen.getByText(/실제 2\.5%/)).toBeInTheDocument();
    });

    it('actual=null이면 실제 미표시', () => {
        render(<EconomicCalendarGrid events={[EVENT_A]} />);
        expect(screen.queryByText(/실제/)).not.toBeInTheDocument();
    });

    it('임팩트 뱃지 한국어 레이블 표시 (High → 높음)', () => {
        render(<EconomicCalendarGrid events={[EVENT_A]} />);
        expect(screen.getAllByText('높음').length).toBeGreaterThan(0);
    });

    it('천 단위 콤마 포맷 (230,000건)', () => {
        render(<EconomicCalendarGrid events={[EVENT_C]} />);
        // EVENT_C가 기본 선택이 아니므로 먼저 6/21 버튼 클릭
        const btn21 = screen.getByRole('button', { name: /6월 21일/ });
        fireEvent.click(btn21);
        expect(screen.getByText(/예상 230,000건/)).toBeInTheDocument();
        expect(screen.getByText(/이전 229,000건/)).toBeInTheDocument();
    });

    it('time 요소에 ET ISO-8601 dateTime 속성', () => {
        const { container } = render(
            <EconomicCalendarGrid events={[EVENT_A]} />
        );
        // EVENT_A: 2026-06-19 19:30:00 ET → -04:00
        const times = container.querySelectorAll('time');
        const isoValues = Array.from(times).map(t =>
            t.getAttribute('dateTime')
        );
        expect(isoValues).toContain('2026-06-19T19:30:00-04:00');
    });

    it('KST 시각 레이블이 상세 패널에 표시된다 (오전 8:30)', () => {
        render(<EconomicCalendarGrid events={[EVENT_A]} />);
        // 기본 선택(6/20) 패널 안의 time 텍스트 내용
        const times = screen.getAllByRole('time');
        const timeTexts = times.map(t => t.textContent);
        expect(timeTexts.some(t => t?.includes('오전 8:30'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// 그리드 구조
// ---------------------------------------------------------------------------

describe('EconomicCalendarGrid — 그리드 구조', () => {
    it('테이블 요소가 렌더된다', () => {
        const { container } = render(
            <EconomicCalendarGrid events={[EVENT_A]} />
        );
        expect(container.querySelector('table')).toBeInTheDocument();
    });

    it('thead에 7개의 요일 th가 있다', () => {
        const { container } = render(
            <EconomicCalendarGrid events={[EVENT_A]} />
        );
        const ths = container.querySelectorAll('thead th');
        expect(ths.length).toBe(7);
    });

    it('h2 제목에 "(한국시간)" 포함', () => {
        render(<EconomicCalendarGrid events={[EVENT_A]} />);
        expect(screen.getByText('(한국시간)')).toBeInTheDocument();
    });

    it('월 스패닝 시 해당 월 레이블이 표시된다', () => {
        // EVENT_A → KST 6/20 (6월), EVENT_C → KST 6/21 (6월) — 같은 월
        render(<EconomicCalendarGrid events={[EVENT_A, EVENT_C]} />);
        // 가시적 월 레이블(<p>)과 sr-only caption 모두 2026년 6월을 포함하므로
        // getAllByText로 복수 매치를 허용한다.
        expect(screen.getAllByText(/2026년 6월/).length).toBeGreaterThan(0);
    });
});
