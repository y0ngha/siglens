# `features/` — User-Facing Interactions

> Feature는 user interaction을 소유한다: 폼 제출, 모델 선택, 검색 등. Context, hooks, UI를 포함.

## 의존 방향

features는 `entities/`와 `shared/`만 import 가능. **상위 레이어(widgets, pages, app)를 import할 수 없다.**

## 의도적 예외 (cross-feature import)

| from | to | 사유 |
|---|---|---|
| `features/auth-signup` | `features/auth-email-verification` | 회원가입 3단계 흐름에서 이메일 인증 phase 전환 필요. 공유 로직을 entities로 추출하면 useActionState 연결이 깨짐 |
| `features/symbol-model` | `features/analysis-nudge` | symbol-model provider가 공유 회원가입 넛지 모달을 단 하나만 호스팅한다. reasoning 토글(잠금 클릭)과 익명 3-심볼 넛지가 이 단일 인스턴스를 함께 연다 |
| `features/symbol-model` | `features/premium-gate` | 모델 선택 상태가 premium 모델 게이트(인증/BYOK 안내 모달)를 함께 호스팅한다 |
| `features/symbol-model` | `features/reasoning-toggle` | reasoning 토글 상태/라벨을 symbol-model provider가 함께 조율한다 |
| `features/analysis-nudge` | `features/reasoning-toggle` | 회원가입 넛지 copy가 reasoning 기능을 이름으로 부른다. 그 이름(`REASONING_FEATURE_LABEL_KEY`)의 단일 소스는 reasoning-toggle이 소유하므로 barrel을 통해 상수를 재사용한다 |
| `features/portfolio-management` | `features/ticker-search` | 보유종목 추가 폼의 종목 선택에 `TickerAutocomplete`를 재사용한다 |
| `features/share` | `features/symbol-model` | 공유 플로우가 현재 선택된 모델/티어 상태를 읽어 공유 스냅샷에 반영한다 |

이 예외는 oxlint `no-restricted-imports`의 `from: 'features', allow: ['features', ...]`로 관리됨. Phase 7 cleanup 시 해소 가능.

## `'use server'` 규칙

`actions.ts` barrel 파일에 `'use server'`를 선언하면 **안 된다.**
Next.js 16 Turbopack은 `'use server'` 파일에서 async function 직접 export만 허용하며,
re-export 문은 빌드 오류를 유발한다. 개별 action 파일에서만 `'use server'`를 선언한다.

자세한 규칙은 `src/entities/CLAUDE.md` § `'use server'` 규칙 참조.
