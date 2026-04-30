# Fix Log

## [Issue #369 PR-2 round 1 | feat/369/auth-social | 2026-04-28]
- Violation: role="separator" 컨테이너 안에 텍스트 노드가 직접 들어감 (SocialLoginButtons.tsx)
- Rule: WAI-ARIA — role="separator"는 시각적 구분선 역할로, 라벨이 필요한 경우 aria-label로 노출하고 자식 노드는 비워야 함. 시각용 "또는" 텍스트가 들어간 div는 role을 제거하고 aria-hidden으로 처리해 접근성 트리에서 분리하는 편이 명확함.
- Context: 인증 폼과 소셜 버튼 사이의 시각적 구분선이 한국어 "또는" 텍스트를 자식으로 가지고 있어, 스크린 리더가 separator 역할 + 텍스트를 이중으로 안내할 가능성이 있었음. role을 제거하고 aria-hidden으로 변경.

- Violation: role="menu" 컨테이너 내부 인터랙티브 자식에 role="menuitem" 누락 (LogoutButton.tsx)
- Rule: WAI-ARIA — role="menu"의 Required Owned Elements는 menuitem/menuitemcheckbox/menuitemradio 중 하나여야 함
- Context: HeaderUserMenu의 role="menu" 컨테이너 안에 위치한 LogoutButton이 단순 <button>이라 스크린 리더가 메뉴 항목으로 인식하지 못함.

- Violation: 멀티라인 JSDoc 주석 블록 (proxy.ts, infrastructure/auth/{db,getCurrentUser,applyAuthCookie,sessionCookieOptions}.ts)
- Rule: CONVENTIONS.md — 함수당 단일 줄 주석만 허용
- Context: 인증 어댑터 파일들이 2~4줄 JSDoc 블록으로 작성됨. 한 줄로 압축.


## [PR #389 round 2 | feat/369/auth-email | 2026-04-28]
- Violation: Next.js error.tsx 컴포넌트 props 인터페이스에 `error: Error & { digest?: string }` 누락
- Rule: Next.js App Router 컨벤션 — error.tsx는 프레임워크가 `error`와 `reset` 두 prop을 모두 전달하므로 인터페이스에 양쪽 다 선언 필요
- Context: src/app/login/error.tsx가 reset만 prop으로 선언하고 error를 누락. 표시에 사용하지 않더라도 타입 안전성을 위해 선언 추가.


## [PR #384 Round 2 | feat/372-377/siglens-core-migration | 2026-04-27]
- Violation: WHY 주석 삭제 — EMA index 매핑 및 SQUEEZE_MOMENTUM_MIN_BARS 알고리즘 유도 주석 제거
- Rule: CLAUDE.md 코멘트 규칙 ("WHY is non-obvious" 주석은 유지)
- Context: 마이그레이션 과정에서 비자명 인덱스 매핑 주석(20-period EMA, 60-period EMA)과 알고리즘 유도 주석(2*kcLength-1 이유)이 삭제됨. 독자가 EMA_DEFAULT_PERIODS를 열어봐야만 확인 가능한 숨겨진 매핑이므로 반드시 유지해야 함.

## [Round 1 — Skipped findings]
- `src/app/[symbol]/page.tsx:144` and `src/app/market/page.tsx:13` (recommended): RSC에서 siglens-core 함수를 직접 호출하는 패턴은 기존 관례이며 이번 PR이 도입한 변경이 아님. RSC는 underlying async 함수를 직접 호출하고, 클라이언트용 Server Action wrapper는 별도 hook 경로로 사용하는 분리 패턴이 의도됨. PR 범위 밖이므로 skip.

## [PR #390 | feat/369/auth-social | 2026-04-28]
- Violation: OAuth 콜백에서 쿠키에 저장된 next 경로를 검증 없이 그대로 redirect로 사용
- Rule: Open Redirect 방어 — 사용자 변조 가능 입력은 사용 시점마다 sanitize (defense-in-depth)
- Context: state 쿠키는 HMAC 서명 없이 base64url JSON으로만 저장되므로 next 값이 변조 가능. /start에서 한 번 sanitize했더라도 콜백에서 redirect 직전에 sanitizeNextPath를 다시 적용해야 안전.

