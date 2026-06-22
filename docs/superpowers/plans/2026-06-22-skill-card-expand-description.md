# AI 분석 스킬 카드 설명 클릭 펼침 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메인 페이지 "AI 분석 스킬" 카드에서 `line-clamp-2`로 잘린 설명을, 카드 클릭(아코디언) 시 인라인으로 펼쳐 전체를 보여준다.

**Architecture:** `useSkillsShowcase` 훅에 `expandedKey` 아코디언 상태를 추가하고, `SkillCard`를 controlled 컴포넌트(`isExpanded` + `onToggleExpand` props)로 전환한다. 카드 내부에서 설명 클램프 발생 여부를 DOM 측정(`useIsClamped`)으로 판정해, 펼칠 수 있는 카드에만 인터랙션·호버 모션을 부여한다.

**Tech Stack:** React 19 / Next.js 16 client component, Tailwind v4, Vitest + Testing Library (jsdom), Playwright(선택).

---

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `src/widgets/home/hooks/useSkillsShowcase.ts` | 탭·showAll·**펼침** 상태 관리 | Modify |
| `src/widgets/home/hooks/useIsClamped.ts` | 설명 `<p>`의 클램프 발생 여부 DOM 측정 + 순수 판정 helper | **Create** |
| `src/widgets/home/SkillsShowcase.tsx` | 섹션·카드 렌더. `SkillCard`를 controlled로, 그리드 `items-start` | Modify |
| `src/widgets/home/__tests__/hooks/useSkillsShowcase.test.ts` | 훅 테스트 | Modify |
| `src/widgets/home/__tests__/hooks/useIsClamped.test.ts` | 클램프 판정 테스트 | **Create** |
| `src/widgets/home/__tests__/SkillsShowcase.test.tsx` | 컴포넌트/카드 테스트 | Modify |
| `e2e/skills-expand.spec.ts` | (선택) happy-path E2E | Create |

**핵심 설계 결정 (스펙 §3~§5 반영):**

- **펼침 식별자 = `skill.name`** — `SkillShowcaseItem`에 안정적 id가 없고, 파일 기반 로더에서 스킬 name은 유일. 렌더 `key`도 이미 `skill.name`이라 일관됨.
- **clamp 측정은 접힘 상태에서만** — 펼치면 `scrollHeight == clientHeight`가 되어 판정이 뒤집힌다. 측정 effect를 `enabled = !isExpanded`로 게이트하고, 펼침 중에는 직전 `isClamped` 값을 유지한다.
- **루트는 `role="button"` + `tabIndex` div** (진짜 `<button>` 아님) — 카드 내부에 신뢰도 `ⓘ` 버튼이 있어, 루트를 `<button>`으로 만들면 nested interactive(HTML invalid)가 된다. 따라서 펼침 가능 카드는 `role="button"`/`tabIndex={0}`/키보드 핸들러를 단 div로 만들고, `ⓘ` 버튼은 `stopPropagation`으로 분리한다. (role=button 안의 button도 엄밀히는 권장되지 않지만, stopPropagation으로 동작이 분리되고 레이아웃 변경을 최소화하는 현실적 타협 — 코드에 주석으로 명시.)

---

### Task 1: `useSkillsShowcase` — 펼침(아코디언) 상태 추가

**Files:**
- Modify: `src/widgets/home/hooks/useSkillsShowcase.ts`
- Test: `src/widgets/home/__tests__/hooks/useSkillsShowcase.test.ts`

- [ ] **Step 1: 실패하는 테스트 추가**

`src/widgets/home/__tests__/hooks/useSkillsShowcase.test.ts`의 `describe('useSkillsShowcase', ...)` 블록 안, 마지막 `it` 뒤에 추가:

