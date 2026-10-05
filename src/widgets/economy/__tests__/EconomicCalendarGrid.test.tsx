import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { IntlTestProvider } from '@/shared/test-utils/intlRenderWrapper';
import type { EconomicCalendarEvent } from '@y0ngha/siglens-core';
import { EconomicCalendarGrid } from '@/widgets/economy/sections/EconomicCalendarGrid';

vi.mock('@/entities/economy/actions/ensureEconomicCalendarAction', () => ({
    ensureEconomicCalendarAction: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/entities/economy/actions/ensureIndicatorTranslatedAction', () => ({
    ensureIndicatorTranslatedAction: vi.fn().mockResolvedValue(undefined),
}));
vi.mock(
    '@/entities/economy/actions/ensureEconomicEventsAnalyzedAction',
    () => ({
        ensureEconomicEventsAnalyzedAction: vi
            .fn()
            .mockResolvedValue(undefined),
    })
);

/**
 * 기준 이벤트: 2026-06-19 19:30:00 UTC(FMP 원본은 존 마커 없는 UTC) → KST
 * 2026-06-20 오전 4:30 (날짜 롤오버 케이스)
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

/** 다른 KST 날(2026-06-21)에 속하는 이벤트 — 2026-06-20 20:00 UTC + 9h = 6/21 05:00 */
const EVENT_C: EconomicCalendarEvent = {
    date: '2026-06-20 20:00:00',
    event: 'Unemployment Claims',
    impact: 'Low',
    actual: null,
    estimate: 230000,
    previous: 229000,
    unit: '건',
};

describe('EconomicCalendarGrid — 빈 상태', () => {
    it('events가 0건이면 안내 문구 렌더', () => {
        render(<EconomicCalendarGrid country="US" events={[]} />);
        expect(
            screen.getByText('다가오는 미국 경제 발표 일정이 아직 없어요.')
        ).toBeInTheDocument();
    });

    /**
     * 이 그리드는 두 라우트가 공유한다. 빈 상태는 `/economy/kr`에서 **의도적으로
     * 도달 가능한** 경로다 — 인제스션 트리거가 이 컴포넌트 안에 있어서 데이터가
     * 없어도 항상 렌더하기 때문이다. 문구를 하드코딩하면 배포 직후 한국 사용자가
     * "미국 발표 일정" 안내를 보고, 그게 24시간 ISR에 그대로 굳는다.
     */
    it('KR이면 빈 상태 문구도 한국을 가리킨다', () => {
        render(<EconomicCalendarGrid country="KR" events={[]} />);
        expect(
            screen.getByText('다가오는 한국 경제 발표 일정이 아직 없어요.')
        ).toBeInTheDocument();
    });

    it('빈 상태에서 "(한국시간)" 부제가 있는 h2 렌더', () => {
        render(<EconomicCalendarGrid country="US" events={[]} />);
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
            '경제 캘린더'
        );
        expect(screen.getByText('(한국시간)')).toBeInTheDocument();
    });
});

describe('EconomicCalendarGrid — KST 그룹핑', () => {
    it('UTC 날짜가 다르더라도 같은 KST 날이면 한 그룹으로 묶인다', () => {
        render(
            <EconomicCalendarGrid country="US" events={[EVENT_A, EVENT_B]} />
        );
        // EVENT_A(2026-06-19 UTC) + EVENT_B(2026-06-19 UTC) 모두 KST 2026-06-20
        // → 한 날짜 버튼에 "이벤트 2건" aria-label
        const btn = screen.getByRole('button', {
            name: /6월 20일.*이벤트 2건/,
        });
        expect(btn).toBeInTheDocument();
    });

    it('KST 날이 다른 이벤트는 별도 날짜 버튼으로 렌더된다', () => {
        render(
            <EconomicCalendarGrid country="US" events={[EVENT_A, EVENT_C]} />
        );
        // EVENT_A → KST 6/20, EVENT_C → KST 6/21
        expect(
            screen.getByRole('button', { name: /6월 20일/ })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /6월 21일/ })
        ).toBeInTheDocument();
    });
});

describe('EconomicCalendarGrid — 기본 선택 날짜', () => {
    it('가장 이른 KST 날짜가 기본 선택된다 (aria-pressed=true)', () => {
        render(
            <EconomicCalendarGrid country="US" events={[EVENT_A, EVENT_C]} />
        );
        // KST 상 EVENT_A(2026-06-20) < EVENT_C(2026-06-21)
        const earliest = screen.getByRole('button', { name: /6월 20일/ });
        expect(earliest).toHaveAttribute('aria-pressed', 'true');
        const later = screen.getByRole('button', { name: /6월 21일/ });
        expect(later).toHaveAttribute('aria-pressed', 'false');
    });
});

