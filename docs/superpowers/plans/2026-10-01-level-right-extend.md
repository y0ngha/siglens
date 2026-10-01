# 작도 레벨선 오른쪽 연장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** core 작도의 수평 레벨(피보나치·돌파선)을 마지막 봉에서 가격축 앞까지 이어 그리는 옵션(기본 켜짐, localStorage 영속)을 "차트 작도" 메뉴에 추가한다.

**Architecture:** 기존 레벨 `LineSeries`(기준 봉~마지막 봉)는 그대로 두고, lightweight-charts v5 series primitive가 마지막 봉 x ~ pane 오른쪽 끝만 덧그린다. `buildOverlayLineSpecs`가 레벨 스펙에 `extendRight`를 싣고 `useChartOverlays`가 그 스펙에만 primitive를 붙인다. 상태는 `StockChart`가 `usePersistentState`로 쥔다.

**Tech Stack:** Next.js 16 / React 19, lightweight-charts 5.2, next-intl, vitest + Testing Library.

Spec: `docs/superpowers/specs/2026-10-01-level-right-extend-design.md`

Commands (worktree `/Users/y0ngha/Project/siglens-wt-rightext`): 테스트 `yarn test <path>`, 린트 `yarn oxlint <path>`, 포맷 `yarn oxfmt <files>`, 타입 `yarn tsc --noEmit`, i18n `node scripts/i18n/extract.mjs --write` → `yarn i18n:verify`. 커밋은 git-agent가 마지막에 한다(이 레포 규칙) — 태스크별 커밋 단계 없음.

---

### Task 1: 순수 좌표 함수 + primitive

**Files:**
- Create: `src/widgets/chart/utils/rightExtendPrimitive.ts`
- Test: `src/widgets/chart/__tests__/utils/rightExtendPrimitive.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
import { describe, expect, it } from 'vitest';
import { rightExtendSegment } from '../../utils/rightExtendPrimitive';

describe('rightExtendSegment', () => {
    it('마지막 봉 x부터 pane 오른쪽 끝까지', () => {
        expect(rightExtendSegment(120, 40, 300)).toEqual({ x1: 120, x2: 300, y: 40 });
    });
    it('x가 왼쪽 밖이면 0부터', () => {
        expect(rightExtendSegment(-15, 40, 300)).toEqual({ x1: 0, x2: 300, y: 40 });
    });
    it.each([
        [null, 40, 300],
        [120, null, 300],
        [300, 40, 300],
        [350, 40, 300],
    ])('그릴 구간이 없으면 null: x=%s y=%s w=%s', (x, y, w) => {
        expect(rightExtendSegment(x, y, w)).toBeNull();
    });
});
```

- [ ] **Step 2: `yarn test src/widgets/chart/__tests__/utils/rightExtendPrimitive.test.ts` → FAIL(모듈 없음)**

- [ ] **Step 3: 구현**