```ts
    it('initializes with expandedKey=null', () => {
        const { result } = renderHook(() => useSkillsShowcase());

        expect(result.current.expandedKey).toBeNull();
    });

    it('sets expandedKey on toggleExpanded', () => {
        const { result } = renderHook(() => useSkillsShowcase());

        act(() => result.current.toggleExpanded('RSI'));

        expect(result.current.expandedKey).toBe('RSI');
    });

    it('collapses when the same key is toggled again', () => {
        const { result } = renderHook(() => useSkillsShowcase());

        act(() => result.current.toggleExpanded('RSI'));
        act(() => result.current.toggleExpanded('RSI'));

        expect(result.current.expandedKey).toBeNull();
    });

    it('switches expansion to another key (accordion — only one open)', () => {
        const { result } = renderHook(() => useSkillsShowcase());

        act(() => result.current.toggleExpanded('RSI'));
        act(() => result.current.toggleExpanded('MACD'));

        expect(result.current.expandedKey).toBe('MACD');
    });

    it('resets expandedKey when switching tabs', () => {
        const { result } = renderHook(() => useSkillsShowcase());

        act(() => result.current.toggleExpanded('RSI'));
        act(() => result.current.handleTabSelect('pattern'));

        expect(result.current.expandedKey).toBeNull();
    });

    it('resets expandedKey when toggling showAll', () => {
        const { result } = renderHook(() => useSkillsShowcase());

        act(() => result.current.toggleExpanded('RSI'));
        act(() => result.current.toggleShowAll());

        expect(result.current.expandedKey).toBeNull();
    });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn test src/widgets/home/__tests__/hooks/useSkillsShowcase.test.ts`
Expected: FAIL — `result.current.expandedKey` is `undefined`, `toggleExpanded is not a function`.

- [ ] **Step 3: 훅 구현**

`src/widgets/home/hooks/useSkillsShowcase.ts` 전체를 아래로 교체:

```ts
'use client';

import { useCallback, useId, useState } from 'react';
import type { SkillType } from '@y0ngha/siglens-core';

export type SkillsActiveTab = 'all' | SkillType;

interface UseSkillsShowcaseReturn {
    activeTab: SkillsActiveTab;
    showAll: boolean;
    expandedKey: string | null;
    baseId: string;
    handleTabSelect: (value: SkillsActiveTab) => void;
    toggleShowAll: () => void;
    toggleExpanded: (key: string) => void;
}

export function useSkillsShowcase(): UseSkillsShowcaseReturn {
    const [activeTab, setActiveTab] = useState<SkillsActiveTab>('all');
    const [showAll, setShowAll] = useState(false);
    const [expandedKey, setExpandedKey] = useState<string | null>(null);
    const baseId = useId();

    const handleTabSelect = useCallback((value: SkillsActiveTab): void => {
        setActiveTab(value);
        setShowAll(false);
        // 탭을 바꾸면 펼쳐진 카드가 숨겨진 채 상태에 남지 않도록 초기화.
        setExpandedKey(null);
    }, []);

    const toggleShowAll = useCallback((): void => {
        setShowAll(prev => !prev);
        // "더 보기/접기"로 카드 집합이 바뀌므로 펼침 상태도 초기화.
        setExpandedKey(null);
    }, []);

    // 아코디언: 같은 key면 닫고, 다른 key면 그 카드로 교체(한 번에 하나만 펼침).
    const toggleExpanded = useCallback((key: string): void => {
        setExpandedKey(prev => (prev === key ? null : key));
    }, []);

    return {
        activeTab,
        showAll,
        expandedKey,
        baseId,
        handleTabSelect,
        toggleShowAll,
        toggleExpanded,
    };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn test src/widgets/home/__tests__/hooks/useSkillsShowcase.test.ts`
Expected: PASS (기존 5개 + 신규 6개).

- [ ] **Step 5: 커밋**

```bash
git add src/widgets/home/hooks/useSkillsShowcase.ts src/widgets/home/__tests__/hooks/useSkillsShowcase.test.ts
git commit -m "feat: useSkillsShowcase에 카드 펼침(아코디언) 상태 추가"
```

---

### Task 2: `useIsClamped` — 설명 클램프 감지 훅 + 순수 판정 helper

**Files:**
- Create: `src/widgets/home/hooks/useIsClamped.ts`
- Test: `src/widgets/home/__tests__/hooks/useIsClamped.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/widgets/home/__tests__/hooks/useIsClamped.test.ts` 생성:

```ts
// @vitest-environment jsdom
import { isElementClamped } from '../../hooks/useIsClamped';

describe('isElementClamped', () => {
    function fakeEl(scrollHeight: number, clientHeight: number): HTMLElement {
        return { scrollHeight, clientHeight } as HTMLElement;
    }

    it('returns true when content overflows the clamped box', () => {
        expect(isElementClamped(fakeEl(80, 40))).toBe(true);
    });

    it('returns false when content fits within the box', () => {
        expect(isElementClamped(fakeEl(40, 40))).toBe(false);
    });

    it('tolerates 1px sub-pixel rounding (not clamped)', () => {
        expect(isElementClamped(fakeEl(41, 40))).toBe(false);
    });

    it('returns false for null element', () => {
        expect(isElementClamped(null)).toBe(false);
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn test src/widgets/home/__tests__/hooks/useIsClamped.test.ts`
Expected: FAIL — `Cannot find module '../../hooks/useIsClamped'`.

- [ ] **Step 3: 훅 구현**

`src/widgets/home/hooks/useIsClamped.ts` 생성:

```ts
'use client';

import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * 요소가 (line-clamp 등으로) 잘려 내용이 넘치는지 판정하는 순수 함수.
 * `scrollHeight`(전체 콘텐츠 높이) > `clientHeight`(보이는 높이)이면 클램프된 것.
 * 서브픽셀 반올림으로 1px 정도 차이가 날 수 있어 여유분 1px을 둔다.
 */
export function isElementClamped(el: HTMLElement | null): boolean {
    if (el == null) return false;
    return el.scrollHeight > el.clientHeight + 1;
}

interface UseIsClampedReturn {
    ref: RefObject<HTMLParagraphElement | null>;
    isClamped: boolean;
}

/**
 * 설명 단락의 클램프 발생 여부를 측정한다.
 *
 * 측정은 **접힌(클램프된) 상태에서만** 유효하다 — 펼쳐지면 clamp가 풀려
 * `scrollHeight == clientHeight`가 되어 판정이 뒤집히기 때문이다. 따라서
 * `enabled`(= 접힘 상태)일 때만 측정하고, 펼침 중에는 직전 값을 유지한다.
 * 카드 폭 변화(반응형 브레이크포인트·창 리사이즈)는 ResizeObserver로 재측정한다.
 */
export function useIsClamped(enabled: boolean): UseIsClampedReturn {
    const ref = useRef<HTMLParagraphElement>(null);
    const [isClamped, setIsClamped] = useState(false);

    useLayoutEffect(() => {
        if (!enabled) return;
        const el = ref.current;
        if (el == null) return;

        const measure = (): void => {
            setIsClamped(isElementClamped(el));
        };
        measure();

        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, [enabled]);

    return { ref, isClamped };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn test src/widgets/home/__tests__/hooks/useIsClamped.test.ts`
Expected: PASS (4개).

- [ ] **Step 5: 커밋**

```bash
git add src/widgets/home/hooks/useIsClamped.ts src/widgets/home/__tests__/hooks/useIsClamped.test.ts
git commit -m "feat: 설명 클램프 감지 훅 useIsClamped 추가"
```

---

### Task 3: `SkillCard` — controlled 펼침 카드로 전환 (export + 인터랙션 + 모션)

**Files:**
- Modify: `src/widgets/home/SkillsShowcase.tsx:134-185` (SkillCard) — `ConfidenceInfoTooltip`에 `stopPropagation`도 추가
- Test: `src/widgets/home/__tests__/SkillsShowcase.test.tsx`

- [ ] **Step 1: `ConfidenceInfoTooltip`의 클릭 버블링 차단**

`SkillsShowcase.tsx`의 `ConfidenceInfoTooltip` `<button>` `onClick`(현재 `onClick={toggle}`, line 105)을 교체:

```tsx
                onClick={e => {
                    // 카드 펼침 토글로 버블링되지 않게 — ⓘ는 신뢰도 설명 전용.
                    e.stopPropagation();
                    toggle();
                }}
```

- [ ] **Step 2: 실패하는 카드 테스트 작성**

`SkillsShowcase.test.tsx` 파일에서:

(2-1) 상단 import에 `SkillCard`를 추가 — line 53을 교체:

```tsx
import { SkillCard, SkillsShowcase, SkillsShowcaseSkeleton } from '../SkillsShowcase';
```

(2-2) `useSkillsShowcase` mock(line 37-45)에 펼침 필드를 추가 — 객체를 교체:

```tsx
vi.mock('../hooks/useSkillsShowcase', () => ({
    useSkillsShowcase: () => ({
        activeTab: 'all',
        showAll: false,
        expandedKey: null,
        baseId: 'skills',
        handleTabSelect: vi.fn(),
        toggleShowAll: vi.fn(),
        toggleExpanded: vi.fn(),
    }),
}));
```

(2-3) 파일 맨 끝에 새 describe 블록 추가. clamp 측정을 제어하기 위해 `scrollHeight`/`clientHeight`를 stub하고 `ResizeObserver`를 mock한다:

```tsx
describe('SkillCard expand interaction', () => {
    const ORIGINAL = Object.getOwnPropertyDescriptors(HTMLElement.prototype);

    function stubClamp(clamped: boolean): void {
        // 접힘 상태에서 scrollHeight > clientHeight 이면 "펼침 가능"으로 판정됨.
        Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
            configurable: true,
            get: () => (clamped ? 80 : 40),
        });
        Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
            configurable: true,
            get: () => 40,
        });
    }

    beforeAll(() => {
        vi.stubGlobal(
            'ResizeObserver',
            class {
                observe = vi.fn();
                unobserve = vi.fn();
                disconnect = vi.fn();
            }
        );
    });

    afterAll(() => {
        vi.unstubAllGlobals();
        Object.defineProperties(HTMLElement.prototype, ORIGINAL);
    });

    it('is interactive (role=button, aria-expanded) when the description is clamped', () => {
        stubClamp(true);
        render(
            <SkillCard
                skill={makeSkill('RSI')}
                isExpanded={false}
                onToggleExpand={vi.fn()}
            />
        );

        const card = screen.getByRole('button', { name: /RSI/ });
        expect(card).toHaveAttribute('aria-expanded', 'false');
    });

    it('is NOT interactive when the description fits (not clamped)', () => {
        stubClamp(false);
        render(
            <SkillCard
                skill={makeSkill('RSI')}
                isExpanded={false}
                onToggleExpand={vi.fn()}
            />
        );

        expect(screen.queryByRole('button', { name: /RSI/ })).toBeNull();
    });

    it('reflects aria-expanded=true when expanded', () => {
        stubClamp(true);
        render(
            <SkillCard
                skill={makeSkill('RSI')}
                isExpanded={true}
                onToggleExpand={vi.fn()}
            />
        );

        expect(
            screen.getByRole('button', { name: /RSI/ })
        ).toHaveAttribute('aria-expanded', 'true');
    });

    it('calls onToggleExpand with the skill name on click', async () => {
        stubClamp(true);
        const onToggle = vi.fn();
        const user = userEvent.setup();
        render(
            <SkillCard
                skill={makeSkill('RSI')}
                isExpanded={false}
                onToggleExpand={onToggle}
            />
        );

        await user.click(screen.getByRole('button', { name: /RSI/ }));

        expect(onToggle).toHaveBeenCalledWith('RSI');
    });

    it('does NOT toggle the card when the ⓘ confidence button is clicked', async () => {
        stubClamp(true);
        const onToggle = vi.fn();
        const user = userEvent.setup();
        render(
            <SkillCard
                skill={makeSkill('RSI')}
                isExpanded={false}
                onToggleExpand={onToggle}
            />
        );

        await user.click(
            screen.getByRole('button', { name: '신뢰도 점수 설명' })
        );

        expect(onToggle).not.toHaveBeenCalled();
    });
});
```

(2-4) 파일 상단 import 블록(line 47-53 영역)에 `userEvent`를 추가:

```tsx
import userEvent from '@testing-library/user-event';
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `yarn test src/widgets/home/__tests__/SkillsShowcase.test.tsx`
Expected: FAIL — `SkillCard` is not exported / props 미지원.

- [ ] **Step 4: `SkillCard` 구현**

(4-1) `SkillsShowcase.tsx` 상단 import에 `useIsClamped`를 추가 (line 8-11의 import 블록 위/아래):

```tsx
import { useIsClamped } from './hooks/useIsClamped';
```

(4-2) `SkillCardProps`와 `SkillCard`(현재 line 134-185)를 아래로 교체:

```tsx
interface SkillCardProps {
    skill: SkillShowcaseItem;
    isExpanded: boolean;
    onToggleExpand: (key: string) => void;
}

export function SkillCard({
    skill,
    isExpanded,
    onToggleExpand,
}: SkillCardProps) {
    const badge = skill.type != null ? TYPE_BADGE[skill.type] : null;
    const barColor = barColorClass(skill.confidenceWeight);

    // 클램프 측정은 접힘 상태에서만 유효(펼치면 판정이 뒤집힘) → enabled=!isExpanded.
    const { ref: descRef, isClamped } = useIsClamped(!isExpanded);
    const canExpand = isClamped || isExpanded;

    const handleToggle = (): void => {
        if (!canExpand) return;
        onToggleExpand(skill.name);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
        if (!canExpand) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault(); // Space의 페이지 스크롤 방지
            onToggleExpand(skill.name);
        }
    };

    // 펼침 가능 카드만 인터랙티브하게. 카드 내부에 ⓘ 버튼이 있어 루트를
    // 진짜 <button>으로 만들 수 없으므로 role="button"+tabIndex로 처리한다.
    const interactiveProps = canExpand
        ? {
              role: 'button',
              tabIndex: 0,
              'aria-expanded': isExpanded,
              onClick: handleToggle,
              onKeyDown: handleKeyDown,
          }
        : {};

    return (
        <div
            {...interactiveProps}
            className={cn(
                'bg-secondary-800/50 border-secondary-700 rounded-lg border p-4',
                'transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out motion-reduce:transition-none',
                'focus-visible:ring-primary-500 focus-visible:outline-none focus-visible:ring-1',
                // 호버 lift는 마우스(hover 지원) 기기 + 펼침 가능 카드에만.
                canExpand &&
                    'cursor-pointer [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:scale-[1.015] [@media(hover:hover)]:hover:border-secondary-600 [@media(hover:hover)]:hover:bg-secondary-800/70 [@media(hover:hover)]:hover:shadow-lg'
            )}
        >
            <div className="mb-2 flex items-start gap-2">
                <span className="text-secondary-200 min-w-0 text-sm font-medium">
                    {skill.name}
                </span>
                {badge != null && (
                    <span
                        className={cn(
                            'shrink-0 rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap',
                            badge.className
                        )}
                    >
                        {badge.label}
                    </span>
                )}
            </div>
            <div
                className={cn(
                    'mb-3 overflow-hidden transition-[max-height] duration-200 ease-out motion-reduce:transition-none',
                    isExpanded ? 'max-h-[40rem]' : 'max-h-[2.85rem]'
                )}
            >
                <p
                    ref={descRef}
                    className={cn(
                        'text-secondary-400 text-sm leading-relaxed',
                        !isExpanded && 'line-clamp-2'
                    )}
                >
                    {skill.description}
                </p>
            </div>
            <div className="flex items-center gap-2">
                <div className="bg-secondary-700 h-1.5 flex-1 overflow-hidden rounded-full">
                    <div
                        data-testid="confidence-bar"
                        className={cn(
                            'h-full w-(--confidence-w) rounded-full',
                            barColor
                        )}
                        style={
                            {
                                '--confidence-w': `${skill.confidenceWeight * 100}%`,
                            } as React.CSSProperties
                        }
                        aria-hidden="true"
                    />
                </div>
                <span className="text-secondary-400 font-mono text-xs">
                    {Math.round(skill.confidenceWeight * 100)}%
                </span>
                <ConfidenceInfoTooltip />
            </div>
        </div>
    );
}
```

> 참고: 접힘 높이 `max-h-[2.85rem]`은 `text-sm`(0.875rem) × `leading-relaxed`(1.625) × 2줄 ≈ 2.844rem에 맞춘 값. 펼침 상한 `max-h-[40rem]`은 어떤 스킬 설명보다 충분히 크다(트랜지션은 실제 콘텐츠 높이까지만 시각적으로 진행).

- [ ] **Step 5: 테스트 통과 확인**

Run: `yarn test src/widgets/home/__tests__/SkillsShowcase.test.tsx`
Expected: 새 `SkillCard expand interaction` 5개 PASS. (기존 테스트 중 `SkillsShowcase`를 통해 카드를 렌더하던 것들은 다음 Task에서 props를 받으므로, 이 시점엔 `SkillsShowcase`가 아직 새 props를 안 넘겨 일부 컴파일 에러가 날 수 있음 → Task 4와 연속 실행. 단독 확인이 필요하면 `-t "SkillCard expand interaction"`로 범위를 좁혀 실행.)

Run(범위 한정): `yarn test src/widgets/home/__tests__/SkillsShowcase.test.tsx -t "SkillCard expand"`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/widgets/home/SkillsShowcase.tsx src/widgets/home/__tests__/SkillsShowcase.test.tsx
git commit -m "feat: SkillCard를 클릭 펼침 controlled 카드로 전환"
```