describe('EconomicCalendarGrid — 날짜 선택', () => {
    it('날짜 버튼 클릭 시 aria-pressed가 해당 버튼으로 이동한다', () => {
        render(
            <EconomicCalendarGrid country="US" events={[EVENT_A, EVENT_C]} />
        );
        const btn21 = screen.getByRole('button', { name: /6월 21일/ });
        fireEvent.click(btn21);
        expect(btn21).toHaveAttribute('aria-pressed', 'true');
        // 이전 기본 선택은 해제
        const btn20 = screen.getByRole('button', { name: /6월 20일/ });
        expect(btn20).toHaveAttribute('aria-pressed', 'false');
    });

    it('선택된 날짜 패널에 이벤트 이름이 보인다', () => {
        render(
            <EconomicCalendarGrid country="US" events={[EVENT_A, EVENT_C]} />
        );
        // 기본 선택 = 6월 20일 → EVENT_A 상세가 표시
        expect(screen.getByText('Fed Rate Decision')).toBeVisible();
    });

    it('다른 날짜 클릭 후 해당 날 상세가 표시된다', () => {
        render(
            <EconomicCalendarGrid country="US" events={[EVENT_A, EVENT_C]} />
        );
        // EVENT_C는 Low impact → 기본 필터 Low OFF이므로 먼저 Low 칩을 켠다.
        const group = screen.getByRole('group', { name: '중요도 필터' });
        fireEvent.click(within(group).getByRole('button', { name: '낮음' }));
        const btn21 = screen.getByRole('button', { name: /6월 21일/ });
        fireEvent.click(btn21);
        // EVENT_C(6/21)의 이벤트 이름이 보여야 한다
        expect(screen.getByText('Unemployment Claims')).toBeVisible();
    });
});

describe('EconomicCalendarGrid — SSR 크롤러 접근성', () => {
    it('선택되지 않은 날짜의 이벤트 텍스트도 DOM에 존재한다 (hidden 속성, 크롤러 색인 가능)', () => {
        const { container } = render(
            <EconomicCalendarGrid country="US" events={[EVENT_A, EVENT_C]} />
        );
        // 기본 선택 = 6/20(EVENT_A). EVENT_C(6/21)는 숨겨져 있지만 DOM에 있어야 한다.
        // `screen.getByText`는 hidden을 제외하므로 container.textContent로 확인.
        expect(container.textContent).toContain('Unemployment Claims');
    });

    it('모든 이벤트의 event.event 텍스트가 container에 포함된다', () => {
        const { container } = render(
            <EconomicCalendarGrid
                country="US"
                events={[EVENT_A, EVENT_B, EVENT_C]}
            />
        );
        expect(container.textContent).toContain('Fed Rate Decision');
        expect(container.textContent).toContain('CPI Release');
        expect(container.textContent).toContain('Unemployment Claims');
    });

    it('비선택 패널은 hidden 속성을 가진다', () => {
        const { container } = render(
            <EconomicCalendarGrid country="US" events={[EVENT_A, EVENT_C]} />
        );
        // panel-2026-06-21은 선택되지 않으므로 hidden
        const hiddenPanel = container.querySelector('#panel-2026-06-21');
        expect(hiddenPanel).toHaveAttribute('hidden');
    });

    it('선택된 패널은 hidden 속성이 없다', () => {
        const { container } = render(
            <EconomicCalendarGrid country="US" events={[EVENT_A, EVENT_C]} />
        );
        // 기본 선택 = 6/20
        const selectedPanel = container.querySelector('#panel-2026-06-20');
        expect(selectedPanel).not.toHaveAttribute('hidden');
    });
});

