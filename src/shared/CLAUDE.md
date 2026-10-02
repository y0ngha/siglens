# `shared/` — Framework-Agnostic Utilities

> FSD의 가장 하위 레이어. 어떤 레이어도 shared를 import 가능하지만, shared는 자기 자신만 import 가능.
> (예외: byokGate 등 일부 모듈이 entities를 참조 — ESLint 규칙에서 허용.)

## 하위 구조

파일 목록은 `ls`로 본다. 여기엔 목록만으로는 알 수 없는 것만 적는다.

| Path | 목록에 안 보이는 규칙 |
|---|---|
| `shared/lib/` | 순수 유틸리티 + 서버 런타임 헬퍼(backgroundTask·afterWithDrain·enterLocale 등)를 함께 둔다. 장 세션 판정은 여기 없다 — `@y0ngha/siglens-core`로 단일화됨. **클래스 상수**(buttonStyles·surfaceStyles·typographyStyles·cardStyles)는 컴포넌트가 아니라 문자열이다 — DOM을 바꾸지 않고 `cn()`으로 합치고, buttonStyles는 톤만 담는다(크기는 호출부) |
| `shared/config/` | popular-tickers·popular-options-tickers는 `update-popular-tickers.ts`가 생성한다 — 손으로 고치지 않는다 |
| `shared/ui/` | 한 번 쓰는 `<svg>`를 그리기 전에 StrokeIcons(24px 획 아이콘 세트)부터 본다. ModalShell은 조건부 마운트 모달용(오버레이·포커스 트랩·Esc) — 늘 렌더되는 모달은 `useDialog`. Spinner는 장식용 |
| `shared/hooks/` | **hook이 아닌 모듈은 두지 않는다**(→ `shared/lib`). useCopyToClipboard는 실패를 던지지 않고 `failed`로 돌려준다 |

## 의도적 예외 (shared → entities)

| from | to | 사유 |
|---|---|---|
| `shared/lib/byokGate.ts` | `entities/api-key`, `entities/user-tier`, `entities/user` | Tier 확인 + BYOK 검증 cross-cutting utility. 7개 entity action에서 호출되므로 entities 레이어로 이동하면 역방향 의존 발생. DI로 해소 가능하나 과설계 |

이 예외는 ESLint `from: 'shared', allow: ['shared', 'entities']`로 관리됨.

## 규칙

1. **도메인 어휘 금지.** shared는 Metric, Widget, Event 등 도메인 개념을 알지 못한다.
2. **순수 함수 + primitive 컴포넌트.** Side-effect 코드는 캡슐화.
3. **shared/lib/, shared/config/에 React import 금지.** shared/ui/와 shared/hooks/만 React 사용.
4. **3번째 사용 후 승격.** 1~2개 슬라이스에서만 쓰는 유틸은 해당 슬라이스에 둔다.
5. **shared 내부 cross-slice import 허용.** (예: shared/ui → shared/lib 가능)
6. **barrel(`index.ts`) 금지.** `shared/ui/tabs/TabsUnderline`처럼 정의 파일에서 직접 import한다(테스트·`vi.mock` 포함).