---

### Task 4: `SkillsShowcase` — 훅 연결 + 카드에 펼침 props 전달 + 그리드 정렬

**Files:**
- Modify: `src/widgets/home/SkillsShowcase.tsx:236-295` (SkillsShowcase 본체)
- Test: `src/widgets/home/__tests__/SkillsShowcase.test.tsx` (기존 통과 확인)

- [ ] **Step 1: `SkillsShowcase` 본체 수정**

(1-1) 훅 구조분해(line 237-238)에 `expandedKey`, `toggleExpanded` 추가:

```tsx
    const {
        activeTab,
        showAll,
        expandedKey,
        baseId,
        handleTabSelect,
        toggleShowAll,
        toggleExpanded,
    } = useSkillsShowcase();
```

(1-2) 그리드 컨테이너(line 272)에 `items-start`를 추가 — 펼친 카드만 늘어나고 같은 행 옆 카드는 원래 높이를 유지(스펙 §2):

```tsx
                        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
```

(1-3) 카드 렌더(line 273-275)에 props 전달:

```tsx
                            {visibleSkills.map(skill => (
                                <SkillCard
                                    key={skill.name}
                                    skill={skill}
                                    isExpanded={expandedKey === skill.name}
                                    onToggleExpand={toggleExpanded}
                                />
                            ))}
```

- [ ] **Step 2: 전체 컴포넌트 테스트 통과 확인**

Run: `yarn test src/widgets/home/__tests__/SkillsShowcase.test.tsx`
Expected: PASS (기존 + 신규 전부). 기존 테스트들은 mock된 `expandedKey: null`로 카드가 접힌 상태로 렌더되어 그대로 통과.

- [ ] **Step 3: 커밋**

```bash
git add src/widgets/home/SkillsShowcase.tsx
git commit -m "feat: SkillsShowcase에 카드 펼침 상태 연결 및 그리드 items-start 정렬"
```

---

### Task 5: 전체 검증 (테스트 + 타입 + 린트)

**Files:** 없음 (검증만)

- [ ] **Step 1: 홈 위젯 테스트 전체 실행**

Run: `yarn test src/widgets/home`
Expected: PASS (전부).

- [ ] **Step 2: 타입 체크**

Run: `yarn tsc --noEmit` (또는 프로젝트의 타입체크 스크립트)
Expected: 에러 없음. 특히 `SkillCardProps`/`UseSkillsShowcaseReturn` 타입이 호출부와 일치.

- [ ] **Step 3: 린트 (FSD 경계 + a11y 포함)**

Run: `yarn lint`
Expected: 에러 없음. `role="button"` div의 키보드 핸들러가 있어 jsx-a11y `click-events-have-key-events`/`no-static-element-interactions`를 만족. (만약 nested-interactive 관련 경고가 blocker로 뜨면, 위 File Structure의 설계 결정 주석을 근거로 판단 — 기능상 stopPropagation으로 분리됨.)