describe('EconomicCalendarGrid — 상세 패널 데이터', () => {
    it('예상·이전 값 표시', () => {
        render(<EconomicCalendarGrid country="US" events={[EVENT_A]} />);
        expect(screen.getByText(/예상 3\.63%/)).toBeInTheDocument();
        expect(screen.getByText(/이전 3\.63%/)).toBeInTheDocument();
    });

    it('actual이 있으면 실제 값 표시', () => {
        render(<EconomicCalendarGrid country="US" events={[EVENT_B]} />);
        expect(screen.getByText(/실제 2\.5%/)).toBeInTheDocument();
    });

    it('actual=null이면 실제 미표시', () => {
        render(<EconomicCalendarGrid country="US" events={[EVENT_A]} />);
        expect(screen.queryByText(/실제/)).not.toBeInTheDocument();
    });

    it('임팩트 뱃지 한국어 레이블 표시 (High → 높음)', () => {
        render(<EconomicCalendarGrid country="US" events={[EVENT_A]} />);
        // 화면에는 필터 칩 "높음"(button)과 상세 뱃지 "높음"(span)이 함께 존재.
        // 뱃지만 검증하기 위해 button role을 제외한 매치를 센다.
        const highLabels = screen.getAllByText('높음');
        const badges = highLabels.filter(el => el.closest('button') === null);
        expect(badges).toHaveLength(1);
    });

    it('천 단위 콤마 포맷 (230,000건)', () => {
        render(<EconomicCalendarGrid country="US" events={[EVENT_C]} />);
        // EVENT_C가 기본 선택이 아니므로 먼저 6/21 버튼 클릭
        const btn21 = screen.getByRole('button', { name: /6월 21일/ });
        fireEvent.click(btn21);
        expect(screen.getByText(/예상 230,000건/)).toBeInTheDocument();
        expect(screen.getByText(/이전 229,000건/)).toBeInTheDocument();
    });

    it('time 요소에 UTC ISO-8601 dateTime 속성', () => {
        const { container } = render(
            <EconomicCalendarGrid country="US" events={[EVENT_A]} />
        );
        // EVENT_A: 2026-06-19 19:30:00 UTC → 'Z'
        const times = container.querySelectorAll('time');
        const isoValues = Array.from(times).map(t =>
            t.getAttribute('dateTime')
        );
        expect(isoValues).toContain('2026-06-19T19:30:00Z');
    });

    it('KST 시각 레이블이 상세 패널에 표시된다 (오전 4:30)', () => {
        render(<EconomicCalendarGrid country="US" events={[EVENT_A]} />);
        expect(screen.getByText('오전 4:30')).toBeInTheDocument();
    });
});

describe('EconomicCalendarGrid — 그리드 구조', () => {
    it('테이블 요소가 렌더된다', () => {
        const { container } = render(
            <EconomicCalendarGrid country="US" events={[EVENT_A]} />
        );
        expect(container.querySelector('table')).toBeInTheDocument();
    });

    it('thead에 7개의 요일 th가 있다', () => {
        const { container } = render(
            <EconomicCalendarGrid country="US" events={[EVENT_A]} />
        );
        const ths = container.querySelectorAll('thead th');
        expect(ths.length).toBe(7);
    });

    it('h2 제목에 "(한국시간)" 포함', () => {
        render(<EconomicCalendarGrid country="US" events={[EVENT_A]} />);
        expect(screen.getByText('(한국시간)')).toBeInTheDocument();
    });

    it('월 스패닝 시 해당 월 레이블이 표시된다', () => {
        // EVENT_A → KST 6/20 (6월), EVENT_C → KST 6/21 (6월) — 같은 월
        render(
            <EconomicCalendarGrid country="US" events={[EVENT_A, EVENT_C]} />
        );
        // 가시적 월 레이블(<p>)과 sr-only caption 모두 2026년 6월을 포함하므로
        // 두 요소가 매치된다.
        expect(screen.getAllByText(/2026년 6월/)).toHaveLength(2);
    });
});

