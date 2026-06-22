# AI 분석 스킬 카드 — 설명 클릭 펼침 (인라인 확장)

- **작성일**: 2026-06-22
- **브랜치**: `feat/skill-card-expand-description`
- **스코프**: siglens 로컬 (프론트 표시 UI). 분석 로직·`@y0ngha/siglens-core` 무관.
- **대상 파일**: `src/widgets/home/SkillsShowcase.tsx`, `src/widgets/home/hooks/useSkillsShowcase.ts` (+ 테스트)

---

## 1. 배경 / 문제

메인 페이지의 "AI 분석 스킬" 섹션(`SkillsShowcase`)에서 각 스킬 카드의 설명(`skill.description`)은
`line-clamp-2`로 2줄에서 잘린 뒤 `…`로 표시된다. 잘린 나머지를 읽을 방법이 전혀 없다 —
카드는 비-인터랙티브 `<div>`이고, `title` 툴팁도, 펼침 affordance도 없다.

전체 설명 텍스트는 이미 서버에서 로드되어 props로 내려오므로(추가 fetch 불필요),
클릭 시 인라인으로 펼쳐 전체를 보여주는 것이 자연스럽다.

## 2. 확정된 동작 (brainstorming 결과)

| 항목 | 결정 | 근거 |
|---|---|---|
| 확장 방식 | **인라인 펼침** — 클릭한 카드만 제자리에서 `line-clamp` 해제 | "자연스럽고 과장되지 않게", 추가 fetch 없음 |
| 펼침 정책 | **아코디언** — 새 카드를 펼치면 이전에 펼친 카드는 자동으로 접힘 (한 번에 하나) | 화면이 항상 정돈돼 보임, "임시 확대" 의도 |
| 데스크탑 그리드 | `align-items: start` — 펼친 카드만 늘어나고, 같은 행의 다른 카드는 원래 높이 유지 | 빈 공간 없이 펼친 카드만 또렷이 부각 |
| affordance | **아이콘/라벨 없음.** 데스크탑 호버 시 은은한 lift(`translateY(-2px) scale(1.015)`) + 포인터 커서 | 카드가 많아도 시각적으로 피곤하지 않게 |
| 모바일 | 호버 lift 없음 → 탭으로 펼침/접힘 | 터치 기기엔 호버 개념 없음 |
| 펼칠 수 없는 카드 | 설명이 2줄 이하라 클램프가 안 걸리면 affordance·클릭 비활성 | 펼쳐도 변화 없는 카드에 헛된 lift·커서를 주지 않음 |

호버 lift와 펼침(height 확장)은 **별개의 인터랙션**이다. 호버는 "누를 수 있다"는 암시일 뿐이고,
실제 펼침은 클릭/탭 시점에 일어난다.

## 3. 상태 설계 — `useSkillsShowcase`

현재 훅은 탭 선택 + "더 보기/접기" 상태를 관리한다. 여기에 펼침 상태를 추가한다.

```ts
// 추가 상태
expandedKey: string | null   // 현재 펼쳐진 스킬의 식별자 (없으면 null)
toggleExpanded(key: string): void  // 같은 key면 닫고(null), 다른 key면 그 key로 교체 (아코디언)
```

**리셋 규칙** — 펼쳐진 카드가 숨겨진 채 상태에 남지 않도록:

- 카테고리 탭 전환 시 `expandedKey = null`
- "더 보기 / 접기" 토글 시 `expandedKey = null`

식별자: `SkillShowcaseItem`에는 안정적 id가 없고 `name`이 사실상 고유 키다(파일 기반 로더에서
스킬 name은 유일). 펼침 식별자로 `skill.name`을 사용한다. (렌더 `key`도 동일 기준이면 일관됨.)

## 4. 컴포넌트 설계 — `SkillCard`

### 4.1 마크업 / 인터랙션

- 펼침 가능한 카드: 루트를 `<button type="button">` (또는 `role="button"` + `tabIndex={0}`)로 만들고
  `aria-expanded={isExpanded}` 부여. 클릭/`Enter`/`Space`로 `toggleExpanded(skill.name)` 호출.
