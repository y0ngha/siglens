# `features/` — User-Facing Interactions

> Feature는 user interaction을 소유한다: 폼 제출, 모델 선택, 검색 등. Context, hooks, UI를 포함.

## 의존 방향

features는 `entities/`와 `shared/`만 import 가능. **상위 레이어(widgets, pages, app)를 import할 수 없다.**

## 의도적 예외 (cross-feature import)

| from | to | 사유 |
|---|---|---|
| `features/auth-signup` | `features/auth-email-verification` | 회원가입 3단계 흐름에서 이메일 인증 phase 전환 필요. 공유 로직을 entities로 추출하면 useActionState 연결이 깨짐 |
| `features/symbol-model` | `features/analysis-nudge` | symbol-model provider가 공유 회원가입 넛지 모달을 단 하나만 호스팅한다. reasoning 토글(잠금 클릭)과 익명 첫 분석 넛지가 이 단일 인스턴스를 함께 연다. 자동 넛지는 '상세 분석'과 '메일 리포트' 두 문구를 번갈아 쓴다 |
| `features/symbol-model` | `features/premium-gate` | 모델 선택 상태가 premium 모델 게이트(인증/BYOK 안내 모달)를 함께 호스팅한다 |
| `features/symbol-model` | `features/reasoning-toggle` | reasoning 토글 상태/라벨을 symbol-model provider가 함께 조율한다 |
| `features/analysis-nudge` | `features/reasoning-toggle` | 회원가입 넛지 copy가 reasoning 기능을 이름으로 부른다. 그 이름(`REASONING_FEATURE_LABEL_KEY`)의 단일 소스는 reasoning-toggle이 소유하므로 정의 파일에서 상수를 재사용한다 |
| `features/portfolio-management` | `features/ticker-search` | 보유종목 추가 폼의 종목 선택에 `TickerAutocomplete`를 재사용한다 |
| `features/watchlist` | `features/portfolio-management` | 내 종목 페이지의 "보유로 전환"이 `HoldingForm`을 심볼 채워 재사용한다. 폼을 entities로 내리면 `useActionState`·자동완성 배선이 깨진다 |
| `features/share` | `features/symbol-model` | 공유 플로우가 현재 선택된 모델/티어 상태를 읽어 공유 스냅샷에 반영한다 |

이 예외는 oxlint `no-restricted-imports`의 `from: 'features', allow: ['features', ...]`로 관리됨. Phase 7 cleanup 시 해소 가능.

## 데이터 접근

`.tsx` UI 파일은 entity의 `lib/`·`api/`를 직접 부르지 않는다. 훅(`hooks/*.ts`)이 `entities/*/actions/`의 Server Action을
`queryFn`/`mutationFn`/`useActionState`로 연결하고 UI는 훅만 쓴다 — 자세한 기준은 `REACT.md`의
"React Query and Server State Rules" 참조.

## import 규칙

barrel(`index.ts`)은 금지다. 다른 슬라이스의 심볼은 정의 파일(`ui/<file>.tsx`, `hooks/<file>.ts`, `lib/<file>.ts` 등)에서 직접 import한다(테스트·`vi.mock` 포함).

## `'use server'` 규칙

`actions.ts` 같은 re-export 파일을 두지 않는다. 개별 action 파일(`actions/<name>.ts`)에서만
`'use server'`를 선언하고, 소비자는 그 파일에서 직접 import한다.

자세한 규칙은 `src/entities/CLAUDE.md` § `'use server'` 규칙 참조.