describe('EconomicCalendarGrid default selection from today', () => {
    const ev = (date: string): EconomicCalendarEvent => ({
        date: `${date} 08:30:00`,
        event: `E ${date}`,
        impact: 'High',
        actual: null,
        estimate: 1,
        previous: 1,
        unit: '%',
    });

    it("selects today's panel when an event exists for today (KST)", () => {
        // 2026-06-20 08:30 UTC → KST 2026-06-20 17:30 → KST date key 2026-06-20.
        render(
            <EconomicCalendarGrid
                country="US"
                events={[ev('2026-06-18'), ev('2026-06-20'), ev('2026-06-25')]}
                today="2026-06-20"
            />
        );
        // The today day-button is pressed.
        const todayBtn = screen.getByRole('button', {
            name: /6월 20일/,
        });
        expect(todayBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('selects the nearest upcoming day when today has no events', () => {
        render(
            <EconomicCalendarGrid
                country="US"
                events={[ev('2026-06-18'), ev('2026-06-25')]}
                today="2026-06-20"
            />
        );
        const upcomingBtn = screen.getByRole('button', {
            name: /6월 25일/,
        });
        expect(upcomingBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('falls back to the earliest day when all events are in the past', () => {
        render(
            <EconomicCalendarGrid
                country="US"
                events={[ev('2026-06-10'), ev('2026-06-12')]}
                today="2026-06-20"
            />
        );
        const earliestBtn = screen.getByRole('button', {
            name: /6월 10일/,
        });
        expect(earliestBtn).toHaveAttribute('aria-pressed', 'true');
    });
});

describe('EconomicCalendarGrid — 중요도 필터 (기본 상태 · 셀 건수)', () => {
    it('"중요도 필터" group이 렌더된다', () => {
        render(
            <EconomicCalendarGrid country="US" events={[EVENT_A, EVENT_C]} />
        );
        expect(
            screen.getByRole('group', { name: '중요도 필터' })
        ).toBeInTheDocument();
    });

    it('기본값은 High+Medium ON, Low OFF (칩 aria-pressed)', () => {
        render(
            <EconomicCalendarGrid
                country="US"
                events={[EVENT_A, EVENT_B, EVENT_C]}
            />
        );
        const group = screen.getByRole('group', { name: '중요도 필터' });
        expect(
            within(group).getByRole('button', { name: '높음' })
        ).toHaveAttribute('aria-pressed', 'true');
        expect(
            within(group).getByRole('button', { name: '보통' })
        ).toHaveAttribute('aria-pressed', 'true');
        expect(
            within(group).getByRole('button', { name: '낮음' })
        ).toHaveAttribute('aria-pressed', 'false');
    });

    it('기본 상태에서 날짜 셀 건수는 활성 impact만 센다 (Low 제외)', () => {
        // EVENT_A(High)+EVENT_B(Medium) → KST 6/20, EVENT_C(Low) → KST 6/21.
        // 기본 필터: Low OFF → 6/21 셀은 0건, 6/20 셀은 2건.
        render(
            <EconomicCalendarGrid
                country="US"
                events={[EVENT_A, EVENT_B, EVENT_C]}
            />
        );
        expect(
            screen.getByRole('button', { name: /6월 20일.*이벤트 2건/ })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /6월 21일.*이벤트 0건/ })
        ).toBeInTheDocument();
    });

    it('Low 칩을 켜면 Low 날짜 셀 건수가 다시 카운트된다', () => {
        render(
            <EconomicCalendarGrid
                country="US"
                events={[EVENT_A, EVENT_B, EVENT_C]}
            />
        );
        const group = screen.getByRole('group', { name: '중요도 필터' });
        fireEvent.click(within(group).getByRole('button', { name: '낮음' }));
        expect(
            screen.getByRole('button', { name: /6월 21일.*이벤트 1건/ })
        ).toBeInTheDocument();
    });

    it('High 칩을 끄면 High 셀 건수가 줄어든다', () => {
        render(
            <EconomicCalendarGrid
                country="US"
                events={[EVENT_A, EVENT_B, EVENT_C]}
            />
        );
        const group = screen.getByRole('group', { name: '중요도 필터' });
        // 기본: 6/20 = High(A)+Medium(B) = 2건. High 끄면 Medium만 → 1건.
        fireEvent.click(within(group).getByRole('button', { name: '높음' }));
        expect(
            screen.getByRole('button', { name: /6월 20일.*이벤트 1건/ })
        ).toBeInTheDocument();
    });
});

describe('EconomicCalendarGrid — 중요도 필터 (상세 패널 · DOM 유지)', () => {
    it('비활성 impact 이벤트도 상세 패널 DOM에 남는다 (크롤러 색인)', () => {
        // EVENT_C(Low) → KST 6/21. 기본 필터 Low OFF.
        // 6/21을 선택해 패널을 열어도, Low 항목은 hidden이지만 DOM엔 존재해야 한다.
        const { container } = render(
            <EconomicCalendarGrid
                country="US"
                events={[EVENT_A, EVENT_B, EVENT_C]}
            />
        );
        // 패널을 열기 위해 6/21 날짜 버튼 클릭(Low 칩은 여전히 OFF)
        fireEvent.click(screen.getByRole('button', { name: /6월 21일/ }));
        // Low 칩 OFF 상태이므로 화면(getByText)에는 안 보이지만 DOM엔 있다.
        expect(container.textContent).toContain('Unemployment Claims');
        // 해당 li가 hidden 인지 확인
        const li = screen.getByText('Unemployment Claims').closest('li');
        expect(li).toHaveAttribute('hidden');
    });

    it('활성 impact 이벤트의 상세 li는 hidden이 아니다', () => {
        // EVENT_A(High) → KST 6/20, 기본 선택 + High 활성.
        render(
            <EconomicCalendarGrid
                country="US"
                events={[EVENT_A, EVENT_B, EVENT_C]}
            />
        );
        const li = screen.getByText('Fed Rate Decision').closest('li');
        expect(li).not.toHaveAttribute('hidden');
    });

    it('Low 칩을 켜면 상세 패널의 Low li에서 hidden이 사라진다', () => {
        render(
            <EconomicCalendarGrid
                country="US"
                events={[EVENT_A, EVENT_B, EVENT_C]}
            />
        );
        const group = screen.getByRole('group', { name: '중요도 필터' });
        fireEvent.click(screen.getByRole('button', { name: /6월 21일/ }));
        // 켜기 전: hidden
        expect(
            screen.getByText('Unemployment Claims').closest('li')
        ).toHaveAttribute('hidden');
        // Low 켜기
        fireEvent.click(within(group).getByRole('button', { name: '낮음' }));
        expect(
            screen.getByText('Unemployment Claims').closest('li')
        ).not.toHaveAttribute('hidden');
    });

    it('Medium 칩을 끄면 상세 패널의 Medium li가 hidden 된다', () => {
        // EVENT_B(Medium) → KST 6/20, 기본 선택일.
        render(
            <EconomicCalendarGrid
                country="US"
                events={[EVENT_A, EVENT_B, EVENT_C]}
            />
        );
        const group = screen.getByRole('group', { name: '중요도 필터' });
        // 기본: Medium ON → CPI Release li는 hidden 아님
        expect(
            screen.getByText('CPI Release').closest('li')
        ).not.toHaveAttribute('hidden');
        fireEvent.click(within(group).getByRole('button', { name: '보통' }));
        expect(screen.getByText('CPI Release').closest('li')).toHaveAttribute(
            'hidden'
        );
    });
});

describe('EconomicCalendarGrid Korean indicator labels', () => {
    const ev = (date: string, event: string): EconomicCalendarEvent => ({
        date: `${date} 08:30:00`,
        event,
        impact: 'High',
        actual: null,
        estimate: 1,
        previous: 1,
        unit: '%',
    });

    it('renders the Korean label in the detail panel when provided', () => {
        render(
            <EconomicCalendarGrid
                country="US"
                events={[ev('2026-06-20', 'Nonfarm Payrolls')]}
                today="2026-06-20"
                labels={{ 'Nonfarm Payrolls': '비농업 고용' }}
            />
        );
        // Single event on the selected (today) panel → exactly one <p> with the Korean label.
        expect(screen.getByText('비농업 고용')).toBeInTheDocument();
        expect(screen.queryByText('Nonfarm Payrolls')).toBeNull();
    });

    it('falls back to the English event name when no label is provided', () => {
        render(
            <EconomicCalendarGrid
                country="US"
                events={[ev('2026-06-20', 'Mystery Index')]}
                today="2026-06-20"
            />
        );
        // Single event on the selected (today) panel → exactly one <p> with the English fallback.
        expect(screen.getByText('Mystery Index')).toBeInTheDocument();
    });
});

/**
 * 셀에서 심각도를 나르는 것은 6px 점의 **색뿐**이었다 — 점은 `aria-hidden`이고
 * 텍스트는 건수만 냈다. 그 색은 빨강/주황이라 적록색약에서 수렴한다(WCAG 1.4.1).
 * 6px에서는 모양이나 링으로 갈라도 읽히지 않으므로 접근 이름에 텍스트로 담는다.
 */
describe('날짜 셀의 심각도 노출', () => {
    it('접근 이름에 중요도가 담긴다', () => {
        render(
            <EconomicCalendarGrid country="US" events={[EVENT_A, EVENT_B]} />
        );
        const btn = screen.getByRole('button', {
            name: /6월 20일.*이벤트 2건/,
        });
        expect(btn.getAttribute('aria-label')).toContain('중요도');
    });

    it('이벤트가 없는 날에는 중요도를 붙이지 않는다', () => {
        // 기본 필터에서 Low는 OFF라 EVENT_C가 걸린 6/21이 0건이 된다.
        render(
            <EconomicCalendarGrid
                country="US"
                events={[EVENT_A, EVENT_B, EVENT_C]}
            />
        );
        const btn = screen.getByRole('button', {
            name: /6월 21일.*이벤트 0건/,
        });
        expect(btn.getAttribute('aria-label')).not.toContain('중요도');
    });
});

/**
 * 월 그리드 UX — 오늘 표시, 빈 날짜 숫자, 지난 주 접기, 선택 시 스크롤, N/A 제거.
 *
 * "오늘"은 마운트 후 `kstDateKey(new Date())`로 갱신되므로 `Date`만 고정한다
 * (타이머까지 가짜로 만들면 RTL의 비동기 헬퍼가 멈춘다). 고정 시각은 KST
 * 2026-06-17(수) 12:00 — 이 날이 속한 주(일요일 시작)는 6/14~6/20이다.
 */
describe('EconomicCalendarGrid — 월 그리드 UX', () => {
    const ev = (
        date: string,
        patch: Partial<EconomicCalendarEvent> = {}
    ): EconomicCalendarEvent => ({
        date: `${date} 08:30:00`,
        event: `E ${date}`,
        impact: 'High',
        actual: null,
        estimate: 1,
        previous: 1,
        unit: '%',
        ...patch,
    });

    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-06-17T03:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('오늘 표시', () => {
        it('이벤트가 있는 오늘 칸은 aria-current="date"를 갖고 다른 칸은 갖지 않는다', () => {
            render(
                <EconomicCalendarGrid
                    country="US"
                    events={[ev('2026-06-17'), ev('2026-06-18')]}
                    today="2026-06-17"
                />
            );
            expect(
                screen.getByRole('button', { name: /6월 17일/ })
            ).toHaveAttribute('aria-current', 'date');
            expect(
                screen.getByRole('button', { name: /6월 18일/ })
            ).not.toHaveAttribute('aria-current');
        });

        it('이벤트 없는 오늘 칸도 aria-current="date"를 갖는다', () => {
            const { container } = render(
                <EconomicCalendarGrid
                    country="US"
                    events={[ev('2026-06-16'), ev('2026-06-18')]}
                    today="2026-06-17"
                />
            );
            const current = container.querySelectorAll('[aria-current="date"]');
            expect(current).toHaveLength(1);
            expect(current[0]).toHaveTextContent('17');
            expect(current[0].tagName).toBe('SPAN');
        });

        it('ISR로 묵은 today prop 대신 마운트 후 실제 오늘을 표시한다', () => {
            const { container } = render(
                <EconomicCalendarGrid
                    country="US"
                    events={[ev('2026-06-16'), ev('2026-06-18')]}
                    today="2026-06-16"
                />
            );
            const current = container.querySelectorAll('[aria-current="date"]');
            expect(current).toHaveLength(1);
            expect(current[0]).toHaveTextContent('17');
        });
    });

    describe('이벤트 없는 날', () => {
        it('날짜 숫자를 비대화형으로 렌더한다', () => {
            render(
                <EconomicCalendarGrid
                    country="US"
                    events={[ev('2026-06-18'), ev('2026-06-22')]}
                    today="2026-06-17"
                />
            );
            for (const day of ['19', '20', '21']) {
                const cell = screen.getByText(day);
                expect(cell.closest('button')).toBeNull();
                expect(cell.tagName).toBe('SPAN');
            }
        });

        it('이벤트가 없는 앞뒤 주 줄은 렌더하지 않는다', () => {
            const { container } = render(
                <EconomicCalendarGrid
                    country="US"
                    events={[ev('2026-06-17')]}
                    today="2026-06-17"
                />
            );
            // 6/14~6/20 주 한 줄만 남는다 — 6/1~6/13, 6/21~6/30은 이벤트가 없다.
            expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
        });
    });

    describe('지난 주 접기', () => {
        const EVENTS = [ev('2026-06-09'), ev('2026-06-18')];

        it('지난 주 줄은 DOM에 남되 hidden이고, 토글 버튼은 aria-expanded=false다', () => {
            const { container } = render(
                <EconomicCalendarGrid
                    country="US"
                    events={EVENTS}
                    today="2026-06-17"
                />
            );
            const pastBtn = container.querySelector('#day-btn-2026-06-09');
            expect(pastBtn).not.toBeNull();
            expect(pastBtn?.closest('tr')).toHaveAttribute('hidden');
            expect(
                screen.queryByRole('button', { name: /6월 9일/ })
            ).not.toBeInTheDocument();
            expect(
                container.querySelector('#day-btn-2026-06-18')?.closest('tr')
            ).not.toHaveAttribute('hidden');
            expect(
                screen.getByRole('button', { name: '지난 일정 보기' })
            ).toHaveAttribute('aria-expanded', 'false');
        });

        it('지난 일정 보기를 누르면 지난 주가 나타나고 aria-expanded가 true가 된다', () => {
            render(
                <EconomicCalendarGrid
                    country="US"
                    events={EVENTS}
                    today="2026-06-17"
                />
            );
            fireEvent.click(
                screen.getByRole('button', { name: '지난 일정 보기' })
            );
            expect(
                screen.getByRole('button', { name: /6월 9일/ })
            ).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: '지난 일정 접기' })
            ).toHaveAttribute('aria-expanded', 'true');
        });

        it('다시 누르면 접힌다', () => {
            render(
                <EconomicCalendarGrid
                    country="US"
                    events={EVENTS}
                    today="2026-06-17"
                />
            );
            fireEvent.click(
                screen.getByRole('button', { name: '지난 일정 보기' })
            );
            fireEvent.click(
                screen.getByRole('button', { name: '지난 일정 접기' })
            );
            expect(
                screen.queryByRole('button', { name: /6월 9일/ })
            ).not.toBeInTheDocument();
        });

        it('지난 주의 상세 패널도 DOM에 남는다(크롤러 색인)', () => {
            const { container } = render(
                <EconomicCalendarGrid
                    country="US"
                    events={EVENTS}
                    today="2026-06-17"
                />
            );
            expect(
                container.querySelector('#panel-2026-06-09')
            ).toHaveTextContent('E 2026-06-09');
        });

        it('선택된 날이 든 주는 지난 주여도 접지 않는다 (선택한 칸이 사라지면 안 된다)', () => {
            // ISR로 묵은 today(6/9)가 기본 선택을 6/9로 정했지만, 실제 오늘은 6/17이다.
            const { container } = render(
                <EconomicCalendarGrid
                    country="US"
                    events={EVENTS}
                    today="2026-06-09"
                />
            );
            expect(
                container.querySelector('#day-btn-2026-06-09')
            ).toHaveAttribute('aria-pressed', 'true');
            expect(
                container.querySelector('#day-btn-2026-06-09')?.closest('tr')
            ).not.toHaveAttribute('hidden');
        });

        it('앞으로 남은 이벤트가 없으면(전부 과거) 접지 않고 토글도 없다', () => {
            render(
                <EconomicCalendarGrid
                    country="US"
                    events={[ev('2026-06-02'), ev('2026-06-09')]}
                    today="2026-06-17"
                />
            );
            expect(
                screen.queryByRole('button', { name: '지난 일정 보기' })
            ).not.toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: /6월 2일/ })
            ).toBeInTheDocument();
        });

        it('today prop이 없어도 마운트 후 실제 오늘(고정 Date) 기준으로 접는다', () => {
            // today가 없으면 기본 선택은 가장 이른 날(6/2)이라 그 주는 선택 예외로 남는다.
            // 6/9 주가 접히는지를 본다.
            const { container } = render(
                <EconomicCalendarGrid
                    country="US"
                    events={[ev('2026-06-02'), ...EVENTS]}
                />
            );
            expect(
                container.querySelector('#day-btn-2026-06-09')?.closest('tr')
            ).toHaveAttribute('hidden');
            expect(
                screen.getByRole('button', { name: '지난 일정 보기' })
            ).toBeInTheDocument();
        });

        /**
         * 첫 렌더(SSR 포함)에는 오늘을 모른다 — today prop이 없으면 `todayKey`가 `''`다.
         * 이때 접으면 안 되고(기준일이 없다), 가드가 없으면 `''`로 날짜 산술을 하다
         * 던진다. effect가 돌기 전의 렌더를 `renderToString`으로 그대로 본다.
         */
        it('오늘을 아직 모르는 첫 렌더(today 없음)는 아무 주도 접지 않고 토글도 없다', () => {
            const html = renderToString(
                <IntlTestProvider>
                    <EconomicCalendarGrid country="US" events={EVENTS} />
                </IntlTestProvider>
            );
            expect(html).not.toMatch(/<tr[^>]*\bhidden/);
            expect(html).not.toContain('지난 일정 보기');
            expect(html).toContain('id="day-btn-2026-06-09"');
        });
    });

    describe('선택 시 상세 패널로 스크롤', () => {
        const scrollSpy = vi.fn();
        const original = Element.prototype.scrollIntoView;

        beforeEach(() => {
            scrollSpy.mockReset();
            Element.prototype.scrollIntoView = scrollSpy;
        });

        afterEach(() => {
            Element.prototype.scrollIntoView = original;
        });

        it('기본 선택(마운트 시 syncDefault)은 스크롤하지 않는다', () => {
            render(
                <EconomicCalendarGrid
                    country="US"
                    events={[ev('2026-06-17'), ev('2026-06-18')]}
                    today="2026-06-17"
                />
            );
            expect(scrollSpy).not.toHaveBeenCalled();
        });

        it('날짜 칸을 누르면 그날 패널을 nearest로 스크롤한다', () => {
            render(
                <EconomicCalendarGrid
                    country="US"
                    events={[ev('2026-06-17'), ev('2026-06-18')]}
                    today="2026-06-17"
                />
            );
            fireEvent.click(screen.getByRole('button', { name: /6월 18일/ }));
            expect(scrollSpy).toHaveBeenCalledTimes(1);
            expect(scrollSpy).toHaveBeenCalledWith({
                block: 'nearest',
                behavior: 'smooth',
            });
            expect(scrollSpy.mock.contexts[0]).toHaveAttribute(
                'id',
                'panel-2026-06-18'
            );
            // 스크롤 시점에는 패널이 이미 hidden에서 풀려 있어야 한다.
            expect(scrollSpy.mock.contexts[0]).not.toHaveAttribute('hidden');
        });

        it('같은 날짜를 다시 눌러도 다시 스크롤한다', () => {
            render(
                <EconomicCalendarGrid
                    country="US"
                    events={[ev('2026-06-17'), ev('2026-06-18')]}
                    today="2026-06-17"
                />
            );
            const btn = screen.getByRole('button', { name: /6월 18일/ });
            fireEvent.click(btn);
            fireEvent.click(btn);
            expect(scrollSpy).toHaveBeenCalledTimes(2);
        });

        it('모션 감소 선호면 smooth 대신 auto를 쓴다', () => {
            const matchMedia = vi.spyOn(window, 'matchMedia').mockReturnValue({
                matches: true,
            } as MediaQueryList);
            try {
                render(
                    <EconomicCalendarGrid
                        country="US"
                        events={[ev('2026-06-17'), ev('2026-06-18')]}
                        today="2026-06-17"
                    />
                );
                fireEvent.click(
                    screen.getByRole('button', { name: /6월 18일/ })
                );
                expect(scrollSpy).toHaveBeenCalledWith({
                    block: 'nearest',
                    behavior: 'auto',
                });
            } finally {
                matchMedia.mockRestore();
            }
        });
    });

    describe('값 줄의 N/A 제거', () => {
        const renderOne = (patch: Partial<EconomicCalendarEvent>) =>
            render(
                <EconomicCalendarGrid
                    country="US"
                    events={[ev('2026-06-18', patch)]}
                    today="2026-06-18"
                />
            );

        it('예상·이전이 모두 null이면 라벨도 N/A도 렌더하지 않는다', () => {
            const { container } = renderOne({ estimate: null, previous: null });
            expect(container.textContent).not.toMatch(/N\/A/);
            expect(screen.queryByText(/예상/)).not.toBeInTheDocument();
            expect(screen.queryByText(/이전/)).not.toBeInTheDocument();
            // 값 줄 <p> 자체가 없다.
            expect(
                container.querySelector(
                    '#panel-2026-06-18 p.text-secondary-400'
                )
            ).toBeNull();
        });

        it('예상만 있으면 예상만 렌더한다', () => {
            const { container } = renderOne({ estimate: 2.5, previous: null });
            expect(screen.getByText('예상 2.5%')).toBeInTheDocument();
            expect(container.textContent).not.toMatch(/N\/A|이전/);
        });

        it('이전만 있으면 이전만 렌더한다', () => {
            renderOne({ estimate: null, previous: 2.3 });
            expect(screen.getByText('이전 2.3%')).toBeInTheDocument();
            expect(screen.queryByText(/예상/)).not.toBeInTheDocument();
        });

        it('둘 다 있으면 가운뎃점으로 이어 붙인다', () => {
            renderOne({ estimate: 2.5, previous: 2.3, actual: 2.4 });
            expect(
                screen.getByText('예상 2.5% · 이전 2.3% · 실제 2.4%')
            ).toBeInTheDocument();
        });

        it('예상·이전이 없는데 실제가 0이면 자리표시값이라 실제도 숨긴다', () => {
            const { container } = renderOne({
                estimate: null,
                previous: null,
                actual: 0,
            });
            expect(screen.queryByText(/실제/)).not.toBeInTheDocument();
            expect(container.textContent).not.toMatch(/N\/A/);
        });

        it('예상·이전이 없고 실제가 0이 아니면 실제는 보여 준다', () => {
            renderOne({ estimate: null, previous: null, actual: 3.1 });
            expect(screen.getByText('실제 3.1%')).toBeInTheDocument();
        });

        it('예상이 있으면 실제 0도 진짜 값이라 보여 준다', () => {
            renderOne({ estimate: 0.1, previous: null, actual: 0 });
            expect(screen.getByText('예상 0.1% · 실제 0%')).toBeInTheDocument();
        });
    });
});