- 펼침 불가 카드(클램프 미발생): 기존처럼 비-인터랙티브 `<div>`. `aria-expanded` 없음, 커서 기본값.
- 설명 `<p>`: `isExpanded`면 `line-clamp` 제거, 아니면 `line-clamp-2` 유지.

### 4.2 "펼침 가능" 판정 (클램프 감지)

설명 길이는 카드 폭·폰트에 따라 가변이므로 정적 글자수 휴리스틱은 부정확하다. DOM 측정으로 판정한다.

- 설명 `<p>`에 ref를 달고 `scrollHeight > clientHeight`이면 "클램프 발생 = 펼침 가능".
- `ResizeObserver`로 카드 폭 변화(모바일↔데스크탑 브레이크포인트, 창 리사이즈)에 재측정.
- 측정 결과를 카드 로컬 상태(`canExpand`)로 보관하고, 이 값이 `false`면 호버 lift·클릭·`aria-expanded`를
  모두 비활성화한다.

> 구현 메모: 측정은 펼침 여부와 무관하게 **클램프된(접힌) 상태 기준**으로 한다.
> 펼쳐진 상태에서는 `scrollHeight == clientHeight`가 되어 판정이 뒤집히므로,
> `isExpanded`일 때는 재측정하지 않고 직전 `canExpand` 값을 유지한다.

### 4.3 클릭 충돌 — 신뢰도 `ⓘ` 툴팁

카드 내부에는 신뢰도 정보 `ⓘ` 버튼(`ConfidenceInfoTooltip`, `usePopoverToggle`)이 있다.
이 버튼 클릭이 카드 펼침으로 버블링되지 않도록 핸들러에서 `e.stopPropagation()` 호출.

## 5. 스타일 / 모션

### 5.1 호버 lift (데스크탑 전용)

```
transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, background-color .18s ease;
hover: translateY(-2px) scale(1.015) + 약한 그림자 + border/배경 살짝 밝게
```

- `@media (hover: hover)`로 한정 — 터치 기기 sticky-hover 잔상 방지.
- `canExpand === true`인 카드에만 적용.

### 5.2 펼침 애니메이션

`line-clamp`는 transition이 불가능하다. 설명 영역만 부드럽게 높이를 변화시키기 위해
**`grid-template-rows: 0fr → 1fr`** 트릭(또는 `max-height`)을 사용한다. 호버 lift(`transform`)와는
독립된 트랜지션이라 서로 간섭하지 않는다.

### 5.3 접근성 — 모션 감소

`@media (prefers-reduced-motion: reduce)`에서 호버 lift와 펼침 height 트랜지션을 모두 끄고
즉시 전환한다. (web-design-guidelines 준수)

## 6. 테스트 (구현과 함께, 커버리지 90% 목표)

**vitest (훅/로직)**
- `toggleExpanded`: 같은 key 재호출 시 `null`(닫힘), 다른 key 호출 시 교체(아코디언) — 동시에 둘 이상 펼쳐지지 않음.
- 탭 전환 시 `expandedKey` 리셋.
- "더 보기 / 접기" 토글 시 `expandedKey` 리셋.

**컴포넌트 (Testing Library)**
- 펼침 가능 카드 클릭 → 전체 설명 노출, `aria-expanded` 토글.
- `ⓘ` 버튼 클릭이 카드 펼침을 트리거하지 않음(`stopPropagation`).
- 클램프 미발생(짧은 설명) 카드는 인터랙션 비활성(`aria-expanded` 없음).

**Playwright (선택, happy-path)**
- 카드 클릭 → 전체 설명 보임 → 재클릭 시 접힘.

## 7. 비범위 (YAGNI)

- 모달/팝오버 방식 (인라인으로 확정).
- 동시 다중 펼침 (아코디언으로 확정).
- 스킬 상세 페이지/라우팅, 설명 외 추가 메타데이터 노출.
- `@y0ngha/siglens-core` 변경, 데이터 모델/로더 변경.

## 8. 레이어 / 스코프 검증

- 변경은 `widgets/home` 슬라이스 내부에 한정 — FSD 의존 방향 위반 없음.
- 분석 도메인 로직(지표/시그널/프롬프트/Skill 파싱) 무변경 → core 가드 비해당. siglens 로컬 작업 확정.