- [ ] **Step 4: 커밋 (필요 시 자동수정 반영)**

`yarn lint:fix`로 변경이 생기면:

```bash
git add -A
git commit -m "style: 스킬 카드 펼침 린트 자동수정 반영"
```

변경이 없으면 이 스텝은 생략.

---

### Task 6 (선택): Playwright happy-path E2E

> 메인 세션/사용자가 E2E까지 원할 때만 진행. vitest 컴포넌트 테스트가 핵심 동작을 이미 커버하므로 필수는 아님. 진행 시 기존 `e2e/` 스펙 패턴(`e2e/*.spec.ts`)과 셀렉터 규약을 먼저 확인할 것.

**Files:**
- Create: `e2e/skills-expand.spec.ts`

- [ ] **Step 1: 스펙 작성** (기존 e2e 패턴에 맞춰 `test`/`expect` import, 홈 라우트 방문)

```ts
import { expect, test } from '@playwright/test';

test('AI 분석 스킬 카드를 클릭하면 설명이 펼쳐지고 다시 클릭하면 접힌다', async ({
    page,
}) => {
    await page.goto('/');

    const section = page.getByRole('heading', { name: 'AI 분석 스킬' });
    await section.scrollIntoViewIfNeeded();

    // 설명이 잘려 펼침 가능한(role=button) 첫 카드를 찾는다.
    const card = page
        .locator('[aria-expanded]')
        .filter({ hasText: /./ })
        .first();

    await expect(card).toHaveAttribute('aria-expanded', 'false');
    await card.click();
    await expect(card).toHaveAttribute('aria-expanded', 'true');
    await card.click();
    await expect(card).toHaveAttribute('aria-expanded', 'false');
});
```

- [ ] **Step 2: 실행**

Run: `yarn e2e e2e/skills-expand.spec.ts` (프로젝트 E2E 실행 방식 확인 후)
Expected: PASS. (펼침 가능한 카드가 없으면 셀렉터 조정 — 충분히 긴 설명을 가진 스킬이 시드에 있는지 확인.)

- [ ] **Step 3: 커밋**

```bash
git add e2e/skills-expand.spec.ts
git commit -m "test: 스킬 카드 펼침 happy-path E2E 추가"
```

---

## Self-Review

**1. Spec coverage**

| 스펙 항목 | 구현 Task |
|---|---|
| 인라인 펼침 (line-clamp 토글) | Task 3 (Step 4, max-height + line-clamp) |
| 아코디언(한 번에 하나) + 리셋 | Task 1 |
| 데스크탑 그리드 `align-items: start` | Task 4 (Step 1-2, `items-start`) |
| 호버 lift(은은) + 포인터, hover 한정 | Task 3 (Step 4, `[@media(hover:hover)]:hover:...`) |
| 모바일 = 탭으로 펼침 (호버 없음) | Task 3 (호버는 `@media(hover:hover)` 한정, 클릭은 공통) |
| 펼침 불가 카드 비활성 | Task 2 + Task 3 (`canExpand`) |
| clamp 측정(접힘 상태 한정) + ResizeObserver | Task 2 |
| `ⓘ` stopPropagation | Task 3 (Step 1) |
| 키보드 Enter/Space + aria-expanded | Task 3 (Step 4) |
| prefers-reduced-motion | Task 3 (`motion-reduce:transition-none`) |
| 펼침 애니메이션 (height 트랜지션) | Task 3 (`transition-[max-height]`) |
| 테스트 (훅/컴포넌트/E2E) | Task 1·2·3·6 |

모든 스펙 항목에 대응 Task 존재 — 갭 없음.

**2. Placeholder scan** — TBD/TODO/"적절히 처리" 없음. 모든 코드 스텝에 완전한 코드 포함.

**3. Type consistency** — `toggleExpanded(key: string)`, `expandedKey: string \| null`, `SkillCardProps { skill, isExpanded, onToggleExpand }`, `isElementClamped(el: HTMLElement \| null)`, `useIsClamped(enabled: boolean)` 가 정의부와 호출부(Task 1·2·3·4) 전체에서 일치. 펼침 식별자는 모든 곳에서 `skill.name`으로 통일.
