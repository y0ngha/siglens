# `shared/` — Framework-Agnostic Utilities

> FSD의 가장 하위 레이어. 어떤 레이어도 shared를 import 가능하지만, shared는 자기 자신만 import 가능.
> (예외: byokGate 등 일부 모듈이 entities를 참조 — ESLint 규칙에서 허용.)

## 하위 구조

파일 목록은 `ls`로 본다. 여기엔 목록만으로는 알 수 없는 것만 적는다.

| Path | 목록에 안 보이는 규칙 |
|---|---|
| `shared/lib/` | 순수 유틸리티 + 서버 런타임 헬퍼(backgroundTask·afterWithDrain·enterLocale 등)를 함께 둔다. 예외로 전역 프로토타입을 바꾸는 `legacyBrowserPolyfills`도 여기 있다 — 부수효과는 `install…()` 호출 안에만 있고 `instrumentation-client.ts` 한 곳에서만 부른다(TOOLCHAIN.md#TC-36). 장 세션 판정은 여기 없다 — `@y0ngha/siglens-core`로 단일화됨. **클래스 상수**(buttonStyles·surfaceStyles·typographyStyles·cardStyles)는 컴포넌트가 아니라 문자열이다 — DOM을 바꾸지 않고 `cn()`으로 합치고, buttonStyles는 톤만 담는다(크기는 호출부) |
| `shared/config/` | popular-tickers·popular-options-tickers는 `update-popular-tickers.ts`가 생성한다 — 손으로 고치지 않는다 |
| `shared/ui/` | 한 번 쓰는 `<svg>`를 그리기 전에 StrokeIcons(24px 획 아이콘 세트)부터 본다. ModalShell은 조건부 마운트 모달용(오버레이·포커스 트랩·Esc) — 늘 렌더되는 모달은 `useDialog`. Spinner는 장식용 |
| `shared/api/` | 환경·feature 게이트 헬퍼는 같은 범주끼리 한 곳에 둔다(`e2eEnv.ts`, `offlineBuild.ts`). 같은 목적의 게이트를 다른 디렉터리에 흩뿌리면 관계가 가려지고 따로 변한다 |
| `shared/hooks/` | **hook이 아닌 모듈은 두지 않는다**(→ `shared/lib`). 특정 feature·위젯 전용 hook은 여기가 아니라 해당 슬라이스의 `hooks/`에 둔다 — 여기는 모든 feature가 쓰는 범용 hook만. useCopyToClipboard는 실패를 던지지 않고 `failed`로 돌려준다 |

## 의도적 예외 (shared → entities)

| from | to | 사유 |
|---|---|---|
| `shared/lib/byokGate.ts` | `entities/api-key`, `entities/user-tier`, `entities/user` | Tier 확인 + BYOK 검증 cross-cutting utility. 7개 entity action에서 호출되므로 entities 레이어로 이동하면 역방향 의존 발생. DI로 해소 가능하나 과설계 |

이 예외는 ESLint `from: 'shared', allow: ['shared', 'entities']`로 관리됨.

## 규칙

1. **도메인 어휘 금지.** shared는 Metric, Widget, Event 등 도메인 개념을 알지 못한다. 비즈니스 상수(인기 종목, 법적 고지 문구)는 그것을 소유한 슬라이스에 둔다 — `shared/lib`에 두면 범용 유틸 안에 도메인 지식이 새어 들어간다.
2. **순수 함수 + primitive 컴포넌트.** Side-effect 코드는 캡슐화. `shared/lib`는 순수 유틸과 위 표에 적힌 서버 런타임 헬퍼만 담는 곳이지 잡동사니 창고가 아니다 — 외부 I/O(fetch, fs, DB)는 `shared/db`·`shared/api`로 보낸다.
3. **shared/lib/, shared/config/에 React import 금지.** shared/ui/와 shared/hooks/만 React 사용. 여러 레이어가 공유하는 타입은 `shared/lib`가 아니라 entity `model.ts`/`types.ts` 또는 `@y0ngha/siglens-core`에 둔다.
4. **3번째 사용 후 승격.** 1~2개 슬라이스에서만 쓰는 유틸은 해당 슬라이스에 둔다. 위젯 전용 순수 헬퍼는 그 위젯의 `utils/`에 두고 세 번째 소비자가 생길 때 `shared/lib`로 올린다.
5. **shared 내부 cross-slice import 허용.** (예: shared/ui → shared/lib 가능)
6. **barrel(`index.ts`) 금지.** `shared/ui/tabs/TabsUnderline`처럼 정의 파일에서 직접 import한다(테스트·`vi.mock` 포함).