```ts
import {
    LineStyle,
    type IPrimitivePaneRenderer,
    type ISeriesPrimitive,
    type SeriesAttachedParameter,
    type Time,
} from 'lightweight-charts';

export interface RightExtendSegment {
    x1: number;
    x2: number;
    y: number;
}

/**
 * 연장 구간의 미디어 좌표. 시작 x가 pane 왼쪽 밖이면 0부터, 오른쪽 끝 이상이면
 * 그릴 게 없다. 좌표 변환이 실패(`null`)하면 그리지 않는다.
 */
export function rightExtendSegment(
    x: number | null,
    y: number | null,
    paneWidth: number
): RightExtendSegment | null {
    if (x === null || y === null || x >= paneWidth) return null;
    return { x1: Math.max(0, x), x2: paneWidth, y };
}

export interface RightExtendOptions {
    /** 연장 시작 시각 — 레벨 시리즈의 끝점(마지막 봉). */
    startTime: number;
    price: number;
    color: string;
    lineWidth: number;
    dashed: boolean;
}

/**
 * 레벨 시리즈에 붙여 마지막 봉 ~ 가격축 앞을 같은 선으로 덧그리는 primitive.
 * 시리즈 데이터를 미래 시각으로 늘리면 시간축(·fitContent)이 바뀌고, `createPriceLine`은
 * 왼쪽 끝부터 전체 폭이라 둘 다 쓰지 않는다. 시리즈가 제거되면 함께 떨어진다.
 */
export function createRightExtendPrimitive(
    opts: RightExtendOptions
): ISeriesPrimitive<Time> {
    let param: SeriesAttachedParameter<Time> | null = null;
    let x: number | null = null;
    let y: number | null = null;

    const renderer: IPrimitivePaneRenderer = {
        draw: (target, utils) => {
            target.useMediaCoordinateSpace(({ context, mediaSize }) => {
                const seg = rightExtendSegment(x, y, mediaSize.width);
                if (!seg) return;
                context.save();
                context.strokeStyle = opts.color;
                context.lineWidth = opts.lineWidth;
                utils?.setLineStyle(
                    context,
                    opts.dashed ? LineStyle.Dashed : LineStyle.Solid
                );
                context.beginPath();
                context.moveTo(seg.x1, seg.y);
                context.lineTo(seg.x2, seg.y);
                context.stroke();
                context.restore();
            });
        },
    };
    const paneViews = [{ renderer: () => renderer }] as const;

    return {
        attached: p => {
            param = p;
        },
        detached: () => {
            param = null;
        },
        updateAllViews: () => {
            if (!param) return;
            x = param.chart.timeScale().timeToCoordinate(opts.startTime as Time);
            y = param.series.priceToCoordinate(opts.price);
        },
        paneViews: () => paneViews,
    };
}
```

- [ ] **Step 4: 테스트 PASS 확인, `yarn oxlint src/widgets/chart/utils/rightExtendPrimitive.ts`**

---

### Task 2: 스펙에 `extendRight`

**Files:**
- Modify: `src/widgets/chart/utils/chartOverlayUtils.ts` (`OverlayLineSpec`, `OverlayLineSpecOptions`, `buildOverlayLineSpecs`의 segmentSpecs·levelSpecs)
- Test: `src/widgets/chart/__tests__/utils/chartOverlayUtils.test.ts`

- [ ] **Step 1: 실패 테스트** (`describe('buildOverlayLineSpecs')` 안, 기존 `base`에 `extendLevelsRight: false` 추가 후)

```ts
    it('extendLevelsRight marks level specs only', () => {
        const on = buildOverlayLineSpecs([overlay({})], {
            ...base,
            barTimes: BAR_TIMES,
            extendLevelsRight: true,
        });
        expect(on.map(s => s.extendRight)).toEqual([false, true]);
        const off = buildOverlayLineSpecs([overlay({})], {
            ...base,
            barTimes: BAR_TIMES,
            extendLevelsRight: false,
        });
        expect(off.map(s => s.extendRight)).toEqual([false, false]);
    });
```

(`overlay({})`는 선분 1 + 레벨 1을 만든다 — 첫 테스트 `segment → 2-point price series; level → fromTime to last bar` 참고.)

- [ ] **Step 2: FAIL 확인**

- [ ] **Step 3: 구현**
  - `OverlayLineSpec`에 필드 추가:
    ```ts
    /** 마지막 봉 ~ 가격축 앞까지 덧그릴지(수평 레벨만). */
    extendRight: boolean;
    ```
  - `OverlayLineSpecOptions`에:
    ```ts
    /** 수평 레벨을 가격축 앞까지 연장 — 사용자 설정(기본 켜짐). */
    extendLevelsRight: boolean;
    ```
  - segmentSpecs 객체에 `extendRight: false,`, levelSpecs 객체에 `extendRight: opts.extendLevelsRight,`.
  - 같은 파일 다른 테스트·`useChartOverlays.test.ts`의 `SPEC` 리터럴과 `OverlayLineSpecOptions`를 만드는 모든 곳(`StockChart.tsx`)이 타입 에러가 나면 `extendRight: false` / `extendLevelsRight` 를 채운다. `grep -rn "buildOverlayLineSpecs\|OverlayLineSpec = {" src`로 위치 확인.

- [ ] **Step 4: `yarn test src/widgets/chart/__tests__/utils/chartOverlayUtils.test.ts` PASS**

---

### Task 3: `useChartOverlays`가 primitive 부착

**Files:**
- Modify: `src/widgets/chart/hooks/useChartOverlays.ts`
- Test: `src/widgets/chart/__tests__/hooks/useChartOverlays.test.ts`

