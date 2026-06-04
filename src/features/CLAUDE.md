# `features/` — User-Facing Interactions

> Feature는 user interaction을 소유한다: 폼 제출, 모델 선택, 검색 등. Context, hooks, UI를 포함.

## 의존 방향

features는 `entities/`와 `shared/`만 import 가능. **상위 레이어(widgets, pages, app)를 import할 수 없다.**

## 의도적 예외 (cross-feature import)

| from | to | 사유 |
|---|---|---|
| `features/auth-signup` | `features/auth-email-verification` | 회원가입 3단계 흐름에서 이메일 인증 phase 전환 필요. 공유 로직을 entities로 추출하면 useActionState 연결이 깨짐 |
| `features/auth-oauth-consent` | `features/auth-signup` | OAuth 신규 가입 동의 단계에서 auth-signup의 가입 흐름을 재사용 |

이 예외는 ESLint `from: 'features', allow: ['features', ...]`로 관리됨. Phase 7 cleanup 시 해소 가능.

## `'use server'` 규칙

`actions.ts` barrel 파일에 `'use server'`를 선언하면 **안 된다.**
Next.js 16 Turbopack은 `'use server'` 파일에서 async function 직접 export만 허용하며,
re-export 문은 빌드 오류를 유발한다. 개별 action 파일에서만 `'use server'`를 선언한다.

자세한 규칙은 `src/entities/CLAUDE.md` § `'use server'` 규칙 참조.

## 슬라이스 구조

```
features/<name>/
├── ui/               UI 컴포넌트
├── model/            (선택) Context + Provider
├── hooks/            React hooks
├── actions/          (선택) Server Action wrapper (❗ barrel에 'use server' 선언 금지)
├── lib/              (선택) 순수 함수
├── __tests__/        colocated tests
└── index.ts          public API barrel
```
