# PoC 실측 결과 — `[symbol]` ISR 정적화 (Phase 0, Task 1)

- 날짜: 2026-06-02
- 환경: 일반 prod `rm -rf .next && yarn build && yarn start` (E2E_TEST 미설정), `curl` 직접 요청
- 목적: redis(`@upstash/redis` HTTP = no-store fetch)를 RSC에서 await하는 `[symbol]`을 ISR static-safe하게 만드는 방식 확정
- 표기: `ƒ` = Dynamic(매 요청 렌더), `○`/`●` = 정적/ISR 캐시

## 실측

| PoC | 변경 | build 표기 | 런타임 |
|---|---|---|---|
| 1 | `unstable_cache(getBarsAction)` 1개만 적용 (root layout 그대로) | `ƒ` | dynamic |
| 2 | `unstable_cache(순수 함수)` (root layout 그대로) | `ƒ` | dynamic |
| 3 | source-direct `fetch(url, { next: { revalidate } })` (root layout 그대로) | `ƒ` | dynamic |
| 4 | **데이터 fetch를 전혀 하지 않는 빈 페이지** (root layout 그대로) | `ƒ` | dynamic — 기존 `/terms`도 `ƒ` |
| 5 | **root layout `cookies()` 제거** (AuthSessionHeader 미렌더) | `○` | `poc-isr`/`privacy`/`terms` 전부 정적(ISR revalidate 표기) |
| 6 | 5 재현/확인 | `○` | 동일 |
| 7 | root layout cookies 제거 + redis bars `unstable_cache` | `○` | 정적 + `DYNAMIC_SERVER_USAGE` 0 |

## 결정적 단서

**PoC 4**가 원인을 갈랐다 — 데이터를 전혀 fetch하지 않는 빈 페이지조차 `ƒ`였고, 기존 `/terms`도 `ƒ`였다. 즉 dynamic 강제는 페이지 데이터 계층이 아니라 **그 위 공유 셸(root layout)** 에 있었다.

root layout(`src/app/layout.tsx`)은 `<Suspense><AuthSessionHeader /></Suspense>`를 렌더하고, `AuthSessionHeader`(서버)는 본체에서 `await cookies()`(hint 쿠키) + `getCurrentUser()`(DB 세션)를 호출한다. **`cacheComponents`(PPR)가 꺼진 상태에서는 `cookies()`가 Suspense 경계 안에 있어도 전체 라우트를 dynamic으로 강제한다.** AuthSessionHeader JSDoc의 "PPR 셸 구조상 불가피한 1회 swap"이 그 증거 — 이 컴포넌트의 Suspense-격리 트릭은 PPR 전제이며, 이슈 #439로 PPR을 끈 순간 root layout `cookies()`가 모든 라우트의 ISR을 조용히 무력화하고 있었다.

## 결론

1. **축 0 (1차 원인)**: root layout `cookies()`(AuthSessionHeader)를 제거해야 ISR이 가능하다 → **AuthSessionHeader 클라이언트화**(hint 쿠키는 `document.cookie`, 실제 인증은 클라가 트리거하는 `currentUserAction`). PoC 5/6/7로 실증.
2. **축 1 (접근 A 확정)**: 축 0 선결 시 `unstable_cache`가 redis no-store fetch를 ISR static-safe하게 만든다(PoC 7: `DYNAMIC_SERVER_USAGE` 0, 정적). 대안 B(source-direct fetch)는 불필요.

축 0 없이는 어떤 정적화도 무력했다(PoC 1~4). 정리: PoC 디렉터리(`poc-isr`)와 임시 래핑 코드는 제거 완료.