- [ ] **Step 1: 실패 테스트** — 목 시리즈에 `attachPrimitive: vi.fn()` 추가, `SPEC`에 `extendRight: false` 추가, `../../utils/rightExtendPrimitive` 목:

```ts
const mockCreateRightExtend = vi.fn((opts: unknown) => ({ opts }));
vi.mock('../../utils/rightExtendPrimitive', () => ({
    createRightExtendPrimitive: (opts: unknown) => mockCreateRightExtend(opts),
}));
// mockAddSeries가 만드는 series: { setData: vi.fn(), attachPrimitive: vi.fn() }

    it('attaches the right-extend primitive only to extendRight specs', () => {
        renderHook(() =>
            useChartOverlays({
                chartRef: makeChartRef(makeChart()),
                specs: [SPEC, { ...SPEC, extendRight: true, dashed: true }],
            })
        );
        expect(createdSeries[0]!.attachPrimitive).not.toHaveBeenCalled();
        expect(createdSeries[1]!.attachPrimitive).toHaveBeenCalledTimes(1);
        expect(mockCreateRightExtend).toHaveBeenCalledWith({
            startTime: 3,
            price: 12,
            color: '#42a5f5',
            lineWidth: 1,
            dashed: true,
        });
    });
```

(`createdSeries` 타입을 `{ setData; attachPrimitive }`로 넓힌다.)

- [ ] **Step 2: FAIL 확인**

- [ ] **Step 3: 구현** — `series.setData(...)` 직후:

```ts
                if (spec.extendRight) {
                    const [, end] = spec.points;
                    series.attachPrimitive(
                        createRightExtendPrimitive({
                            startTime: end.time,
                            price: end.value,
                            color: withOpacity(spec.color, spec.opacity),
                            lineWidth: resolvedWidth,
                            dashed: spec.dashed,
                        })
                    );
                }
```

  `lineWidth` 계산식(`Math.min(MAX_LINE_WIDTH, Math.max(1, Math.round(lineWidth * spec.lineWidthMult)))`)을 `const resolvedWidth = ...`로 시리즈 생성 전에 뽑아 두 곳에서 쓴다. import `createRightExtendPrimitive`. 훅 JSDoc에 "레벨 스펙(`extendRight`)은 primitive로 가격축 앞까지 덧그린다" 한 줄.

- [ ] **Step 4: `yarn test src/widgets/chart/__tests__/hooks/useChartOverlays.test.ts` PASS**

---

### Task 4: 메뉴 토글

**Files:**
- Modify: `src/widgets/chart/ui/ChartOverlayMenu.tsx`
- Test: `src/widgets/chart/__tests__/ui/ChartOverlayMenu.test.tsx`
- Modify: `messages/{ko,en,ja,zh}.json`, `messages/_meta/clientKeys.json`(스크립트 생성)

- [ ] **Step 1: 실패 테스트**

```tsx
describe('level right-extend toggle', () => {
    it('없으면 렌더하지 않는다', async () => {
        renderMenu([patternItem]);
        await userEvent.click(screen.getByRole('button', { name: /차트 작도/ }));
        expect(
            within(getPanel()).queryByRole('button', { name: '레벨선 오른쪽 연장' })
        ).toBeNull();
    });

    it('체크 상태를 보이고 누르면 반대 값으로 콜백', async () => {
        const onChange = vi.fn();
        render(
            <ChartOverlayMenu
                items={[patternItem]}
                hiddenKeys={new Set()}
                onSetVisible={vi.fn()}
                rightExtend={{ checked: true, onChange }}
            />
        );
        await userEvent.click(screen.getByRole('button', { name: /차트 작도/ }));
        const toggle = within(getPanel()).getByRole('button', {
            name: '레벨선 오른쪽 연장',
        });
        expect(toggle).toHaveAttribute('aria-pressed', 'true');
        await userEvent.click(toggle);
        expect(onChange).toHaveBeenCalledWith(false);
        // 트리거 개수(켜진 작도 항목 수)에는 세지 않는다.
        expect(screen.getByRole('button', { name: /차트 작도 · 1/ })).toBeInTheDocument();
    });
});
```