## [PR #390 | feat/369/auth-social | 2026-04-28]
- Violation: 외부 OAuth 토큰/유저 응답의 .json() 파싱 실패가 500 에러로 노출됨
- Rule: 시스템 경계(외부 API)의 예측 불가능한 응답은 try/catch로 감싸 결과 객체로 변환
- Context: tokenResponse.ok가 200이라도 본문이 JSON이 아닐 수 있어 await response.json()가 SyntaxError를 throw할 수 있음. google/kakao/apple 세 어댑터 모두에 동일 패턴 적용.

## [PR #389 | feat/369/auth-email | 2026-04-29]
- Violation: registerAction이 password에 .trim() 적용, loginAction은 trim 없이 사용 — 회원가입 시 trim된 비밀번호로 해시되어 로그인 시 verify 실패
- Rule: FF.md Predictability — 동일 입력에 대한 동일 처리 보장; 양 액션 간 비대칭 처리 금지
- Context: 사용자가 비밀번호에 의도적/비의도적 공백 포함 가입 시 로그인 불가 버그. password는 양쪽 모두 trim 제거(원본 유지), email은 양쪽 모두 trim 적용으로 통일.

## [Issue #387 | feat/387/회원탈퇴-ui | 2026-04-30]
- Violation: aria-describedby가 정적 힌트 텍스트만 가리키고 입력 검증 결과를 알리는 라이브 영역이 없음
- Rule: WCAG 4.1.3 (Status Messages) — 사용자가 입력한 값에 대한 검증 결과는 스크린리더에 즉시 통지되어야 함
- Context: DeleteAccountConfirm의 이메일 재입력 필드가 aria-describedby로 정적 힌트만 가리켜 잘못된 이메일을 입력해도 음성 안내가 없었음. 같은 paragraph를 role="status" aria-live="polite" + 입력값에 따라 텍스트가 바뀌는 동적 메시지로 전환하고, aria-invalid도 함께 토글하도록 수정.

## [PR #391 코멘트 반영 | feat/387/회원탈퇴-ui | 2026-04-30]
- Violation: 기본 Tailwind 색상 직접 사용 — text-blue-400, hover:text-blue-300, focus-visible:ring-blue-500, focus-visible:ring-red-400, focus:border-blue-500, focus:ring-blue-500/40, aria-invalid:border-red-500
- Rule: MISTAKES.md 0.5 — 모든 색상은 시맨틱 토큰(primary-*, ui-danger 등) 사용, 기본 Tailwind 색상(blue-*, red-*) 직접 사용 금지
- Context: DeleteAccountConfirm.tsx, account/page.tsx, account/delete/page.tsx, HeaderUserMenu.tsx의 신규 추가 요소들에 blue-*/red-* 기본 색상 클래스가 적용됨. 각각 primary-500/ui-danger 시맨틱 토큰으로 교체.

- Violation: 이메일 표시 요소에 aria-hidden 적용으로 스크린 리더 접근 불가
- Rule: WCAG 접근성 — 사용자가 참조해야 할 정보는 스크린 리더에서 읽혀야 함
- Context: DeleteAccountConfirm에서 사용자가 재입력해야 할 이메일 주소를 표시하는 <p>에 aria-hidden이 적용되어 스크린 리더 사용자가 이메일 확인 불가. aria-hidden 제거.

- Violation: describe 레이블과 실제 테스트 케이스 의미 불일치
- Rule: MISTAKES.md Tests #9 — describe 텍스트는 내부 it()들의 공통 전제조건만 커버해야 함
- Context: describe('이메일 검증 (email_mismatch)') 블록 안에 이메일이 일치하여 성공하는 케이스가 포함됨. 별도 describe('이메일 정규화') 블록으로 분리.
