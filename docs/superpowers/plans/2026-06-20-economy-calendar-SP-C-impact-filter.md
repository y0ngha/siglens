# SP-C — 경제 캘린더 중요도 필터 UI 구현 계획 (2026-06-20)

## Goal

`EconomicCalendarGrid`(#610) 상단에 **영향도(High/Medium/Low) 필터 칩**을 추가한다.
사용자가 칩을 토글하면 캘린더 셀의 **임팩트 점·건수·인라인 미리보기**와 **선택일 상세 패널**이
선택된 impact만 보이도록 **시각적으로** 한정된다. 단, 전체 이벤트는 **항상 DOM에 유지**되어
SSR 크롤러가 색인할 수 있다(조건부 렌더/unmount 금지, `hidden` 속성 토글만 사용).
기본값은 **High + Medium ON, Low OFF**(연간 Low 2,919건 노이즈 정리).

## Architecture

- **레이어**: `widgets/economy` (FSD widgets). 상위 레이어 import 없음, 클라 컴포넌트(`'use client'`).
- **신규 컴포넌트**: `ImpactFilter` — segmented toggle 칩 그룹. `widgets/financials/PeriodToggle`의
  `role="group"` + `aria-pressed` 패턴을 미러링하되, **다중 선택**(독립 토글)이라는 점이 다르다
  (PeriodToggle은 단일 택일). 따라서 `value: ReadonlySet<CalendarImpact>` + `onToggle(impact)` 시그니처.
- **상태 소유**: `EconomicCalendarGrid`가 `activeImpacts: Set<CalendarImpact>` 클라 상태(useState)를 소유하고
  `ImpactFilter`에 내려준다. 필터는 prop drilling으로 `MonthCalendar → DayCell`, 그리고
  `DayDetailPanel`까지 전달된다.
- **필터 적용 방식 (핵심 결정)**:
  - **DayCell(점/건수/인라인)**: 비활성 impact의 이벤트를 **미리 제외한 파생 값**으로 렌더한다.
    셀 내용은 SEO에 핵심이 아니다(상세 패널이 전체 이벤트 텍스트를 이미 DOM에 보유). 점/건수/미리보기는
    파생(useMemo 없이 props 기반 계산 — DayCell은 cell당 가벼움)으로 활성 impact만 반영.
    단, **건수가 0이 되어도 날짜 버튼 자체는 유지**(빈 상태 점 없음 + "0건").
  - **DayDetailPanel(상세 목록)**: 모든 `<li>`를 **항상 렌더**하되, impact가 비활성인 항목에
    `hidden` 속성을 부여한다. → DOM에는 남아 크롤러가 색인, 시각·a11y 트리에서는 제거.
    이는 패널 자체가 비선택 시 `hidden`되는 기존 SSR 패턴과 **중첩**된다(패널 hidden ∨ 항목 hidden).
- **결정론/ISR**: `Date.now()`/`new Date()` 무인수 호출 없음(기존 그리드 제약 그대로). 기본 활성 집합은
  module-level 상수에서 파생한 결정론적 초기값.

## Tech Stack

- React 19 (`useState`, `useMemo`, `useEffectEvent` — 기존 그리드와 동일), TypeScript strict.
- `@y0ngha/siglens-core`의 `CalendarImpact`(`'High' | 'Medium' | 'Low'`) 타입.
- Tailwind v4 semantic tokens(`ui-danger-text`, `ui-warning-text`, `secondary-*`, `primary-*`).
- vitest + @testing-library/react (jsdom project — `.test.tsx`는 자동으로 `dom` 프로젝트에서 실행되므로
  `@vitest-environment` 헤더 불필요).

---

## REQUIRED SUB-SKILL: subagent-driven-development

이 계획은 `subagent-driven-development`로 실행한다. 각 TDD 태스크를 독립 sub-agent에 디스패치하고,
태스크 사이에 게이트(tsc/eslint/prettier/vitest)를 통과시킨다.

> 체크박스 표기: 모든 `- [ ]` 항목은 **완료 시 `- [x]`로 표시**한다. 한 태스크의 모든 스텝이
> 끝나고 게이트가 통과해야 다음 태스크로 진행한다. 실패 시 멈추고 보고.

---

## File Structure

| 파일 | 상태 | 책임 |
|---|---|---|
| `src/widgets/economy/sections/ImpactFilter.tsx` | **신규** | 영향도 필터 칩 그룹(`role="group"`, 토글 버튼 `aria-pressed`). 다중 선택, `value`/`onToggle` 제어 컴포넌트. |
| `src/widgets/economy/__tests__/ImpactFilter.test.tsx` | **신규** | ImpactFilter 단위 테스트(렌더·aria-pressed·onToggle·group label). |
| `src/widgets/economy/sections/EconomicCalendarGrid.tsx` | **수정** | `activeImpacts` 상태 추가, `ImpactFilter` 마운트, 필터를 `MonthCalendar`/`DayCell`/`DayDetailPanel`로 전달. DayCell 점/건수/미리보기를 활성 impact로 한정, DayDetailPanel 항목에 `hidden` 부여. |
| `src/widgets/economy/__tests__/EconomicCalendarGrid.test.tsx` | **수정** | 기존 스타일 확장 — 기본 필터 상태, 토글 시 표시 변화, 전체 이벤트 DOM 유지(크롤). |
| `src/widgets/economy/index.ts` | **수정(선택)** | `ImpactFilter`는 그리드 내부 전용이라 barrel export 불필요. **export 추가하지 않음**(내부 컴포넌트). |

> `ImpactFilter`는 `EconomicCalendarGrid` 외부에서 쓰이지 않으므로 barrel(`index.ts`)에
> 노출하지 않는다. 기존 `EconomicCalendarGrid as EconomicCalendar` 단일 진입점을 유지한다.

공유 상수 결정:
- `IMPACT_LABELS`(높음/보통/낮음), `IMPACT_ORDER`(High→Medium→Low)는 현재 `EconomicCalendarGrid.tsx`
  module-level에 있다. `ImpactFilter`도 이 둘이 필요하다. **순환 import를 피하기 위해**,
  두 컴포넌트가 같은 파일 트리에 있으므로 `ImpactFilter.tsx`는 자체 `FILTER_IMPACTS`/`FILTER_LABEL`를
  로컬로 정의한다(작은 중복 < 모듈 분리 오버엔지니어링). 라벨 텍스트는 `IMPACT_LABELS`와 동일하게 맞춘다.
  (만약 리뷰에서 중복 지적 시, `src/widgets/economy/sections/impactMeta.ts` 추출은 후속 정리로 둔다 —
  본 SP-C 범위에서는 동작·테스트가 우선.)

---

## TDD 태스크

각 태스크는 **실패 테스트 작성 → 실패 확인 → 최소 구현 → 통과 확인 → 커밋** 순서다.
명령은 정확한 경로/메시지를 그대로 사용한다.

---

### Task 1 — `ImpactFilter` 컴포넌트 (칩 그룹, 다중 선택)

**Files**
- 신규: `src/widgets/economy/sections/ImpactFilter.tsx`
- 신규: `src/widgets/economy/__tests__/ImpactFilter.test.tsx`

- [ ] **실패 테스트 작성** — `src/widgets/economy/__tests__/ImpactFilter.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CalendarImpact } from '@y0ngha/siglens-core';

import { ImpactFilter } from '@/widgets/economy/sections/ImpactFilter';

const ALL_ON = new Set<CalendarImpact>(['High', 'Medium', 'Low']);
const DEFAULT = new Set<CalendarImpact>(['High', 'Medium']);

describe('ImpactFilter', () => {
    it('High/Medium/Low 칩 3개를 버튼으로 렌더한다', () => {
        render(<ImpactFilter value={ALL_ON} onToggle={vi.fn()} />);
        expect(
            screen.getByRole('button', { name: '높음' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: '보통' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: '낮음' })
        ).toBeInTheDocument();
    });

    it('"중요도 필터" 레이블의 group role로 감싼다', () => {
        render(<ImpactFilter value={ALL_ON} onToggle={vi.fn()} />);
        expect(
            screen.getByRole('group', { name: '중요도 필터' })
        ).toBeInTheDocument();
    });

    it('활성 impact 칩만 aria-pressed=true 다', () => {
        render(<ImpactFilter value={DEFAULT} onToggle={vi.fn()} />);
        expect(
            screen.getByRole('button', { name: '높음' })
        ).toHaveAttribute('aria-pressed', 'true');
        expect(
            screen.getByRole('button', { name: '보통' })
        ).toHaveAttribute('aria-pressed', 'true');
        expect(
            screen.getByRole('button', { name: '낮음' })
        ).toHaveAttribute('aria-pressed', 'false');
    });

    it('칩 클릭 시 해당 impact로 onToggle을 호출한다', () => {
        const onToggle = vi.fn();
        render(<ImpactFilter value={DEFAULT} onToggle={onToggle} />);
        fireEvent.click(screen.getByRole('button', { name: '낮음' }));
        expect(onToggle).toHaveBeenCalledWith('Low');
    });

    it('각 칩 버튼은 type=button 이다 (form submit 방지)', () => {
        render(<ImpactFilter value={ALL_ON} onToggle={vi.fn()} />);
        for (const name of ['높음', '보통', '낮음']) {
            expect(
                screen.getByRole('button', { name })
            ).toHaveAttribute('type', 'button');
        }
    });
});
```

- [ ] **실패 확인 (run-to-fail)**:

```bash
npx vitest run src/widgets/economy/__tests__/ImpactFilter.test.tsx
```

기대: `Failed to resolve import "@/widgets/economy/sections/ImpactFilter"` (모듈 없음) →
5개 테스트 전부 실패.

- [ ] **최소 구현** — `src/widgets/economy/sections/ImpactFilter.tsx`:

```tsx
'use client';

import type { CalendarImpact } from '@y0ngha/siglens-core';

import { cn } from '@/shared/lib/cn';

/** 필터 칩 렌더 순서 — High → Medium → Low (그리드 IMPACT_ORDER와 동일) */
const FILTER_IMPACTS: readonly CalendarImpact[] = ['High', 'Medium', 'Low'];

/** 칩 한국어 레이블 — 그리드 IMPACT_LABELS와 동일하게 유지 */
const FILTER_LABEL: Record<CalendarImpact, string> = {
    High: '높음',
    Medium: '보통',
    Low: '낮음',
};

/** 활성 시 칩 색상 — 그리드 IMPACT_BADGE 색 계열과 일치(임팩트 식별성 유지) */
const FILTER_ACTIVE: Record<CalendarImpact, string> = {
    High: 'border-ui-danger/50 bg-ui-danger/15 text-ui-danger-text',
    Medium: 'border-ui-warning/50 bg-ui-warning/15 text-ui-warning-text',
    Low: 'border-secondary-500 bg-secondary-700 text-secondary-200',
};

interface ImpactFilterProps {
    value: ReadonlySet<CalendarImpact>;
    onToggle: (impact: CalendarImpact) => void;
}

/**
 * 경제 캘린더 중요도(영향도) 필터 — 다중 선택 토글 칩 그룹.
 *
 * `PeriodToggle`의 `role="group"` + `aria-pressed` 패턴을 미러링하되,
 * 단일 택일이 아니라 각 칩을 독립 토글하는 다중 선택이다(`value`는 활성 집합).
 *
 * 시각 필터 전용: 이 컴포넌트는 어떤 이벤트도 DOM에서 제거하지 않는다.
 * 상위 그리드가 `value`를 받아 셀/상세를 시각적으로 한정한다.
 */
export function ImpactFilter({ value, onToggle }: ImpactFilterProps) {
    return (
        <div
            role="group"
            aria-label="중요도 필터"
            className="mb-3 flex items-center gap-2"
        >
            {FILTER_IMPACTS.map(impact => {
                const active = value.has(impact);
                return (
                    <button
                        key={impact}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onToggle(impact)}
                        className={cn(
                            'focus-visible:ring-primary-500 inline-flex min-h-11 touch-manipulation items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none',
                            active
                                ? FILTER_ACTIVE[impact]
                                : 'border-secondary-700 text-secondary-500 hover:text-secondary-300'
                        )}
                    >
                        <span
                            aria-hidden="true"
                            className={cn(
                                'inline-block h-1.5 w-1.5 rounded-full',
                                active
                                    ? 'bg-current'
                                    : 'bg-secondary-600'
                            )}
                        />
                        {FILTER_LABEL[impact]}
                    </button>
                );
            })}
        </div>
    );
}
```

- [ ] **통과 확인 (run-to-pass)**:

```bash
npx vitest run src/widgets/economy/__tests__/ImpactFilter.test.tsx
```

기대: 5 passed.

- [ ] **게이트**:

```bash
npx tsc --noEmit && npx eslint src/widgets/economy/sections/ImpactFilter.tsx src/widgets/economy/__tests__/ImpactFilter.test.tsx && npx prettier --check src/widgets/economy/sections/ImpactFilter.tsx src/widgets/economy/__tests__/ImpactFilter.test.tsx
```

기대: 에러 없음. 포맷 불일치 시 `npx prettier --write <paths>` 후 재확인.

- [ ] **커밋**:

```bash
git add src/widgets/economy/sections/ImpactFilter.tsx src/widgets/economy/__tests__/ImpactFilter.test.tsx
git commit -m "feat(economy): add ImpactFilter chip group for calendar (SP-C)"
```

---

### Task 2 — 그리드에 필터 상태 + `ImpactFilter` 마운트 (DayCell 점/건수 한정)

**Files**
- 수정: `src/widgets/economy/sections/EconomicCalendarGrid.tsx`
- 수정: `src/widgets/economy/__tests__/EconomicCalendarGrid.test.tsx`

이 태스크는 (a) 필터 상태/칩을 그리드에 붙이고, (b) **DayCell의 점·건수·인라인 미리보기**가
활성 impact만 반영하도록 한다. DayDetailPanel 항목 필터는 Task 3에서 다룬다.

- [ ] **실패 테스트 작성** — 기존 `EconomicCalendarGrid.test.tsx` 끝에 describe 블록 추가:

```tsx
describe('EconomicCalendarGrid — 중요도 필터 (기본 상태 · 셀 건수)', () => {
    it('"중요도 필터" group이 렌더된다', () => {
        render(<EconomicCalendarGrid events={[EVENT_A, EVENT_C]} />);
        expect(
            screen.getByRole('group', { name: '중요도 필터' })
        ).toBeInTheDocument();
    });

    it('기본값은 High+Medium ON, Low OFF (칩 aria-pressed)', () => {
        render(<EconomicCalendarGrid events={[EVENT_A, EVENT_B, EVENT_C]} />);
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
        render(<EconomicCalendarGrid events={[EVENT_A, EVENT_B, EVENT_C]} />);
        expect(
            screen.getByRole('button', { name: /6월 20일.*이벤트 2건/ })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /6월 21일.*이벤트 0건/ })
        ).toBeInTheDocument();
    });

    it('Low 칩을 켜면 Low 날짜 셀 건수가 다시 카운트된다', () => {
        render(<EconomicCalendarGrid events={[EVENT_A, EVENT_B, EVENT_C]} />);
        const group = screen.getByRole('group', { name: '중요도 필터' });
        fireEvent.click(within(group).getByRole('button', { name: '낮음' }));
        expect(
            screen.getByRole('button', { name: /6월 21일.*이벤트 1건/ })
        ).toBeInTheDocument();
    });

    it('High 칩을 끄면 High 셀 건수가 줄어든다', () => {
        render(<EconomicCalendarGrid events={[EVENT_A, EVENT_B, EVENT_C]} />);
        const group = screen.getByRole('group', { name: '중요도 필터' });
        // 기본: 6/20 = High(A)+Medium(B) = 2건. High 끄면 Medium만 → 1건.
        fireEvent.click(within(group).getByRole('button', { name: '높음' }));
        expect(
            screen.getByRole('button', { name: /6월 20일.*이벤트 1건/ })
        ).toBeInTheDocument();
    });
});
```

> 위 테스트는 `within`을 사용한다. 파일 상단 import를 확장한다(실패 테스트 작성 시 함께 수정):
> `import { render, screen, fireEvent, within } from '@testing-library/react';`
> (기존 import 라인을 이 라인으로 교체.)

> 주의 — **기존 KST 그룹핑 테스트 회귀 방지**: 기존
> `it('ET 날짜가 다르더라도 같은 KST 날이면 한 그룹으로 묶인다')`는 `[EVENT_A, EVENT_B]`(High+Medium)로
> `이벤트 2건`을 단언한다. 둘 다 기본 활성이므로 셀 건수는 여전히 2건 → **회귀 없음**. 단,
> `it('KST 날이 다른 이벤트는 별도 날짜 버튼으로 렌더된다')`와 기본-선택/SSR 테스트는 `EVENT_C`(Low)를
> 사용한다. 이들은 `aria-label`의 **날짜 부분**(`/6월 21일/`)만 매치하므로 건수 변화(`0건`)에 영향받지
> 않는다 — 정규식이 건수를 포함하지 않으면 통과 유지. 회귀 확인을 위해 Task 2 게이트에서
> **전체 파일**을 돌린다.

- [ ] **실패 확인 (run-to-fail)**:

```bash
npx vitest run src/widgets/economy/__tests__/EconomicCalendarGrid.test.tsx
```

기대: 신규 describe의 5개 테스트 실패(`role="group" name="중요도 필터"` 없음, 셀 건수가 필터 무시).
기존 테스트는 통과 유지(import에 `within` 추가만으로는 깨지지 않음).

- [ ] **최소 구현** — `EconomicCalendarGrid.tsx` 수정:

**(2-1) ImpactFilter import 추가** (파일 상단 import 블록, `etTimeUtils` import 다음 줄):

```tsx
import { ImpactFilter } from '@/widgets/economy/sections/ImpactFilter';
```

**(2-2) 기본 활성 집합 상수** (module-level, `INLINE_EVENT_MAX` 상수 아래에 추가):

```tsx
/**
 * 중요도 필터 기본값 — High+Medium ON, Low OFF.
 * 연간 Low 이벤트가 2,919건으로 대다수라 기본 노출 시 노이즈가 크다(스펙 SP-C).
 * 결정론적 초기값 — 렌더 중 시각/난수 의존 없음(ISR 안전).
 */
const DEFAULT_ACTIVE_IMPACTS: readonly CalendarImpact[] = ['High', 'Medium'];
```

**(2-3) DayCell: 활성 impact prop 수용 + 점/건수/미리보기 한정**.
`DayCellProps`와 `DayCell` 본문을 아래로 교체:

```tsx
interface DayCellProps {
    group: DayGroup;
    isSelected: boolean;
    activeImpacts: ReadonlySet<CalendarImpact>;
    onSelect: (dateKey: string) => void;
}

function DayCell({ group, isSelected, activeImpacts, onSelect }: DayCellProps) {
    const { day, month, dateKey } = group;

    /**
     * 활성 impact만 남긴 이벤트 — 셀의 점·건수·인라인 미리보기에 사용.
     * 시각 필터(셀은 SEO 비핵심, 전체 텍스트는 상세 패널이 DOM에 보유).
     */
    const visibleEvents = group.events.filter(e =>
        activeImpacts.has(e.original.impact)
    );
    const count = visibleEvents.length;

    /**
     * 임팩트 종류 집합 — 점 렌더 순서(High → Medium → Low)를 위해 순서 유지.
     * 동일 날짜에 High가 여러 건이어도 점은 1개만 표시한다(시각적 노이즈 감소).
     */
    const impactSet = new Set(visibleEvents.map(e => e.original.impact));
    const dots = IMPACT_ORDER.filter(i => impactSet.has(i));

    return (
        <td className="p-0.5 align-top">
            <button
                id={`day-btn-${dateKey}`}
                type="button"
                aria-label={`${month + 1}월 ${day}일, 이벤트 ${count}건`}
                aria-pressed={isSelected}
                aria-controls={`panel-${dateKey}`}
                onClick={() => onSelect(dateKey)}
                className={cn(
                    'relative min-h-[4rem] w-full rounded-lg p-1 text-left text-xs transition-colors',
                    'focus-visible:ring-primary-500 focus-visible:ring-2 focus-visible:outline-none',
                    'motion-reduce:transition-none',
                    isSelected
                        ? 'bg-primary-900/30 ring-primary-500 ring-2'
                        : 'hover:bg-secondary-700/40'
                )}
            >
                <span
                    className={cn(
                        'block text-right text-[11px] leading-none tabular-nums',
                        isSelected
                            ? 'text-primary-400 font-semibold'
                            : 'text-secondary-200 font-medium'
                    )}
                >
                    {day}
                </span>

                <span
                    aria-hidden="true"
                    className="mt-1 flex flex-wrap gap-0.5"
                >
                    {dots.map(impact => (
                        <span
                            key={impact}
                            className={cn(
                                'inline-block h-1.5 w-1.5 rounded-full',
                                IMPACT_DOT[impact]
                            )}
                        />
                    ))}
                </span>

                <span className="text-secondary-300 mt-0.5 block text-[10px] tabular-nums">
                    {count}건
                </span>

                <span className="mt-1 hidden space-y-0.5 sm:block">
                    {visibleEvents.slice(0, INLINE_EVENT_MAX).map(ev => (
                        <span
                            key={`${ev.iso}:${ev.original.event}`}
                            className="text-secondary-400 block min-w-0 truncate text-[10px] leading-tight"
                        >
                            {ev.kstTimeLabel.replace(/^(오전|오후)\s*/, '')}{' '}
                            {ev.original.event}
                        </span>
                    ))}
                    {count > INLINE_EVENT_MAX && (
                        <span className="text-secondary-500 block text-[10px]">
                            +{count - INLINE_EVENT_MAX}
                        </span>
                    )}
                </span>
            </button>
        </td>
    );
}
```

**(2-4) MonthCalendar: activeImpacts 통과**.
`MonthCalendarProps`에 `activeImpacts` 추가하고, 구조분해·`DayCell` 호출에 전달:

```tsx
interface MonthCalendarProps {
    year: number;
    /** 0-indexed */
    month: number;
    groupMap: Map<string, DayGroup>;
    selectedDateKey: string;
    activeImpacts: ReadonlySet<CalendarImpact>;
    onSelect: (dateKey: string) => void;
}

function MonthCalendar({
    year,
    month,
    groupMap,
    selectedDateKey,
    activeImpacts,
    onSelect,
}: MonthCalendarProps) {
```

그리고 `MonthCalendar` 본문의 `<DayCell ... />` 호출에 `activeImpacts={activeImpacts}` 추가:

```tsx
                                    <DayCell
                                        key={cell.dateKey}
                                        group={cell}
                                        isSelected={
                                            selectedDateKey === cell.dateKey
                                        }
                                        activeImpacts={activeImpacts}
                                        onSelect={onSelect}
                                    />
```

**(2-5) `EconomicCalendarGrid`: 필터 상태 + 칩 마운트 + MonthCalendar에 전달**.
컴포넌트 본문 hook 영역(§17 순서 준수: useState → useMemo → useEffectEvent → useEffect 순)에
`activeImpacts` 상태와 `toggleImpact` 핸들러를 추가한다.

기존:

```tsx
export function EconomicCalendarGrid({ events }: EconomicCalendarGridProps) {
    const [selectedDateKey, setSelectedDateKey] = useState('');
    const groups = useMemo(() => groupEventsByKstDay(events), [events]);
```

로 시작하는 부분을 아래로 교체(상태 1개 추가):

```tsx
export function EconomicCalendarGrid({ events }: EconomicCalendarGridProps) {
    const [selectedDateKey, setSelectedDateKey] = useState('');
    const [activeImpacts, setActiveImpacts] = useState<
        ReadonlySet<CalendarImpact>
    >(() => new Set(DEFAULT_ACTIVE_IMPACTS));
    const groups = useMemo(() => groupEventsByKstDay(events), [events]);
```

핸들러는 hook 순서상 useEffect **이전**(derived/handlers 구간)에 둔다. 기존 `useEffect(...)` **위**에
`toggleImpact`를 추가한다(setState만 호출하므로 useCallback 불필요 — 안정 참조가 필요한 의존성 없음):

```tsx
    const months = useMemo(() => spannedMonths(groups), [groups]);

    function toggleImpact(impact: CalendarImpact): void {
        setActiveImpacts(prev => {
            const next = new Set(prev);
            if (next.has(impact)) {
                next.delete(impact);
            } else {
                next.add(impact);
            }
            return next;
        });
    }

    const syncDefault = useEffectEvent((): void => {
```

> §17 순서: `useState ×2 → useMemo ×3 → const toggleImpact(handler) → useEffectEvent → useEffect`.
> `toggleImpact`는 파생/핸들러 구간(useMemo 뒤, useEffect 앞)이므로 순서 위반 아님.
> `toggleImpact`는 effect 의존성에 들어가지 않으므로 `useEffectEvent`/`useCallback` 불필요.

**JSX 변경 1 — `ImpactFilter` 마운트**: `<h2>` 닫는 태그 다음, 캘린더 `<div className="border-...">`
**앞**에 칩을 둔다:

```tsx
            <ImpactFilter value={activeImpacts} onToggle={toggleImpact} />

            <div className="border-secondary-700 space-y-6 rounded-xl border p-3 sm:p-4">
```

**JSX 변경 2 — `MonthCalendar`에 activeImpacts 전달**:

```tsx
                    <MonthCalendar
                        key={`${year}-${month}`}
                        year={year}
                        month={month}
                        groupMap={groupMap}
                        selectedDateKey={selectedDateKey}
                        activeImpacts={activeImpacts}
                        onSelect={setSelectedDateKey}
                    />
```

> **빈 상태 분기 주의**: `if (events.length === 0)` early-return은 그대로 둔다. 필터 칩은
> 이벤트가 0건이면 의미 없으므로 빈 상태에는 렌더하지 않는다(기존 빈 상태 블록 미변경).

- [ ] **통과 확인 (run-to-pass)**:

```bash
npx vitest run src/widgets/economy/__tests__/EconomicCalendarGrid.test.tsx
```

기대: 신규 5 + 기존 전부 passed(회귀 0). `0건` 단언이 통과하는지 확인.

- [ ] **게이트**:

```bash
npx tsc --noEmit && npx eslint src/widgets/economy/sections/EconomicCalendarGrid.tsx src/widgets/economy/__tests__/EconomicCalendarGrid.test.tsx && npx prettier --check src/widgets/economy/sections/EconomicCalendarGrid.tsx src/widgets/economy/__tests__/EconomicCalendarGrid.test.tsx
```

기대: 에러 없음.

- [ ] **커밋**:

```bash
git add src/widgets/economy/sections/EconomicCalendarGrid.tsx src/widgets/economy/__tests__/EconomicCalendarGrid.test.tsx
git commit -m "feat(economy): wire impact filter state to calendar cells (SP-C)"
```

---

### Task 3 — `DayDetailPanel` 항목 시각 필터 (`hidden`, DOM 유지)

**Files**
- 수정: `src/widgets/economy/sections/EconomicCalendarGrid.tsx`
- 수정: `src/widgets/economy/__tests__/EconomicCalendarGrid.test.tsx`

상세 패널의 각 이벤트 `<li>`를 항상 렌더하되, impact가 비활성이면 `hidden` 속성을 부여한다.
→ 크롤러는 전체 텍스트 색인(DOM 유지), 사용자/스크린리더는 활성 impact만 본다.

- [ ] **실패 테스트 작성** — `EconomicCalendarGrid.test.tsx`에 describe 추가:

```tsx
describe('EconomicCalendarGrid — 중요도 필터 (상세 패널 · DOM 유지)', () => {
    it('비활성 impact 이벤트도 상세 패널 DOM에 남는다 (크롤러 색인)', () => {
        // EVENT_C(Low) → KST 6/21. 기본 필터 Low OFF.
        // 6/21을 선택해 패널을 열어도, Low 항목은 hidden이지만 DOM엔 존재해야 한다.
        const { container } = render(
            <EconomicCalendarGrid events={[EVENT_A, EVENT_B, EVENT_C]} />
        );
        const group = screen.getByRole('group', { name: '중요도 필터' });
        // 패널을 열기 위해 6/21 날짜 버튼 클릭(Low 칩은 여전히 OFF)
        fireEvent.click(screen.getByRole('button', { name: /6월 21일/ }));
        // Low 칩 OFF 상태이므로 화면(getByText)에는 안 보이지만 DOM엔 있다.
        expect(container.textContent).toContain('Unemployment Claims');
        // 해당 li가 hidden 인지 확인
        const li = screen
            .getByText('Unemployment Claims')
            .closest('li');
        expect(li).toHaveAttribute('hidden');
        // group 변수는 아래 토글 테스트와 대칭을 위해 참조(미사용 경고 방지)
        expect(group).toBeInTheDocument();
    });

    it('활성 impact 이벤트의 상세 li는 hidden이 아니다', () => {
        // EVENT_A(High) → KST 6/20, 기본 선택 + High 활성.
        render(<EconomicCalendarGrid events={[EVENT_A, EVENT_B, EVENT_C]} />);
        const li = screen.getByText('Fed Rate Decision').closest('li');
        expect(li).not.toHaveAttribute('hidden');
    });

    it('Low 칩을 켜면 상세 패널의 Low li에서 hidden이 사라진다', () => {
        render(<EconomicCalendarGrid events={[EVENT_A, EVENT_B, EVENT_C]} />);
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
        render(<EconomicCalendarGrid events={[EVENT_A, EVENT_B, EVENT_C]} />);
        const group = screen.getByRole('group', { name: '중요도 필터' });
        // 기본: Medium ON → CPI Release li는 hidden 아님
        expect(
            screen.getByText('CPI Release').closest('li')
        ).not.toHaveAttribute('hidden');
        fireEvent.click(within(group).getByRole('button', { name: '보통' }));
        expect(
            screen.getByText('CPI Release').closest('li')
        ).toHaveAttribute('hidden');
    });
});
```

> 주의: `screen.getByText`는 `hidden` 요소도 매치한다(기본 `ignore: 'style'`만, `hidden` 속성은
> jsdom에서 텍스트 조회 자체를 막지 않는다 — `getByRole`만 hidden을 제외). 따라서 hidden li의
> 텍스트도 `getByText`로 잡힌다. 위 테스트는 이를 전제로 한다(검증 완료 패턴: 기존 SSR 테스트는
> hidden 패널 텍스트를 `container.textContent`로 확인하지만, `getByText`도 hidden li 텍스트를 찾는다).

- [ ] **실패 확인 (run-to-fail)**:

```bash
npx vitest run src/widgets/economy/__tests__/EconomicCalendarGrid.test.tsx
```

기대: 신규 4개 실패(`<li>`에 `hidden` 속성 없음 — 현재 패널은 모든 항목을 무조건 표시).

- [ ] **최소 구현** — `EconomicCalendarGrid.tsx`의 `DayDetailPanel` 수정.

**(3-1) `DayDetailPanelProps`에 `activeImpacts` 추가**:

```tsx
interface DayDetailPanelProps {
    group: DayGroup;
    isSelected: boolean;
    activeImpacts: ReadonlySet<CalendarImpact>;
}

function DayDetailPanel({
    group,
    isSelected,
    activeImpacts,
}: DayDetailPanelProps) {
```

**(3-2) `<li>`에 `hidden` 속성 부여** — `group.events.map(ev => (` 의 `<li>` 여는 태그를 교체.
기존:

```tsx
                {group.events.map(ev => (
                    <li
                        key={`${ev.iso}:${ev.original.event}:${ev.original.actual ?? ''}`}
                        className="border-secondary-700 bg-secondary-800/50 rounded-lg border p-3"
                    >
```

교체 후:

```tsx
                {group.events.map(ev => (
                    <li
                        key={`${ev.iso}:${ev.original.event}:${ev.original.actual ?? ''}`}
                        hidden={!activeImpacts.has(ev.original.impact)}
                        className="border-secondary-700 bg-secondary-800/50 rounded-lg border p-3"
                    >
```

> **시각 필터 / DOM 유지 원칙**: 조건부 렌더(`{cond && <li>}`)나 배열 `.filter()`로 항목을
> 제거하지 **않는다**. `hidden` 속성만 토글 → 크롤러는 전체 이벤트 텍스트를 색인하고,
> 사용자·스크린리더(a11y 트리)는 활성 impact만 본다. 이는 비선택 패널을 `hidden`으로 유지하는
> 기존 SSR 패턴과 동일한 철학이며, 패널-레벨 `hidden`과 항목-레벨 `hidden`이 OR로 중첩된다.

**(3-3) `EconomicCalendarGrid` 본문의 `<DayDetailPanel ... />` 호출에 `activeImpacts` 전달**:

```tsx
                {groups.map(group => (
                    <DayDetailPanel
                        key={group.dateKey}
                        group={group}
                        isSelected={group.dateKey === selectedDateKey}
                        activeImpacts={activeImpacts}
                    />
                ))}
```

- [ ] **통과 확인 (run-to-pass)**:

```bash
npx vitest run src/widgets/economy/__tests__/EconomicCalendarGrid.test.tsx
```

기대: 신규 4 + Task 2 신규 5 + 기존 전부 passed.

> **기존 SSR 테스트 회귀 확인**: 기존
> `it('비선택 패널은 hidden 속성을 가진다')` 등은 **패널 div**(`#panel-...`)의 hidden을 확인하지,
> li의 hidden과 무관 → 영향 없음. 기존 `it('임팩트 뱃지 한국어 레이블 표시 (High → 높음)')`는
> `[EVENT_A]`(High 단건)로 `getAllByText('높음')` 길이 1을 단언한다. **주의**: 이제 화면에
> `ImpactFilter` 칩 "높음"이 추가로 렌더된다 → `getAllByText('높음')`이 **2개**(칩 + 뱃지)로 잡혀
> **회귀**한다. → 아래 (3-4)에서 이 기존 테스트를 수정한다.

**(3-4) 기존 테스트 회귀 수정** — `EconomicCalendarGrid.test.tsx`의
`it('임팩트 뱃지 한국어 레이블 표시 (High → 높음)')`를 칩과 뱃지를 구분하도록 교체. 기존:

```tsx
    it('임팩트 뱃지 한국어 레이블 표시 (High → 높음)', () => {
        render(<EconomicCalendarGrid events={[EVENT_A]} />);
        // EVENT_A 1건(High) → 상세 패널에 뱃지 1개만 렌더됨
        expect(screen.getAllByText('높음')).toHaveLength(1);
    });
```

교체 후 (필터 칩의 "높음" 버튼을 제외하고 패널 뱃지 span만 검증):

```tsx
    it('임팩트 뱃지 한국어 레이블 표시 (High → 높음)', () => {
        render(<EconomicCalendarGrid events={[EVENT_A]} />);
        // 화면에는 필터 칩 "높음"(button)과 상세 뱃지 "높음"(span)이 함께 존재.
        // 뱃지만 검증하기 위해 button role을 제외한 매치를 센다.
        const highLabels = screen.getAllByText('높음');
        const badges = highLabels.filter(
            el => el.closest('button') === null
        );
        expect(badges).toHaveLength(1);
    });
```

> 이 회귀는 Task 2에서 칩이 마운트되는 시점부터 발생할 수 있다. 만약 Task 2 게이트의 전체-파일
> 실행에서 이 단언이 먼저 깨지면, (3-4) 수정을 **Task 2로 앞당겨** 적용한다. 계획상 분리해 두었으나
> 실행 시 깨지는 시점에 맞춰 고친다(둘 다 같은 수정).

- [ ] **게이트**:

```bash
npx tsc --noEmit && npx eslint src/widgets/economy/sections/EconomicCalendarGrid.tsx src/widgets/economy/__tests__/EconomicCalendarGrid.test.tsx && npx prettier --check src/widgets/economy/sections/EconomicCalendarGrid.tsx src/widgets/economy/__tests__/EconomicCalendarGrid.test.tsx
```

기대: 에러 없음.

- [ ] **전체 economy 위젯 스위트 회귀 확인**:

```bash
npx vitest run src/widgets/economy
```

기대: 모든 economy 테스트 passed(필터 회귀 0).

- [ ] **커밋**:

```bash
git add src/widgets/economy/sections/EconomicCalendarGrid.tsx src/widgets/economy/__tests__/EconomicCalendarGrid.test.tsx
git commit -m "feat(economy): visually filter detail panel items by impact, keep in DOM (SP-C)"
```

---

### Task 4 — 최종 게이트 (tsc/eslint/prettier 전역) + 빌드 sanity

**Files**: 없음(검증 전용).

- [ ] **타입 + 린트 + 포맷 전역**:

```bash
npx tsc --noEmit && yarn lint && npx prettier --check "src/widgets/economy/**/*.{ts,tsx}"
```

기대: 에러 없음. (eslint-disable 금지 §13 — 어떤 suppression도 추가하지 않았는지 확인.)

- [ ] **전체 단위 테스트(dom project) 회귀**:

```bash
npx vitest run
```

기대: 전 스위트 passed.

> `yarn build`는 SP-C가 클라 컴포넌트 prop/상태만 바꾸므로 RSC/ISR 경계에 영향 없음. 다만 안전을 위해
> 시간 여유가 있으면 `yarn build`로 prerender 회귀가 없는지 1회 확인(선택). 이 단계에서 빌드 실패 시
> exit code를 파이프 없이 직접 캡처(`> /tmp/b.log 2>&1; echo $?`).

- [ ] **커밋 없음** — Task 4는 검증만. 게이트 실패 시 멈추고 보고.

---

## 375px 친화 / 디자인 노트

- 칩 3개(`높음/보통/낮음`) + `gap-2` + `rounded-full px-3` 는 375px 폭에서 한 줄에 충분히 들어간다
  (각 칩 ≈ 60–72px). 넘칠 우려 시 칩 컨테이너에 `flex-wrap`은 추가하지 않는다(현재 3개 고정 폭이라
  불필요). 만약 SP-B(긴 라벨)와 결합돼도 칩 라벨은 고정 2글자라 영향 없음.
- 터치 타깃: 칩 `min-h-11`(44px) — WCAG 터치 타깃 충족(PeriodToggle과 동일).
- `focus-visible:ring-2` + `motion-reduce:transition-none` — 기존 그리드/토글 컨벤션과 일치.
- semantic token만 사용(`ui-danger-text`/`ui-warning-text`/`secondary-*`/`primary-*`), 하드코딩 색 없음.

---

## MISTAKES.md 준수 체크

- **§17 hook 순서**: `EconomicCalendarGrid`는 `useState ×2 → useMemo ×3 → const toggleImpact(handler)
  → useEffectEvent → useEffect`. 파생/핸들러가 useMemo 뒤·useEffect 앞 — 위반 없음.
- **§13 eslint-disable 금지**: 어떤 suppression도 없음.
- **named return type**: `toggleImpact(impact): void`, `syncDefault(): void`(기존), `DayCell`/`ImpactFilter`
  props 인터페이스 명시.
- **WHAT 주석 금지**: 추가 주석은 전부 WHY(필터 철학·DOM 유지 이유·기본값 근거). WHAT 나열 없음.
- **useMemo for derived**: DayCell의 `visibleEvents`/`dots`는 **셀당 가벼운 파생**이라 const 유지(기존
  `dots`도 const였음 — 일관). 그리드-레벨 무거운 파생(`groups`/`groupMap`/`months`)은 기존 useMemo 유지.
  필터는 이들 입력(events)을 바꾸지 않으므로 재계산 안 일어남(셀 렌더 시점 필터링만).
- **set-state-in-effect**: `toggleImpact`는 effect가 아닌 onClick 핸들러 → 규칙 무관. 기존 `syncDefault`
  (useEffectEvent) 패턴 미변경.
- **exact test assertions**: 모든 단언은 정확값(`이벤트 0건`, `aria-pressed`, `hidden` 유무, `closest('li')`).
- **role correctness**: 칩 그룹 `role="group" aria-label="중요도 필터"`, 칩 토글 `aria-pressed`(다중 선택엔
  radio/tab 부적절 — 독립 toggle은 `aria-pressed` 버튼이 정석). 고아 ARIA 없음.

---

## Self-Review — 스펙(SP-C) 커버리지 확인

| 스펙 요구 | 충족 위치 |
|---|---|
| 상단 영향도 필터 칩(High/Medium/Low 토글) | `ImpactFilter` (Task 1), 그리드 `<h2>` 아래 마운트 (Task 2) |
| 클라 상태(useState) | `EconomicCalendarGrid`의 `activeImpacts` useState (Task 2) |
| 기본값 High+Medium ON, Low OFF | `DEFAULT_ACTIVE_IMPACTS = ['High','Medium']` + 테스트로 aria-pressed 검증 (Task 2) |
| 셀 점/건수를 선택 impact로 한정 | DayCell `visibleEvents` 필터 → 점·`count`·인라인 미리보기 (Task 2) |
| 상세 목록을 선택 impact로 한정 | DayDetailPanel `<li hidden>` (Task 3) |
| 전체 이벤트 DOM 유지(SSR 크롤) — 시각 필터, `hidden`-toggle | li 제거 대신 `hidden` 속성만, `container.textContent` 색인 테스트 (Task 3) |
| 기존 SSR 패턴과 reconcile(패널 hidden + 항목 hidden 중첩) | DayDetailPanel 패널-div hidden(기존) ∨ li hidden(신규) — 양립 (Task 3 주석) |
| a11y: 칩 `aria-pressed`, group `role="group" aria-label="중요도 필터"` | `ImpactFilter` (Task 1) |
| motion-reduce / focus-visible:ring-2 / semantic token | `ImpactFilter` className (Task 1) |
| 테스트: 기본 필터 상태·토글 시 변화·전체 DOM 유지 | Task 1·2·3 테스트 일체 |
| MISTAKES.md(§17 등) 준수 | 위 "MISTAKES.md 준수 체크" 전 항목 |
| 375px 친화 | "375px 친화" 노트 — `min-h-11`, 3 고정칩 1줄 |
| SP-A 무의존 독립 ship | 그리드 props 무변경(`events`만), DB/페이지 변경 없음 — #610만으로 동작 |

**누락/리스크**:
- `getAllByText('높음')` 회귀(칩+뱃지) — Task 3 (3-4)에서 명시적으로 고침(실행 시 Task 2에서 먼저
  깨지면 앞당김).
- `ImpactFilter` 라벨/순서 상수가 그리드 `IMPACT_LABELS`/`IMPACT_ORDER`와 중복 — 의도적 결정(소규모
  중복 < 모듈 추출 오버엔지니어링). 리뷰에서 강하게 요구되면 `impactMeta.ts` 추출은 후속.
- 모든 칩 OFF 시 캘린더가 전부 "0건"이 되는 빈 그리드 — 의도된 동작(사용자 선택), 별도 빈-상태 안내는
  스펙 범위 밖이라 추가하지 않음(필요 시 후속 UX).