(기존 테스트의 트리거 이름 매칭 방식을 따른다 — 파일 상단 `getPanel`·트리거 조회 패턴 확인.)

- [ ] **Step 2: FAIL 확인**

- [ ] **Step 3: 구현**
  - props:
    ```ts
    /** 수평 레벨 오른쪽 연장 설정. 연장할 레벨이 없으면 넘기지 않는다(행 숨김). */
    rightExtend?: { checked: boolean; onChange: (checked: boolean) => void };
    ```
  - 패널의 `groups.map(...)` 뒤:
    ```tsx
    {rightExtend && (
        <div className="mt-1 border-t border-secondary-700/60 pt-1">
            <button
                type="button"
                aria-pressed={rightExtend.checked}
                onClick={() => rightExtend.onChange(!rightExtend.checked)}
                className={cn(
                    ROW_CLASS,
                    rightExtend.checked ? 'text-secondary-100' : 'text-secondary-400'
                )}
            >
                <CheckBox state={rightExtend.checked} />
                <span>{t('ChartOverlayMenu.<hash>')}</span>
            </button>
        </div>
    )}
    ```
  - 키: 소스에 한국어 리터럴 `'레벨선 오른쪽 연장'`을 `t()` 자리에 임시로 두지 말고, `printf '%s' '레벨선 오른쪽 연장' | shasum | cut -c1-6`로 해시를 구해 `ChartOverlayMenu.<hash>` 키를 쓴다. 4개 카탈로그 `widgets.chart.ChartOverlayMenu`에 추가: ko "레벨선 오른쪽 연장", en "Extend levels right", ja "水平線を右へ延長", zh "水平线向右延伸". 이후 `node scripts/i18n/extract.mjs --write`, `yarn i18n:verify`.

- [ ] **Step 4: `yarn test src/widgets/chart/__tests__/ui/ChartOverlayMenu.test.tsx` PASS**

---

### Task 5: StockChart 배선 + 영속 키

**Files:**
- Modify: `src/widgets/chart/constants.ts` (`STORAGE_KEYS.levelRightExtend: \`${STORAGE_PREFIX}.levelRightExtend\``)
- Modify: `src/widgets/chart/StockChart.tsx`

- [ ] **Step 1: 구현**

```ts
import { usePersistentState } from '@/shared/hooks/usePersistentState';
import { STORAGE_KEYS } from './constants'; // 기존 constants import에 합친다
import { isOverlayDrawn } from './utils/chartOverlayUtils'; // 기존 import에 합친다

    // 수평 레벨 오른쪽 연장 — 분석이 바뀌어도 유지되는 사용자 환경설정(localStorage).
    const [levelRightExtend, setLevelRightExtend] = usePersistentState(
        STORAGE_KEYS.levelRightExtend,
        true
    );
    const hasExtendableLevels = useMemo(
        () =>
            chartOverlays.some(
                o =>
                    o.levels.length > 0 &&
                    isOverlayDrawn(o, barTimes, lastBarTime)
            ),
        [chartOverlays, barTimes, lastBarTime]
    );
```

  `buildOverlayLineSpecs` 옵션에 `extendLevelsRight: levelRightExtend`, deps에 `levelRightExtend`. 메뉴:

```tsx
                <ChartOverlayMenu
                    items={overlayItems}
                    hiddenKeys={hiddenOverlayKeys}
                    onSetVisible={onSetOverlayVisible}
                    rightExtend={
                        hasExtendableLevels
                            ? { checked: levelRightExtend, onChange: setLevelRightExtend }
                            : undefined
                    }
                />
```

  (`barTimes`·`lastBarTime`은 `overlaySpecs` 위에 이미 있다 — 선언 순서상 `hasExtendableLevels`를 그 뒤에 둔다.)

- [ ] **Step 2: 검증**

```
yarn tsc --noEmit
yarn oxlint src/widgets/chart
yarn oxfmt <변경 파일들>
yarn test src/widgets/chart src/views/symbol
```
Expected: 전부 통과.

- [ ] **Step 3: 실측** — `yarn dev`로 `/PLTR` 1일 차트에서 피보나치 레벨이 가격축 앞까지 이어지는지, 메뉴 토글 끄면 마지막 봉에서 멈추는지, 새로고침 후 설정 유지되는지 확인(Chrome).
